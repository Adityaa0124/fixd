import { applyEdits, type Edit, type Snapshot } from '@fixd/shared';
import type { Prisma, QuestionVersion } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export interface VersionChange {
  from: number;
  to: number;
  before: Snapshot;
  after: Snapshot;
}

export function toSnapshot(v: QuestionVersion): Snapshot {
  return {
    questionType: v.questionType as Snapshot['questionType'],
    question: v.questionHtml,
    solution: v.solutionHtml,
    answer: v.answer as Snapshot['answer'],
  };
}

export async function currentSnapshot(tx: Tx, questionId: string): Promise<{ version: number; snap: Snapshot }> {
  const q = await tx.question.findUniqueOrThrow({ where: { id: questionId } });
  const v = await tx.questionVersion.findUniqueOrThrow({
    where: { questionId_version: { questionId, version: q.currentVersion } },
  });
  return { version: v.version, snap: toSnapshot(v) };
}

export async function writeVersion(tx: Tx, questionId: string, snap: Snapshot, by: string, reason: string) {
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
    },
  });
  await tx.question.update({ where: { id: questionId }, data: { currentVersion: version } });
  return version;
}

/** Links the version a mutating action produced back to that action. */
export async function linkVersion(tx: Tx, questionId: string, version: number | null | undefined, actionId: number) {
  if (version == null) return;
  await tx.questionVersion.update({
    where: { questionId_version: { questionId, version } },
    data: { actionId },
  });
}

/** Applies edits to the live content. Throws EditError (shared) when an edit does not apply. */
export async function applyToCurrent(
  tx: Tx, questionId: string, edits: Edit[], by: string, reason: string
): Promise<VersionChange> {
  const { version: from, snap } = await currentSnapshot(tx, questionId);
  const next = applyEdits(snap, edits);
  const to = await writeVersion(tx, questionId, next, by, reason);
  return { from, to, before: snap, after: next };
}

/** Restores an older version's content as a new version (history is append only). */
export async function restoreVersion(
  tx: Tx, questionId: string, version: number, by: string, reason: string
): Promise<VersionChange> {
  const { version: from, snap: before } = await currentSnapshot(tx, questionId);
  const v = await tx.questionVersion.findUniqueOrThrow({
    where: { questionId_version: { questionId, version } },
  });
  const after = toSnapshot(v);
  const to = await writeVersion(tx, questionId, after, by, reason);
  return { from, to, before, after };
}
