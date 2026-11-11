import type { Edit, Snapshot } from './types';

export class EditError extends Error {}

export function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

function answerAsText(a: string | string[]): string {
  return Array.isArray(a) ? JSON.stringify(a) : a;
}

/**
 * Applies one edit to a snapshot and returns a new snapshot.
 * Text fields: find must occur exactly once (empty find allowed only when the field is empty).
 * answer: find must equal the current answer rendered as text; replace is a letter, a number,
 *         or a JSON array string like ["A","B","D"].
 * questionType: plain swap.
 */
export function applyEdit(s: Snapshot, e: Edit): Snapshot {
  const next: Snapshot = { ...s };
  if (e.field === 'question' || e.field === 'solution') {
    const cur = s[e.field];
    if (e.find === '') {
      if (cur.trim() !== '') throw new EditError(`empty find on non empty ${e.field}`);
      next[e.field] = e.replace;
      return next;
    }
    const n = countOccurrences(cur, e.find);
    if (n !== 1) throw new EditError(`find occurs ${n} times in ${e.field}, expected exactly 1`);
    next[e.field] = cur.replace(e.find, () => e.replace);
    return next;
  }
  if (e.field === 'answer') {
    const cur = answerAsText(s.answer);
    if (e.find !== cur && e.find !== (Array.isArray(s.answer) ? s.answer.join(', ') : cur)) {
      throw new EditError(`answer find "${e.find}" does not match stored answer ${cur}`);
    }
    const r = e.replace.trim();
    next.answer = r.startsWith('[') ? (JSON.parse(r) as string[]) : r;
    return next;
  }
  if (e.field === 'questionType') {
    if (e.find !== s.questionType) throw new EditError(`questionType find "${e.find}" != ${s.questionType}`);
    if (!['scq', 'mcq', 'integerQuestion'].includes(e.replace)) throw new EditError(`bad questionType ${e.replace}`);
    next.questionType = e.replace as Snapshot['questionType'];
    return next;
  }
  throw new EditError(`unknown field ${(e as Edit).field}`);
}

export function applyEdits(s: Snapshot, edits: Edit[]): Snapshot {
  return edits.reduce(applyEdit, s);
}

