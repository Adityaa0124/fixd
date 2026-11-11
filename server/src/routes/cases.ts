import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { applyEdits, countOccurrences, type Edit, type Taxonomy } from '@fixd/shared';
import { loadDataset, parseQuestion } from '@fixd/engine';
import { db } from '../lib/db';
import { LANES, bad, conflict, notFound, type Lane } from '../lib/http';
import { applyToCurrent, currentSnapshot, restoreVersion } from '../lib/versions';
import { summary } from '../lib/serialize';

export const casesRouter = Router();
const taxonomy: Taxonomy = loadDataset().taxonomy;
const J = (x: unknown) => x as Prisma.InputJsonValue;

const include = { question: true, reports: { orderBy: { reportedAt: 'asc' as const } } };

casesRouter.get('/', async (req, res, next) => {
  try {
    const lane = (req.query.lane as Lane) ?? 'needs_review';
    if (!(lane in LANES)) throw bad(`unknown lane ${lane}`);
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const all = await db.case.findMany({ include });
    const firsts = await db.questionVersion.findMany({ where: { version: 1 } });
    const fv = new Map(firsts.map((v) => [v.questionId, v]));
    const counts = Object.fromEntries(
      Object.entries(LANES).map(([k, st]) => [
        k,
        all.filter((c) => (st as readonly string[]).includes(c.status)).length,
      ])
    );
    let items = all
      .filter((c) => (LANES[lane] as readonly string[]).includes(c.status))
      .map((c) => summary({ ...c, firstVersion: fv.get(c.questionId) }));
    if (q) {
      items = items.filter((i) =>
        [i.qid, i.questionId, i.chapter, i.subject, i.verdict, i.repair, i.preview].some((x) =>
          String(x ?? '')
            .toLowerCase()
            .includes(q)
        )
      );
    }
    items.sort(
      lane === 'no_change'
        ? (a, b) => String(a.firstReportedAt).localeCompare(String(b.firstReportedAt))
        : (a, b) => b.urgency - a.urgency
    );
    res.json({ items, counts });
  } catch (e) {
    next(e);
  }
});

async function detail(id: string) {
  const c = await db.case.findUnique({
    where: { id },
    include: {
      ...include,
      actions: { orderBy: { createdAt: 'desc' } },
      question: { include: { versions: { orderBy: { version: 'asc' } } } },
    },
  });
  if (!c) throw notFound();
  const versions = c.question.versions;
  const cur = versions.find((v) => v.version === c.question.currentVersion)!;
  const toSnap = (v: typeof cur) => ({
    questionType: v.questionType as any,
    question: v.questionHtml,
    solution: v.solutionHtml,
    answer: v.answer as any,
  });
  const current = toSnap(cur);
  const original = toSnap(versions[0]!);
  const edits = c.edits as unknown as Edit[];
  let proposed = null;
  if (c.status === 'open' && edits.length) {
    try {
      proposed = applyEdits(current, edits);
    } catch {
      proposed = null;
    }
  }
  const parsed = parseQuestion({
    _id: c.questionId,
    qid: c.question.qid,
    questionType: current.questionType,
    subject: c.question.subject,
    chapter: c.question.chapter,
    concept: null,
    subConcept: null,
    level: c.question.level,
    error: 1,
    updatedAt: '',
    errorHistory: [],
    [current.questionType]: {
      question: current.question,
      solution: current.solution,
      answer: current.answer,
      quesImages: [],
      solutionImages: [],
    },
  } as any);
  return {
    ...summary({ ...c, firstVersion: versions[0] }),
    evidence: c.evidence,
    gates: c.gates,
    agreement: c.agreement,
    solves: c.solves,
    findings: c.findings,
    otherIssues: c.otherIssues,
    guardErrors: c.guardErrors,
    edits,
    urgencyBreakdown: c.urgencyBreakdown,
    engineMeta: c.engineMeta,
    reports: c.reports,
    actions: c.actions,
    versions: versions.map(({ version, createdBy, reason, createdAt }) => ({
      version,
      createdBy,
      reason,
      createdAt,
    })),
    currentVersion: c.question.currentVersion,
    current,
    original,
    proposed,
    answerOptions: parsed.options.map((o) => ({ label: o.label, text: o.text, blank: o.blank })),
  };
}

casesRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(await detail(req.params.id as string));
  } catch (e) {
    next(e);
  }
});

const EditZ = z.object({
  field: z.enum(['question', 'solution', 'answer', 'questionType']),
  find: z.string(),
  replace: z.string(),
});
const Replies = z.record(z.string(), z.string().min(1).max(600)).optional();
const ActionZ = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('approve'),
    actor: z.string().min(1),
    replies: Replies,
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal('edit'),
    actor: z.string().min(1),
    edits: z.array(EditZ).min(1),
    replies: Replies,
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal('reject'),
    actor: z.string().min(1),
    reason: z.string().min(1),
    replies: Replies,
  }),
  z.object({ type: z.literal('confirm'), actor: z.string().min(1) }),
  z.object({ type: z.literal('revert'), actor: z.string().min(1), reason: z.string().min(1) }),
  z.object({ type: z.literal('acknowledge'), actor: z.string().min(1) }),
  z.object({ type: z.literal('undo'), actor: z.string().min(1) }),
]);

const ALLOWED_FROM: Record<string, string[]> = {
  approve: ['open'],
  edit: ['open'],
  reject: ['open'],
  confirm: ['auto_applied'],
  revert: ['auto_applied'],
  acknowledge: ['no_change'],
  undo: [],
};

casesRouter.post('/:id/actions', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = ActionZ.parse(req.body);
    const c = await db.case.findUnique({ where: { id } });
    if (!c) throw notFound();
    if (body.type !== 'undo' && !ALLOWED_FROM[body.type]!.includes(c.status)) {
      throw conflict(`cannot ${body.type} a case in status ${c.status}`);
    }

    await db.$transaction(async (tx) => {
      const log = (action: string, summaryText: string, before?: unknown, after?: unknown) =>
        tx.auditLog.create({
          data: {
            actor: body.actor,
            action,
            caseId: c.id,
            questionId: c.questionId,
            summary: summaryText,
            before: J(before ?? null),
            after: J(after ?? null),
          },
        });
      const setReplies = async (replies?: Record<string, string>) => {
        for (const [rid, text] of Object.entries(replies ?? {})) {
          await tx.report.update({
            where: { id: rid },
            data: { finalReply: text, replyStatus: 'sent' },
          });
        }
        await tx.report.updateMany({
          where: { questionId: c.questionId, replyStatus: 'draft' },
          data: { replyStatus: 'sent' },
        });
      };
      const resolve = (status: string) =>
        tx.case.update({
          where: { id: c.id },
          data: { status, resolvedAt: new Date(), resolvedBy: body.actor },
        });

      switch (body.type) {
        case 'approve': {
          const edits = c.edits as unknown as Edit[];
          let v: { from: number; to: number; before: unknown; after: unknown } | null = null;
          if (edits.length) {
            v = await applyToCurrent(tx, c.questionId, edits, body.actor, `approved ${c.repair}`);
          }
          await tx.action.create({
            data: {
              caseId: c.id,
              type: 'approve',
              actor: body.actor,
              note: body.note,
              edits: J(edits),
              statusBefore: c.status,
              statusAfter: 'approved',
              versionFrom: v?.from,
              versionTo: v?.to,
            },
          });
          await setReplies(body.replies);
          await resolve('approved');
          await log(
            'approve',
            v
              ? `Approved ${c.repair} (v${v.from} → v${v.to})`
              : `Accepted diagnosis ${c.repair ?? c.verdict}`,
            v?.before,
            v?.after
          );
          break;
        }
        case 'edit': {
          const { snap } = await currentSnapshot(tx, c.questionId);
          const allowed = c.repair
            ? taxonomy.repairs[c.repair as keyof Taxonomy['repairs']]?.fields ?? []
            : ['question', 'solution', 'answer', 'questionType'];
          for (const e of body.edits) {
            if (!allowed.includes(e.field)) {
              throw bad(`field ${e.field} is outside ${c.repair} scope (${allowed.join(', ')})`);
            }
            if (
              (e.field === 'question' || e.field === 'solution') &&
              countOccurrences(snap[e.field], e.find) !== 1
            ) {
              throw bad(`find text must occur exactly once in ${e.field}`);
            }
          }
          const v = await applyToCurrent(tx, c.questionId, body.edits, body.actor, `faculty edit of ${c.repair}`);
          await tx.action.create({
            data: {
              caseId: c.id,
              type: 'edit',
              actor: body.actor,
              note: body.note,
              edits: J(body.edits),
              statusBefore: c.status,
              statusAfter: 'edited',
              versionFrom: v.from,
              versionTo: v.to,
            },
          });
          await setReplies(body.replies);
          await resolve('edited');
          await log('edit', `Edited and applied ${c.repair} (v${v.from} → v${v.to})`, v.before, v.after);
          break;
        }
        case 'reject': {
          await tx.action.create({
            data: {
              caseId: c.id,
              type: 'reject',
              actor: body.actor,
              note: body.reason,
              statusBefore: c.status,
              statusAfter: 'rejected',
            },
          });
          await setReplies(body.replies);
          await resolve('rejected');
          await log('reject', `Rejected AI proposal: ${body.reason}`);
          break;
        }
        case 'confirm': {
          await tx.action.create({
            data: {
              caseId: c.id,
              type: 'confirm',
              actor: body.actor,
              statusBefore: c.status,
              statusAfter: 'confirmed',
            },
          });
          await resolve('confirmed');
          await log('confirm', `Confirmed auto applied ${c.repair}`);
          break;
        }
        case 'revert': {
          const auto = await tx.action.findFirst({
            where: { caseId: c.id, type: 'auto_apply', undone: false },
            orderBy: { id: 'desc' },
          });
          if (!auto?.versionFrom) throw conflict('no auto applied version to revert');
          const to = await restoreVersion(
            tx,
            c.questionId,
            auto.versionFrom,
            body.actor,
            `revert auto apply: ${body.reason}`
          );
          await tx.action.update({ where: { id: auto.id }, data: { undone: true } });
          await tx.action.create({
            data: {
              caseId: c.id,
              type: 'revert',
              actor: body.actor,
              note: body.reason,
              statusBefore: c.status,
              statusAfter: 'rejected',
              versionFrom: auto.versionTo,
              versionTo: to,
            },
          });
          await resolve('rejected');
          await log(
            'revert',
            `Reverted auto applied ${c.repair} to v${auto.versionFrom} content (now v${to}): ${body.reason}`
          );
          break;
        }
        case 'acknowledge': {
          await tx.action.create({
            data: {
              caseId: c.id,
              type: 'acknowledge',
              actor: body.actor,
              statusBefore: c.status,
              statusAfter: 'acknowledged',
            },
          });
          await resolve('acknowledged');
          await log('acknowledge', 'Reviewed no change verdict');
          break;
        }
        case 'undo': {
          const last = await tx.action.findFirst({
            where: {
              caseId: c.id,
              undone: false,
              type: { notIn: ['undo', 'auto_apply', 'rerun'] },
            },
            orderBy: { id: 'desc' },
          });
          if (!last) throw conflict('nothing to undo');
          let to: number | null = null;
          if (last.versionFrom != null && last.versionTo != null) {
            to = await restoreVersion(
              tx,
              c.questionId,
              last.type === 'revert' ? last.versionFrom : last.versionFrom,
              body.actor,
              `undo ${last.type} #${last.id}`
            );
          }
          await tx.action.update({ where: { id: last.id }, data: { undone: true } });
          await tx.action.create({
            data: {
              caseId: c.id,
              type: 'undo',
              actor: body.actor,
              note: `undo #${last.id} ${last.type}`,
              statusBefore: c.status,
              statusAfter: last.statusBefore,
              versionTo: to,
            },
          });
          await tx.case.update({
            where: { id: c.id },
            data: { status: last.statusBefore, resolvedAt: null, resolvedBy: null },
          });
          await log(
            'undo',
            `Undid ${last.type} by ${last.actor}${to ? ` (content restored as v${to})` : ''}`
          );
          break;
        }
      }
    }, { maxWait: 15000, timeout: 60000 });
    res.json(await detail(c.id));
  } catch (e) {
    if (e instanceof z.ZodError) return next(bad(e.issues.map((i) => i.message).join('; ')));
    next(e);
  }
});

const rerunLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RERUN_PER_HOUR ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Rerun limit reached for this hour (free tier budget). Precomputed results are still shown.',
  },
});

casesRouter.post('/:id/rerun', rerunLimit, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const c = await db.case.findUnique({ where: { id } });
    if (!c) throw notFound();
    await db.action.create({
      data: {
        caseId: c.id,
        type: 'rerun',
        actor: String(req.body?.actor ?? 'faculty'),
        statusBefore: c.status,
        statusAfter: c.status,
      },
    });
    await db.auditLog.create({
      data: {
        actor: String(req.body?.actor ?? 'faculty'),
        action: 'rerun',
        caseId: c.id,
        questionId: c.questionId,
        summary: 'Requested AI rerun (served from cache when unchanged)',
      },
    });
    res.json(await detail(c.id));
  } catch (e) {
    next(e);
  }
});
