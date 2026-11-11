import { applyEdits, type Edit, type Snapshot } from '@fixd/shared';
import { parseQuestion } from '@fixd/engine';

/** Option letters present in a snapshot's question HTML. */
export function optionLabels(snap: Snapshot, meta: { id: string; qid: string | null; subject: string; chapter: string; level: string | null }) {
  return parsedOptions(snap, meta).map((o) => o.label as string);
}

export function parsedOptions(snap: Snapshot, meta: { id: string; qid: string | null; subject: string; chapter: string; level: string | null }) {
  const parsed = parseQuestion({
    _id: meta.id,
    qid: meta.qid,
    questionType: snap.questionType,
    subject: meta.subject,
    chapter: meta.chapter,
    concept: null,
    subConcept: null,
    level: meta.level,
    error: 1,
    updatedAt: '',
    errorHistory: [],
    [snap.questionType]: {
      question: snap.question,
      solution: snap.solution,
      answer: snap.answer,
      quesImages: [],
      solutionImages: [],
    },
  } as never);
  return parsed.options;
}

/** Returns a plain language problem with the snapshot's answer, or null when it is well formed. */
export function answerProblem(snap: Snapshot, labels: string[]): string | null {
  const a = snap.answer;
  const valid = labels.length ? labels : ['A', 'B', 'C', 'D'];
  if (snap.questionType === 'scq') {
    if (typeof a !== 'string' || !valid.includes(a.trim())) {
      return `a single correct answer must be one option letter (${valid.join(', ')})`;
    }
    return null;
  }
  if (snap.questionType === 'mcq') {
    if (!Array.isArray(a) || a.length === 0) return 'a multiple correct answer must be a list like ["A","C"]';
    if (new Set(a).size !== a.length) return 'the answer lists the same option twice';
    const bad = a.filter((x) => typeof x !== 'string' || !valid.includes(x));
    if (bad.length) return `unknown option ${bad.map((x) => JSON.stringify(x)).join(', ')}; options are ${valid.join(', ')}`;
    return null;
  }
  if (typeof a !== 'string' || !/^-?\d+(\.\d+)?$/.test(a.trim())) {
    return 'an integer type answer must be a number, like 12 or 0.08';
  }
  return null;
}

export const touchesAnswer = (edits: Edit[]) => edits.some((e) => e.field === 'answer' || e.field === 'questionType');

/**
 * Whether the engine's proposed edits can be approved as they are right now.
 * Returns null when approvable, otherwise the reason in plain words.
 */
export function approveBlocker(
  c: { status: string; edits: Edit[]; guardErrors: string[] },
  current: Snapshot,
  labelsFor: (s: Snapshot) => string[]
): string | null {
  if (c.status !== 'open') return null;
  if (!c.edits.length) return null; // approving accepts the diagnosis, no content change
  if (c.guardErrors.length) {
    return `The safety guard rejected this edit (${c.guardErrors[0]}). Use Edit to write a safe change, or Reject.`;
  }
  if (c.edits.some((e) => e.find === e.replace)) return 'The proposed edit changes nothing. Use Edit or Reject.';
  let next: Snapshot;
  try {
    next = applyEdits(current, c.edits);
  } catch (e) {
    return `The proposed edit no longer applies to the live question (${(e as Error).message}). Use Edit.`;
  }
  if (touchesAnswer(c.edits)) {
    const p = answerProblem(next, labelsFor(next));
    if (p) return `The proposed answer is malformed: ${p}. Use Edit.`;
  }
  return null;
}
