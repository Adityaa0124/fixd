import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, Question, QuestionVersion, Report } from '@prisma/client';
import { applyEdits, EditError, type Edit, type Snapshot, type Taxonomy } from '@fixd/shared';
import { loadDataset } from '@fixd/engine';
import { db } from '../lib/db';
import { LANES, bad, conflict, isLane, notFound, HttpError } from '../lib/http';
import { applyToCurrent, currentSnapshot, linkVersion, restoreVersion, toSnapshot, type VersionChange } from '../lib/versions';
import { summary, type CaseWithReports } from '../lib/serialize';
import { answerProblem, approveBlocker, optionLabels, parsedOptions, touchesAnswer } from '../lib/rules';

export const casesRouter = Router();
const taxonomy: Taxonomy = loadDataset().taxonomy;
const J = (x: unknown) => (x ?? null) as Prisma.InputJsonValue;
const TX = { maxWait: 15000, timeout: 60000 };

type QMeta = Pick<Question, 'id' | 'qid' | 'subject' | 'chapter' | 'level'>;
const labelsFor = (q: QMeta) => (s: Snapshot) => optionLabels(s, q);
const editsOf = (c: { edits: unknown }) => (Array.isArray(c.edits) ? (c.edits as Edit[]) : []);
const guardErrorsOf = (c: { guardErrors: unknown }) => (Array.isArray(c.guardErrors) ? (c.guardErrors as string[]) : []);

/** Loads cases with their reports (reports hang off Question, not Case). */
async function loadCases(where: Prisma.CaseWhereInput = {}) {
  const rows = await db.case.findMany({
    where,
    include: {
      question: {
        include: {
          reports: { orderBy: { reportedAt: 'asc' } },
          versions: { orderBy: { version: 'asc' } },
        },
      },
    },
  });
  return rows.map((c) => {
    const versions = c.question.versions;
    const current = versions.find((v) => v.version === c.question.currentVersion) ?? versions[versions.length - 1]!;
    const blocked = approveBlocker(
      { status: c.status, edits: editsOf(c), guardErrors: guardErrorsOf(c) },
      toSnapshot(current),
      labelsFor(c.question)
    );
    const withReports: CaseWithReports & { firstVersion?: QuestionVersion } = {
      ...c,
      reports: c.question.reports,
      firstVersion: versions[0],
    };
    return { row: c, versions, current, blocked, summary: summary(withReports, blocked) };
  });
}

casesRouter.get('/', async (req, res, next) => {
  try {
    const lane = req.query.lane ?? 'needs_review';
    if (!isLane(lane)) throw bad(`unknown lane ${String(lane)}; use one of ${Object.keys(LANES).join(', ')}`);
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const all = await loadCases();
    const counts = Object.fromEntries(
      Object.entries(LANES).map(([k, st]) => [k, all.filter((c) => (st as readonly string[]).includes(c.row.status)).length])
    );
    let items = all.filter((c) => (LANES[lane] as readonly string[]).includes(c.row.status)).map((c) => c.summary);
    if (q) {
      items = items.filter((i) =>
        [i.qid, i.questionId, i.chapter, i.subject, i.verdict, i.repair, i.preview].some((x) =>
          String(x ?? '').toLowerCase().includes(q)
        )
      );
    }
    const t = (s: string | null) => (s ? Date.parse(s) : Number.POSITIVE_INFINITY);
    items.sort(lane === 'no_change' ? (a, b) => t(a.firstReportedAt) - t(b.firstReportedAt) : (a, b) => b.urgency - a.urgency);
    res.json({ items, counts });
  } catch (e) {
    next(e);
  }
});

async function detail(id: string) {
  const [c] = await loadCases({ id });
  if (!c) throw notFound('case not found');
  const actions = await db.action.findMany({ where: { caseId: id }, orderBy: { id: 'desc' } });
  const { row, versions } = c;
  const current = toSnapshot(c.current);
  const original = toSnapshot(versions[0]!);
  const prevRow = versions.find((v) => v.version === row.question.currentVersion - 1);
  const edits = editsOf(row);
  let proposed: Snapshot | null = null;
  if (row.status === 'open' && edits.length) {
    try {
      proposed = applyEdits(current, edits);
    } catch {
      proposed = null;
    }
  }
  return {
    ...c.summary,
    evidence: row.evidence,
    gates: row.gates,
    agreement: row.agreement,
    solves: row.solves,
    findings: row.findings,
    otherIssues: row.otherIssues,
    guardErrors: guardErrorsOf(row),
    editsRejected: Array.isArray(row.editsRejected) ? row.editsRejected : [],
    edits,
    urgencyBreakdown: row.urgencyBreakdown,
    engineMeta: row.engineMeta,
    reports: row.question.reports,
    actions,
    versions: versions.map(({ version, createdBy, reason, createdAt, actionId }) => ({
      version, createdBy, reason, createdAt, actionId,
    })),
    currentVersion: row.question.currentVersion,
    current,
    original,
    proposed,
    previous: prevRow ? toSnapshot(prevRow) : null,
    answerOptions: parsedOptions(current, row.question).map((o) => ({ label: o.label, text: o.text, blank: o.blank })),
  };
}

casesRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(await detail(req.params.id as string));
  } catch (e) {
    next(e);
  }
});

const Actor = z.string().trim().min(1, 'actor is required').max(60);
const Text = (name: string) => z.string().trim().min(1, `${name} is required`).max(500);
const EditZ = z.object({
  field: z.enum(['question', 'solution', 'answer', 'questionType']),
  find: z.string().max(20000),
  replace: z.string().max(20000),
});
const Replies = z.record(z.string().max(40), z.string().trim().min(1, 'reply cannot be empty').max(600)).optional();
const ActionZ = z.discriminatedUnion('type', [
  z.object({ type: z.literal('approve'), actor: Actor, replies: Replies, note: Text('note').optional() }),
  z.object({ type: z.literal('edit'), actor: Actor, edits: z.array(EditZ).min(1).max(5), replies: Replies, note: Text('note').optional() }),
  z.object({ type: z.literal('reject'), actor: Actor, reason: Text('reason'), replies: Replies }),
  z.object({ type: z.literal('confirm'), actor: Actor, replies: Replies }),
  z.object({ type: z.literal('revert'), actor: Actor, reason: Text('reason'), replies: Replies }),
  z.object({ type: z.literal('acknowledge'), actor: Actor, replies: Replies }),
  z.object({ type: z.literal('undo'), actor: Actor, actionId: z.number().int().positive().optional() }),
]);
type ActionBody = z.infer<typeof ActionZ>;

const ALLOWED_FROM: Record<Exclude<ActionBody['type'], 'undo'>, string> = {
  approve: 'open',
  edit: 'open',
  reject: 'open',
  confirm: 'auto_applied',
  revert: 'auto_applied',
  acknowledge: 'no_change',
};
const STATUS_AFTER: Record<Exclude<ActionBody['type'], 'undo'>, string> = {
  approve: 'approved',
  edit: 'edited',
  reject: 'rejected',
  confirm: 'confirmed',
  revert: 'rejected',
  acknowledge: 'acknowledged',
};
/** Actions that send every remaining draft; the others only send replies the faculty wrote explicitly. */
const SENDS_ALL_DRAFTS = new Set(['approve', 'edit', 'confirm', 'acknowledge']);
const UNDOABLE = ['approve', 'edit', 'reject', 'confirm', 'revert', 'acknowledge'];

type ReplyState = { id: string; finalReply: string | null; replyStatus: string };
interface ActionMeta {
  replies?: ReplyState[];
  autoActionId?: number;
  undid?: number;
}

function checkReplies(reports: Report[], replies: Record<string, string> | undefined) {
  const byId = new Map(reports.map((r) => [r.id, r]));
  for (const [rid, text] of Object.entries(replies ?? {})) {
    const r = byId.get(rid);
    if (!r) throw bad(`report ${rid} does not belong to this case`);
    const currentText = r.finalReply ?? r.aiReply;
    if (r.replyStatus === 'sent' && text !== currentText) throw conflict(`reply to ${rid} was already sent to the student`);
  }
}

function checkEditScope(repair: string | null, edits: Edit[]) {
  const allowed: string[] = repair
    ? taxonomy.repairs[repair as keyof Taxonomy['repairs']]?.fields ?? []
    : ['question', 'solution', 'answer', 'questionType'];
  if (!allowed.length) throw bad(`the ${repair} repair allows no content edits; approve the diagnosis or reject it`);
  for (const e of edits) {
    if (!allowed.includes(e.field)) throw bad(`field ${e.field} is outside the ${repair} repair scope (${allowed.join(', ')})`);
  }
}

casesRouter.post('/:id/actions', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const parsed = ActionZ.safeParse(req.body);
    if (!parsed.success) throw bad(parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
    const body = parsed.data;

    const pre = await db.case.findUnique({ where: { id }, include: { question: { include: { reports: true } } } });
    if (!pre) throw notFound('case not found');
    const reports = pre.question.reports;
    if (body.type !== 'undo') {
      if (pre.status !== ALLOWED_FROM[body.type]) {
        throw conflict(`cannot ${body.type} a case that is ${pre.status.replace('_', ' ')}`);
      }
      checkReplies(reports, body.replies);
      if (body.type === 'edit') checkEditScope(pre.repair, body.edits);
    }

    const actionId = await db.$transaction(async (tx) => {
      const c = await tx.case.findUniqueOrThrow({ where: { id } });
      const live = await tx.report.findMany({ where: { questionId: c.questionId } });
      const replyState: ReplyState[] = live.map((r) => ({ id: r.id, finalReply: r.finalReply, replyStatus: r.replyStatus }));

      /** Moves the case from expected to next status; the row lock makes concurrent actions on one case serial. */
      const transition = async (expected: string, next: string, resolved: boolean) => {
        const n = await tx.case.updateMany({
          where: { id, status: expected },
          data: { status: next, resolvedAt: resolved ? new Date() : null, resolvedBy: resolved ? body.actor : null },
        });
        if (n.count !== 1) throw conflict('this case changed while you were acting on it; reload and try again');
      };
      const log = (action: string, text: string, change?: VersionChange | null) =>
        tx.auditLog.create({
          data: {
            actor: body.actor, action, caseId: c.id, questionId: c.questionId, summary: text,
            before: change ? J(change.before) : undefined,
            after: change ? J(change.after) : undefined,
          },
        });
      const sendReplies = async (replies: Record<string, string> | undefined, all: boolean) => {
        for (const r of live) {
          const text = replies?.[r.id];
          if (r.replyStatus === 'sent') continue;
          if (text !== undefined) {
            await tx.report.update({ where: { id: r.id }, data: { finalReply: text, replyStatus: 'sent' } });
          } else if (all) {
            await tx.report.update({ where: { id: r.id }, data: { replyStatus: 'sent' } });
          }
        }
      };
      const record = async (type: string, change: VersionChange | null, extra: Partial<Prisma.ActionUncheckedCreateInput>, meta: ActionMeta) => {
        const a = await tx.action.create({
          data: {
            caseId: c.id, type, actor: body.actor,
            statusBefore: c.status,
            statusAfter: extra.statusAfter ?? c.status,
            versionFrom: change?.from, versionTo: change?.to,
            meta: J(meta),
            ...extra,
          },
        });
        await linkVersion(tx, c.questionId, change?.to, a.id);
        return a.id;
      };

      if (body.type === 'undo') {
        const target = await tx.action.findFirst({
          where: { caseId: c.id, undone: false, type: { in: UNDOABLE } },
          orderBy: { id: 'desc' },
        });
        if (!target) throw conflict('nothing to undo on this case');
        if (body.actionId && body.actionId !== target.id) {
          throw conflict('only the latest action on this case can be undone');
        }
        if (target.statusAfter !== c.status) throw conflict('this case changed since that action; reload and try again');
        const tmeta = (target.meta ?? {}) as ActionMeta;
        await transition(c.status, target.statusBefore, false);
        let change: VersionChange | null = null;
        if (target.versionFrom != null && target.versionTo != null) {
          change = await restoreVersion(tx, c.questionId, target.versionFrom, body.actor, `undo ${target.type} #${target.id}`);
        }
        for (const r of tmeta.replies ?? []) {
          await tx.report.updateMany({ where: { id: r.id, questionId: c.questionId }, data: { finalReply: r.finalReply, replyStatus: r.replyStatus } });
        }
        if (target.type === 'revert' && tmeta.autoActionId) {
          await tx.action.update({ where: { id: tmeta.autoActionId }, data: { undone: false } });
        }
        await tx.action.update({ where: { id: target.id }, data: { undone: true } });
        const aid = await record('undo', change, { statusAfter: target.statusBefore, note: `undo #${target.id} ${target.type}` }, { replies: replyState, undid: target.id });
        await log('undo', `Undid ${target.type} by ${target.actor}${change ? ` (content restored as v${change.to})` : ''}`, change);
        return aid;
      }

      const next = STATUS_AFTER[body.type];
      await transition(ALLOWED_FROM[body.type], next, true);

      switch (body.type) {
        case 'approve': {
          const edits = editsOf(c);
          const { snap } = await currentSnapshot(tx, c.questionId);
          const blocked = approveBlocker({ status: 'open', edits, guardErrors: guardErrorsOf(c) }, snap, labelsFor(pre.question));
          if (blocked) throw conflict(blocked);
          const change = edits.length ? await applyToCurrent(tx, c.questionId, edits, body.actor, `approved ${c.repair}`) : null;
          const aid = await record('approve', change, { statusAfter: next, note: body.note, edits: J(edits) }, { replies: replyState });
          await sendReplies(body.replies, true);
          await log('approve', change ? `Approved ${c.repair} (v${change.from} → v${change.to})` : `Accepted diagnosis ${c.repair ?? c.verdict}, no content change`, change);
          return aid;
        }
        case 'edit': {
          const { snap } = await currentSnapshot(tx, c.questionId);
          let after: Snapshot;
          try {
            after = applyEdits(snap, body.edits);
          } catch (e) {
            throw bad(`edit does not apply: ${(e as Error).message}`);
          }
          if (touchesAnswer(body.edits)) {
            const p = answerProblem(after, labelsFor(pre.question)(after));
            if (p) throw bad(`answer is malformed: ${p}`);
          }
          const change = await applyToCurrent(tx, c.questionId, body.edits, body.actor, `faculty edit of ${c.repair ?? c.verdict}`);
          const aid = await record('edit', change, { statusAfter: next, note: body.note, edits: J(body.edits) }, { replies: replyState });
          await sendReplies(body.replies, true);
          await log('edit', `Edited and applied ${c.repair ?? 'fix'} (v${change.from} → v${change.to})`, change);
          return aid;
        }
        case 'reject': {
          const aid = await record('reject', null, { statusAfter: next, note: body.reason }, { replies: replyState });
          await sendReplies(body.replies, false);
          await log('reject', `Rejected AI proposal: ${body.reason}`);
          return aid;
        }
        case 'confirm': {
          const aid = await record('confirm', null, { statusAfter: next }, { replies: replyState });
          await sendReplies(body.replies, true);
          await log('confirm', `Confirmed auto applied ${c.repair}`);
          return aid;
        }
        case 'revert': {
          const auto = await tx.action.findFirst({
            where: { caseId: c.id, type: 'auto_apply', undone: false },
            orderBy: { id: 'desc' },
          });
          if (auto?.versionFrom == null) throw conflict('no auto applied change to revert');
          const change = await restoreVersion(tx, c.questionId, auto.versionFrom, body.actor, `revert auto apply: ${body.reason}`);
          await tx.action.update({ where: { id: auto.id }, data: { undone: true } });
          const aid = await record('revert', change, { statusAfter: next, note: body.reason }, { replies: replyState, autoActionId: auto.id });
          await sendReplies(body.replies, false);
          await log('revert', `Reverted auto applied ${c.repair}: ${body.reason} (v${change.from} → v${change.to})`, change);
          return aid;
        }
        case 'acknowledge': {
          const aid = await record('acknowledge', null, { statusAfter: next }, { replies: replyState });
          await sendReplies(body.replies, true);
          await log('acknowledge', 'Reviewed no change verdict');
          return aid;
        }
      }
    }, TX);

    res.json({ ...(await detail(id)), lastActionId: actionId });
  } catch (e) {
    if (e instanceof EditError || e instanceof SyntaxError) return next(bad(`edit does not apply: ${e.message}`));
    if (e instanceof HttpError) return next(e);
    next(e);
  }
});
