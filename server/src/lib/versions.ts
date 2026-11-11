import { applyEdits, type Edit, type Snapshot } from '@fixd/shared';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export async function currentSnapshot(tx: Tx, questionId: string): Promise<{ version: number; snap: Snapshot }> {
  const q = await tx.question.findUniqueOrThrow({ where: { id: questionId } });
  const v = await tx.questionVersion.findUniqueOrThrow({ where: { questionId_version: { questionId, version: q.currentVersion } } });
  return {
    version: v.version,
    snap: { questionType: v.questionType as Snapshot['questionType'], question: v.questionHtml, solution: v.solutionHtml, answer: v.answer as Snapshot['answer'] },
  };
}

export async function writeVersion(tx: Tx, questionId: string, snap: Snapshot, by: string, reason: string, actionId?: number) {
  const q = await tx.question.findUniqueOrThrow({ where: { id: questionId } });
  const version = q.currentVersion + 1;
  await tx.questionVersion.create({
    data: {
      questionId,
      version,
      questionType: snap.questionType,
      questionHtml: snap.question,
      solutionHtml: snap.solution,
      answer: snap.answer as Prisma.InputJsonValue,
      createdBy: by,
      reason,
      actionId,
    },
  });
  await tx.question.update({ where: { id: questionId }, data: { currentVersion: version } });
  return version;
}

export async function applyToCurrent(tx: Tx, questionId: string, edits: Edit[], by: string, reason: string) {
  const { version: from, snap } = await currentSnapshot(tx, questionId);
  const next = applyEdits(snap, edits);
  const to = await writeVersion(tx, questionId, next, by, reason);
  return { from, to, before: snap, after: next };
}

export async function restoreVersion(tx: Tx, questionId: string, version: number, by: string, reason: string) {
  const v = await tx.questionVersion.findUniqueOrThrow({ where: { questionId_version: { questionId, version } } });
  const snap: Snapshot = {
    questionType: v.questionType as Snapshot['questionType'],
    question: v.questionHtml,
    solution: v.solutionHtml,
    answer: v.answer as Snapshot['answer'],
  };
  return writeVersion(tx, questionId, snap, by, reason);
}

