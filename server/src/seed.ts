import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Prisma } from '@prisma/client';
import { loadDataset, type CaseOut } from '@fixd/engine';
import { db } from './lib/db';
import { applyToCurrent } from './lib/versions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const J = (x: unknown) => x as Prisma.InputJsonValue;

export async function seed() {
  const ds = loadDataset();
  const casesPath = path.join(root, 'engine/out/cases.json');
  if (!fs.existsSync(casesPath)) {
    console.warn(`cases.json not found at ${casesPath}; please run the engine first`);
    return { questions: 0, cases: 0 };
  }
  const cases: CaseOut[] = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

  await db.$transaction([
    db.auditLog.deleteMany(),
    db.action.deleteMany(),
    db.report.deleteMany(),
    db.case.deleteMany(),
    db.questionVersion.deleteMany(),
    db.question.deleteMany(),
  ], { maxWait: 15000, timeout: 60000 });

  for (const q of ds.questions) {
    const body = q[q.questionType]!;
    await db.question.create({
      data: {
        id: q._id,
        qid: q.qid,
        subject: q.subject,
        chapter: q.chapter,
        level: q.level,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            questionType: q.questionType,
            questionHtml: body.question,
            solutionHtml: body.solution,
            answer: J(body.answer),
            createdBy: 'import',
            reason: 'production record as received',
          },
        },
      },
    });
  }

  for (const c of cases) {
    const status = c.route === 'auto_apply' ? 'auto_applied' : c.route === 'faculty_review' ? 'open' : 'no_change';
    const created = await db.case.create({
      data: {
        questionId: c.questionId,
        verdict: c.verdict,
        repair: c.repair,
        edits: J(c.edits),
        route: c.route,
        gates: J(c.gates),
        confidence: c.confidence,
        evidence: c.evidence,
        agreement: J(c.agreement),
        solves: J(c.solves),
        findings: J(c.findings),
        otherIssues: J(c.otherIssues),
        guardErrors: J(c.guardErrors),
        urgency: c.urgency.score,
        urgencyBreakdown: J(c.urgency),
        status,
        engineMeta: J(c.engine),
      },
    });
    await db.report.createMany({
      data: c.reports.map((r) => ({
        id: r.reportId,
        questionId: c.questionId,
        studentId: r.studentId,
        source: r.source,
        reportedAt: new Date(r.reportedAt),
        comment: r.comment,
        flags: r.flags,
        lang: r.lang,
        verdict: r.verdict,
        route: r.route,
        studentClaim: r.studentClaim,
        studentWasRight: r.studentWasRight,
        aiReply: r.reply,
        replyStatus: c.route === 'auto_apply' || c.route === 'no_change' ? 'sent' : 'draft',
      })),
    });
    if (status === 'auto_applied') {
      await db.$transaction(async (tx) => {
        const v = await applyToCurrent(tx, c.questionId, c.edits, 'fixd engine', `auto apply: ${c.repair}`);
        const a = await tx.action.create({
          data: {
            caseId: created.id,
            type: 'auto_apply',
            actor: 'fixd engine',
            edits: J(c.edits),
            statusBefore: 'new',
            statusAfter: 'auto_applied',
            versionFrom: v.from,
            versionTo: v.to,
          },
        });
        await tx.auditLog.create({
          data: {
            actor: 'fixd engine',
            action: 'auto_apply',
            caseId: created.id,
            questionId: c.questionId,
            summary: `Auto applied ${c.repair} (v${v.from} → v${v.to}), confidence ${c.confidence}`,
            before: J(v.before),
            after: J(v.after),
          },
        });
        await tx.questionVersion.update({
          where: { questionId_version: { questionId: c.questionId, version: v.to } },
          data: { actionId: a.id },
        });
      }, { maxWait: 15000, timeout: 60000 });
    }
  }
  await db.auditLog.create({
    data: {
      actor: 'system',
      action: 'seed',
      summary: `Seeded ${ds.questions.length} questions, ${cases.length} cases`,
    },
  });
  return { questions: ds.questions.length, cases: cases.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seed().then((r) => {
    console.log('seeded', r);
    return db.$disconnect();
  });
}

