import type { OptionLabel, QuestionType } from './types';

export type Answer =
  | { kind: 'single'; value: OptionLabel }
  | { kind: 'multi'; values: OptionLabel[] }
  | { kind: 'integer'; value: string }
  | { kind: 'invalid'; raw: unknown; reason: string };

const LETTER = /^[A-D]$/;

/** Splits "A, B, D", ["A","B"], ["", "B"], "a" into clean upper case letters. */
export function letters(raw: unknown): OptionLabel[] {
  const parts: string[] = Array.isArray(raw) ? raw.map(String) : [String(raw ?? '')];
  const out = parts
    .flatMap((p) => p.split(/[\s,;/]+/))
    .map((p) => p.trim().replace(/[()]/g, '').toUpperCase())
    .filter((p) => LETTER.test(p)) as OptionLabel[];
  return [...new Set(out)].sort();
}

export function normalizeAnswer(type: QuestionType, raw: unknown): Answer {
  if (type === 'integerQuestion') {
    const s = String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '').trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return { kind: 'invalid', raw, reason: `integer answer "${s}" is not numeric` };
    return { kind: 'integer', value: s };
  }
  const ls = letters(raw);
  if (type === 'scq') {
    if (ls.length !== 1) return { kind: 'invalid', raw, reason: `scq needs exactly one letter, got [${ls.join(',')}]` };
    return { kind: 'single', value: ls[0]! };
  }
  if (ls.length === 0) return { kind: 'invalid', raw, reason: 'mcq answer has no letters' };
  return { kind: 'multi', values: ls };
}

/** Structural problems in the stored answer field itself, independent of correctness. */
export function answerFormatIssues(type: QuestionType, raw: unknown): string[] {
  const issues: string[] = [];
  if (type === 'mcq') {
    if (!Array.isArray(raw)) issues.push('mcq answer is not an array');
    else {
      if (raw.some((x) => String(x).trim() === '')) issues.push('mcq answer array contains an empty string');
      if (raw.some((x) => /,/.test(String(x)))) issues.push('mcq answer stores several letters in one comma joined string');
      if (letters(raw).length === 1) issues.push('mcq answer has exactly one correct letter (type mismatch candidate)');
    }
  }
  if (type === 'scq' && Array.isArray(raw)) issues.push('scq answer stored as an array');
  return issues;
}

export function answerToString(a: Answer): string {
  switch (a.kind) {
    case 'single': return a.value;
    case 'multi': return a.values.join(', ');
    case 'integer': return a.value;
    case 'invalid': return `invalid (${a.reason})`;
  }
}

/** Numeric tolerant equality for integer answers; set equality for letters. */
export function sameAnswer(a: Answer, b: Answer): boolean {
  if (a.kind === 'invalid' || b.kind === 'invalid') return false;
  if (a.kind === 'integer' && b.kind === 'integer') {
    const x = Number(a.value), y = Number(b.value);
    return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
  }
  const la = a.kind === 'single' ? [a.value] : a.kind === 'multi' ? a.values : null;
  const lb = b.kind === 'single' ? [b.value] : b.kind === 'multi' ? b.values : null;
  if (!la || !lb) return false;
  return la.length === lb.length && la.every((v, i) => v === lb[i]);
}

/** Solver returns string[] always (schema limitation). Map it into an Answer for the given type. */
export function fromSolver(type: QuestionType, arr: string[] | null | undefined): Answer {
  if (!arr || arr.length === 0) return { kind: 'invalid', raw: arr, reason: 'solver returned no answer' };
  return normalizeAnswer(type, type === 'integerQuestion' ? arr[0] : arr);
}

