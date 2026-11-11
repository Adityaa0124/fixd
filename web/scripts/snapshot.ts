/**
 * Builds web/public/snapshot.json from the committed engine output so the console can render
 * instantly (and stay useful) when the live API is asleep or absent. Runs before every build.
 * Shape matches the live API (server/API.md), so the UI has a single code path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEdits, type Edit, type RawQuestion, type Snapshot } from '@fixd/shared';
import { parseQuestion } from '../../engine/src/parse';
import { htmlToText } from '../../engine/src/html';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')) as T;

type CaseOut = {
  questionId: string; qid: string | null; subject: string; chapter: string; verdict: string; repair: string | null;
  edits: Edit[]; rejectedEdits?: Edit[]; route: string; gates: unknown; confidence: number; evidence: string;
  agreement: unknown; solves: unknown; findings: unknown; otherIssues: unknown; guardErrors: string[];
  before: Snapshot; after: Snapshot | null; urgency: { score: number }; firstReportedAt: string; engine: unknown;
  reports: Array<{ reportId: string; studentId: string; source: string; reportedAt: string; comment: string; flags: string[];
    lang: string; verdict: string; route: string; studentClaim: string; studentWasRight: boolean; reply: string }>;
};

const cases = read<CaseOut[]>('engine/out/cases.json');
const questions = new Map(read<RawQuestion[]>('data/questions.json').map((q) => [q._id, q]));
const sweepPath = path.join(root, 'engine/out/sweep.json');
const sweep = fs.existsSync(sweepPath) ? JSON.parse(fs.readFileSync(sweepPath, 'utf8')) : [];
const generatedAt = fs.statSync(path.join(root, 'engine/out/cases.json')).mtime.toISOString();

function options(raw: RawQuestion, snap: Snapshot) {
  try {
    const p = parseQuestion({ ...raw, questionType: snap.questionType, [snap.questionType]: { question: snap.question, solution: snap.solution, answer: snap.answer, quesImages: [], solutionImages: [] } } as RawQuestion);
    return p.options.map((o) => ({ label: o.label, text: o.text, blank: o.blank }));
  } catch {
    return [];
  }
}

const items: unknown[] = [];
const details: Record<string, unknown> = {};
for (const c of cases) {
  const raw = questions.get(c.questionId);
  if (!raw) continue;
  const status = c.route === 'auto_apply' ? 'auto_applied' : c.route === 'faculty_review' ? 'open' : 'no_change';
  const original = c.before;
  const current = status === 'auto_applied' && c.after ? c.after : original;
  let proposed: Snapshot | null = null;
  let blockedReason: string | null = null;
  if (status === 'open' && c.edits.length) {
    try {
      proposed = applyEdits(current, c.edits);
    } catch {
      blockedReason = 'The proposed edit does not apply to the stored text.';
    }
    if (!blockedReason && c.edits.some((e) => e.find === e.replace)) blockedReason = 'The proposed edit changes nothing.';
    if (!blockedReason && c.guardErrors.length) blockedReason = 'The scope guard rejected this edit.';
  }
  const reports = c.reports.map((r) => ({
    id: r.reportId, questionId: c.questionId, studentId: r.studentId, source: r.source, reportedAt: r.reportedAt,
    comment: r.comment, flags: r.flags, lang: r.lang, verdict: r.verdict, route: r.route, studentClaim: r.studentClaim,
    studentWasRight: r.studentWasRight, aiReply: r.reply, finalReply: null,
    replyStatus: status === 'open' ? 'draft' : 'sent',
  }));
  const summary = {
    id: c.questionId, questionId: c.questionId, qid: c.qid, subject: c.subject, chapter: c.chapter,
    verdict: c.verdict, repair: c.repair, route: c.route, status, confidence: c.confidence, urgency: c.urgency.score,
    students: new Set(c.reports.map((r) => r.studentId)).size, reports: c.reports.length,
    firstReportedAt: c.firstReportedAt, preview: htmlToText(original.question).slice(0, 140),
    flags: [...new Set(c.reports.flatMap((r) => r.flags))],
    approvable: status === 'open' && !blockedReason, blockedReason,
  };
  const at = c.firstReportedAt;
  items.push(summary);
  details[c.questionId] = {
    ...summary, reports, evidence: c.evidence, gates: c.gates, agreement: c.agreement, solves: c.solves,
    findings: c.findings, otherIssues: c.otherIssues, guardErrors: c.guardErrors, editsRejected: c.rejectedEdits ?? [],
    edits: c.edits, urgencyBreakdown: c.urgency, engineMeta: c.engine,
    actions: status === 'auto_applied'
      ? [{ id: 0, type: 'auto_apply', actor: 'fixd engine', note: null, edits: c.edits, statusBefore: 'new', statusAfter: 'auto_applied', versionFrom: 1, versionTo: 2, undone: false, createdAt: at }]
      : [],
    versions: [
      { version: 1, createdBy: 'import', reason: 'production record as received', createdAt: at, actionId: null },
      ...(status === 'auto_applied' ? [{ version: 2, createdBy: 'fixd engine', reason: `auto apply: ${c.repair}`, createdAt: at, actionId: 0 }] : []),
    ],
    currentVersion: status === 'auto_applied' ? 2 : 1,
    current, original, proposed, previous: status === 'auto_applied' ? original : null,
    answerOptions: options(raw, current),
  };
}

const out = { generatedAt, engine: cases[0]?.engine ?? null, items, details, sweep };
fs.mkdirSync(path.join(here, '../public'), { recursive: true });
fs.writeFileSync(path.join(here, '../public/snapshot.json'), JSON.stringify(out));
fs.writeFileSync(path.join(here, '../public/sweep.json'), JSON.stringify(sweep, null, 1));
console.log(`snapshot: ${items.length} cases, ${sweep.length} sweep findings`);
