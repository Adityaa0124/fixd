import {
  applyEdits, countOccurrences, normalizeAnswer, type Edit, type RepairKey, type Snapshot, type Taxonomy,
} from '@fixd/shared';
import type { ParsedQuestion } from './parse';
import { findLabelRun } from './parse';

export interface GuardResult {
  ok: boolean;
  errors: string[];
  edits: Edit[];            // possibly with normalized find strings
  after: Snapshot | null;   // snapshot after applying all edits, when ok
  normalizedFind: boolean;
}

const SIZE_EXEMPT: RepairKey[] = ['solution_fix', 'solution_missing'];
const TAG_EXEMPT: RepairKey[] = ['markup_leak', 'option_repair', 'solution_fix', 'solution_missing'];
const EXAM_TAG = /\(\s*(?:JEE|NEET|AIEEE|AIPMT|BITSAT|CBSE|AIIMS)[^)]{0,40}\)/i;

const tags = (s: string) => [...s.matchAll(/<\/?([a-zA-Z][\w-]*)/g)].map((m) => m[0].toLowerCase());
const numbers = (s: string): string[] => s.match(/\d+(?:\.\d+)?/g) ?? [];
const nonLetters = (s: string) => s.replace(/\p{L}/gu, '').replace(/\s+/g, '');
const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#x0*a0;/gi, ' ');
const numberToken = (n: string) => new RegExp(`(?<![\\d.])${n.replace('.', '\\.')}(?![\\d])`);

function multisetSubset(small: string[], big: string[]): boolean {
  const pool = [...big];
  for (const x of small) { const i = pool.indexOf(x); if (i < 0) return false; pool.splice(i, 1); }
  return true;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** The single contiguous chunk removed from `find` to get `replace`, or null if the edit is not a pure removal. */
export function removedChunk(find: string, replace: string): string | null {
  if (replace.length >= find.length) return null;
  let i = 0;
  while (i < replace.length && find[i] === replace[i]) i++;
  let j = 0;
  while (j < replace.length - i && find[find.length - 1 - j] === replace[replace.length - 1 - j]) j++;
  if (i + j !== replace.length) return null;
  return find.slice(i, find.length - j);
}

function fieldText(s: Snapshot, f: Edit['field']): string {
  if (f === 'answer') return Array.isArray(s.answer) ? JSON.stringify(s.answer) : s.answer;
  return s[f];
}

function wsTolerant(hay: string, find: string): string | null {
  const pattern = find.trim().split(/\s+/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  if (!pattern) return null;
  const all = [...hay.matchAll(new RegExp(pattern, 'g'))];
  return all.length === 1 ? all[0]![0] : null;
}

export function guard(args: {
  repair: string | null; edit: Edit | null; extra: Edit[]; p: ParsedQuestion; taxonomy: Taxonomy;
}): GuardResult {
  const errors: string[] = [];
  const { p, taxonomy } = args;
  const repair = args.repair as RepairKey | null;
  const res: GuardResult = { ok: false, errors, edits: [], after: null, normalizedFind: false };

  if (!repair || !(repair in taxonomy.repairs)) { errors.push(`G2 unknown repair "${args.repair}"`); return res; }
  const spec = taxonomy.repairs[repair];
  if (!args.edit) {
    if (spec.auto) errors.push('no edit proposed for an auto repair');
    return { ...res, ok: !spec.auto && errors.length === 0 };
  }

  const edits = [args.edit, ...(repair === 'type_mismatch' ? args.extra : [])].map((e) => ({ ...e }));
  for (const e of edits) {
    if (e.find === e.replace) errors.push(`G8 edit changes nothing in ${e.field}`);
    if (!spec.fields.includes(e.field)) errors.push(`G1 field "${e.field}" not allowed for ${repair} (allowed: ${spec.fields.join(', ')})`);
    if (e.field === 'question' || e.field === 'solution') {
      const hay = fieldText(p.snapshot, e.field);
      const n = e.find === '' ? (hay.trim() === '' ? 1 : 0) : countOccurrences(hay, e.find);
      if (n !== 1) {
        const real = n === 0 ? wsTolerant(hay, e.find) : null;
        if (real) { e.find = real; res.normalizedFind = true; }
        else errors.push(`G3 find occurs ${n} times in ${e.field}: "${e.find.slice(0, 80)}"`);
      }
      if (!SIZE_EXEMPT.includes(repair) && (e.replace.length > e.find.length + 300 || e.find.length > 600)) {
        errors.push(`G5 edit too large (find ${e.find.length}, replace ${e.replace.length} chars)`);
      }
      if (!TAG_EXEMPT.includes(repair) && tags(e.find).join() !== tags(e.replace).join()) {
        errors.push('G7 edit adds, removes or reorders HTML/MathML tags');
      }
    }
  }
  if (errors.length) return res;

  const e = edits[0]!;
  switch (repair) {
    case 'spelling': {
      if (nonLetters(e.find) !== nonLetters(e.replace)) errors.push('spelling edit changes a non letter character');
      const budget = Math.max(2, Math.ceil(stripTags(e.find).trim().length * 0.25));
      if (levenshtein(e.find, e.replace) > budget) errors.push(`spelling edit too large (${levenshtein(e.find, e.replace)} character changes)`);
      break;
    }
    case 'noise':
    case 'exam_reference': {
      const gone = removedChunk(e.find, e.replace);
      if (gone === null) { errors.push(`${repair} must only remove one contiguous piece of text`); break; }
      const visible = stripTags(gone).replace(/\s+/g, ' ').trim();
      if (repair === 'exam_reference' && !(EXAM_TAG.test(gone) && visible.replace(EXAM_TAG, '').replace(/[\s,;:.\-]/g, '') === '')) {
        errors.push('exam_reference may only remove the exam tag itself');
      }
      if (repair === 'noise' && visible.length > 60) errors.push(`noise removal too long (${visible.length} visible chars)`);
      break;
    }
    case 'markup_leak':
      if (!/\\[a-zA-Z]|&lt;|<mi>&(?:amp;)?<\/mi>/.test(e.find)) errors.push('markup_leak find has no visible markup');
      if (/\\[a-zA-Z]+\{|\\(?:frac|sqrt|AA|times|cdot)\b|&lt;/.test(e.replace)) errors.push('markup_leak replace still contains markup');
      if (!multisetSubset(numbers(stripTags(e.find)), numbers(stripTags(e.replace)))) errors.push('markup_leak edit drops or changes a number');
      break;
    case 'answer_form':
      if (!(e.replace.includes(e.find) && e.replace.length > e.find.length)) errors.push('answer_form must be additive');
      break;
    case 'notation':
      if (e.find.length > 200) errors.push('notation edit longer than 200 chars');
      break;
    case 'stem_data': {
      const fresh = numbers(e.replace).filter((n) => !numbers(e.find).includes(n));
      const missing = fresh.filter((n) => !numberToken(n).test(p.solutionText) && !numberToken(n).test(stripTags(p.solutionRaw)));
      if (missing.length) errors.push(`stem_data adds values not stated in the solution: ${missing.join(', ')}`);
      break;
    }
    case 'answer_key':
    case 'type_mismatch':
      break; // validated after apply below
    case 'solution_missing':
      if (e.find !== p.solutionRaw) errors.push('solution_missing find must equal the whole current solution');
      break;
  }

  let after: Snapshot;
  try { after = applyEdits(p.snapshot, edits); }
  catch (err) { errors.push(`G6 ${(err as Error).message}`); return res; }

  if (repair === 'option_repair') {
    const run = findLabelRun(after.question);
    const stemAfter = run.length ? after.question.slice(0, run[0]!.start) : after.question;
    if (stemAfter !== p.stemRaw) errors.push('option_repair changed the stem');
    if (run.length < findLabelRun(p.questionRaw).length) errors.push('option_repair removed an option label');
    if (stripTags(e.replace).trim().length <= stripTags(e.find).trim().length) errors.push('option_repair must add option text, not remove it');
    if (!multisetSubset(tags(e.find), tags(e.replace))) errors.push('option_repair removed markup (would merge options)');
  }
  if (repair === 'answer_key' || repair === 'type_mismatch') {
    const a = normalizeAnswer(after.questionType, after.answer);
    if (a.kind === 'invalid') errors.push(`resulting answer invalid: ${a.reason}`);
    const t = after.questionType;
    if (t === 'scq' && Array.isArray(after.answer)) errors.push('scq answer must be a single letter string, not an array');
    if (t === 'mcq' && !(Array.isArray(after.answer) && after.answer.every((x) => /^[A-D]$/.test(String(x))))) {
      errors.push('mcq answer must be an array of single letters');
    }
    if (t === 'integerQuestion' && Array.isArray(after.answer)) errors.push('integer answer must be a plain number string');
    const labels = new Set(p.options.map((o) => o.label));
    const ls = a.kind === 'single' ? [a.value] : a.kind === 'multi' ? a.values : [];
    for (const l of ls) if (!labels.has(l)) errors.push(`answer (${l}) has no option`);
  }

  return { ok: errors.length === 0, errors, edits, after: errors.length ? null : after, normalizedFind: res.normalizedFind };
}

