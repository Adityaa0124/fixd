import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Prisma } from '@prisma/client';
import { loadDataset, type CaseOut } from '@fixd/engine';
import { db } from './lib/db';
import { applyEdits, type Snapshot } from '@fixd/shared';
import { linkVersion } from './lib/versions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const J = (x: unknown) => (x ?? null) as Prisma.InputJsonValue;
const arr = (x: unknown) => (Array.isArray(x) ? x : []);

/**
 * Wipes and reloads the database from data/ and engine/out/cases.json.
 * Case ids equal question ids so links and selections survive a reseed.
 * Optional engine fields (editsRejected, otherIssues, findings, ...) default to empty.
 */
export async function seed() {
  const ds = loadDataset();
  const casesPath = path.join(root, 'engine/out/cases.json');
  if (!fs.existsSync(casesPath)) {
    console.warn(`cases.json not found at ${casesPath}; run the engine first`);
    return { questions: 0, cases: 0 };
  }
  const cases: Array<CaseOut & { editsRejected?: unknown }> = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

  await db.$transaction([
    db.auditLog.deleteMany(),
    db.action.deleteMany(),
    db.report.deleteMany(),
    db.case.deleteMany(),
    db.questionVersion.deleteMany(),
    db.question.deleteMany(),
  ]);

  await db.question.createMany({
    data: ds.questions.map((q) => ({ id: q._id, qid: q.qid, subject: q.subject, chapter: q.chapter, level: q.level, currentVersion: 1 })),
  });
  await db.questionVersion.createMany({
    data: ds.questions.map((q) => {
      const body = q[q.questionType]!;
      return {
        questionId: q._id,
        version: 1,
        questionType: q.questionType,
        questionHtml: body.question,
        solutionHtml: body.solution,
        answer: J(body.answer),
        createdBy: 'import',
        reason: 'production record as received',
      };
    }),
  });

  const statusOf = (c: CaseOut) => (c.route === 'auto_apply' ? 'auto_applied' : c.route === 'faculty_review' ? 'open' : 'no_change');
  await db.case.createMany({
    data: cases.map((c) => ({
      id: c.questionId,
      questionId: c.questionId,
      verdict: c.verdict,
      repair: c.repair ?? null,
      edits: J(arr(c.edits)),
      route: c.route,
      gates: J(arr(c.gates)),
      confidence: c.confidence,
      evidence: c.evidence ?? '',
      agreement: J(c.agreement ?? {}),
      solves: J(arr(c.solves)),
      findings: J(arr(c.findings)),
      otherIssues: J(arr(c.otherIssues)),
      guardErrors: J(arr(c.guardErrors)),
      editsRejected: J(arr(c.editsRejected)),
      urgency: c.urgency?.score ?? 0,
      urgencyBreakdown: J(c.urgency ?? {}),
      status: statusOf(c),
      engineMeta: J(c.engine ?? {}),
    })),
  });
  await db.report.createMany({
    data: cases.flatMap((c) =>
      arr(c.reports).map((r: CaseOut['reports'][number]) => ({
        id: r.reportId,
        questionId: c.questionId,
        studentId: r.studentId,
        source: r.source,
        reportedAt: new Date(r.reportedAt),
        comment: r.comment,
        flags: arr(r.flags) as string[],
        lang: r.lang,
        verdict: r.verdict,
        route: r.route,
        studentClaim: r.studentClaim ?? '',
        studentWasRight: !!r.studentWasRight,
        aiReply: r.reply,
        // auto applied fixes and no change verdicts answer the student straight away
        replyStatus: c.route === 'faculty_review' ? 'draft' : 'sent',
      }))
    ),
  });

  // Auto applied fixes: computed in memory, written in a few batched statements (reset stays fast).
  const autos = cases.filter((x) => x.route === 'auto_apply' && arr(x.edits).length);
  const v1 = new Map(ds.questions.map((q) => {
    const b = q[q.questionType]!;
    return [q._id, { questionType: q.questionType, question: b.question, solution: b.solution, answer: b.answer } as Snapshot];
  }));
  const applied = autos.map((c) => {
    const before = v1.get(c.questionId)!;
    return { c, before, after: applyEdits(before, c.edits) };
  });
  if (applied.length) {
    await db.$transaction(async (tx) => {
      await tx.questionVersion.createMany({
        data: applied.map(({ c, after }) => ({
          questionId: c.questionId,
          version: 2,
          questionType: after.questionType,
          questionHtml: after.question,
          solutionHtml: after.solution,
          answer: J(after.answer),
          createdBy: 'fixd engine',
          reason: `auto apply: ${c.repair}`,
        })),
      });
      await tx.question.updateMany({ where: { id: { in: applied.map((a) => a.c.questionId) } }, data: { currentVersion: 2 } });
      await tx.action.createMany({
        data: applied.map(({ c }) => ({
          caseId: c.questionId,
          type: 'auto_apply',
          actor: 'fixd engine',
          edits: J(c.edits),
          statusBefore: 'new',
          statusAfter: 'auto_applied',
          versionFrom: 1,
          versionTo: 2,
        })),
      });
      const acts = await tx.action.findMany({ where: { type: 'auto_apply' }, select: { id: true, caseId: true } });
      for (const a of acts) await linkVersion(tx, a.caseId, 2, a.id);
      await tx.auditLog.createMany({
        data: applied.map(({ c, before, after }) => ({
          actor: 'fixd engine',
          action: 'auto_apply',
          caseId: c.questionId,
          questionId: c.questionId,
          summary: `Auto applied ${c.repair} (v1 → v2), confidence ${c.confidence}`,
          before: J(before),
          after: J(after),
        })),
      });
    }, { maxWait: 15000, timeout: 60000 });
  }

  await db.auditLog.create({
    data: { actor: 'system', action: 'seed', summary: `Seeded ${ds.questions.length} questions, ${cases.length} cases` },
  });
  return { questions: ds.questions.length, cases: cases.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seed()
    .then((r) => console.log('seeded', r))
    .finally(() => db.$disconnect());
}
