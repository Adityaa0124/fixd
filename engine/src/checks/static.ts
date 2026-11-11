import { letters, type Edit, type RepairKey } from '@fixd/shared';
import type { ParsedQuestion } from '../parse';

export type FindingCode =
  | 'missing_option' | 'blank_option' | 'duplicate_options' | 'answer_on_blank_option'
  | 'markup_leak' | 'exam_reference' | 'noise' | 'figure_without_image'
  | 'answer_format' | 'type_mismatch_candidate' | 'answer_not_in_options'
  | 'integer_unit_unstated' | 'already_fixed_candidate';

export interface Finding {
  code: FindingCode;
  field: 'question' | 'solution' | 'answer' | 'questionType';
  detail: string;
  suggestedRepair: RepairKey | null;
  findCandidate?: string;     // exact raw substring, when one exists
  suggestedEdit?: Edit;       // deterministic, fully specified edit when the fix is mechanical
  certain: boolean;           // false = heuristic, LLM must confirm
}

const EXAM_TAG = /\(\s*(?:JEE(?:\s*(?:Main|Advanced|Adv))?|NEET|AIEEE|AIPMT|BITSAT|CBSE|AIIMS)[^)]{0,40}\)/i;
const LATEX = /\\(?:frac|dfrac|sqrt|times|alpha|beta|gamma|theta|lambda|mu|pi|omega|Delta|delta|cdot|left|right|text|mathrm|AA|circ|degree|propto|infty|sum|int|vec|hat)\b[^<\s]{0,40}/g;
const ALIGN = /<mi>&(?:amp;)?<\/mi>/g;
const NOISE = [/space for rough work/i, /^\s*(?:<[^>]+>\s*)*(?:Q\.?\s*\d+[.)]|\d+\.)\s/i, /\bsource\s*:/i];
const FIGURE = /\b(figure|fig\.|diagram|shown below|as shown|graph shown)\b/i;
const UNIT_HINT = /\(\s*in\s+[^)]+\)|\bin\s+(?:cm|mm|m|s|sec|N|V|J|eV|kg|g|K|°C|W|A|Hz|D|dioptres?|volts?|seconds?|metres?|newtons?)(?:\s*(?:3|³|\^3|2|²|\^2))?\b|\b(?:mm|cm|m)\s*(?:3|³|\^3)\b/i;
const DIMENSIONLESS = /\b(?:value of|find|then)\s+[a-zA-Z]\s*(?:is|=|will be)?\s*[.?]?\s*$|\bratio\b|\bnumber of\b|\bn\s*=|\bx\s*=|\binteger\b/i;

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function staticChecks(p: ParsedQuestion): Finding[] {
  const out: Finding[] = [];
  const isChoice = p.type !== 'integerQuestion';

  if (isChoice) {
    const present = new Set(p.options.map((o) => o.label));
    for (const l of ['A', 'B', 'C', 'D'] as const) {
      if (!present.has(l)) out.push({ code: 'missing_option', field: 'question', detail: `option (${l}) is absent`, suggestedRepair: 'option_repair', certain: true });
    }
    for (const o of p.options) {
      if (o.blank) out.push({ code: 'blank_option', field: 'question', detail: `option (${o.label}) is blank`, suggestedRepair: 'option_repair', findCandidate: o.raw, certain: true });
    }
    const seen = new Map<string, string>();
    for (const o of p.options) {
      if (o.blank) continue;
      const k = norm(o.text);
      const prev = seen.get(k);
      if (prev) out.push({ code: 'duplicate_options', field: 'question', detail: `options (${prev}) and (${o.label}) are identical: "${o.text}"`, suggestedRepair: 'identical_options', certain: true });
      else seen.set(k, o.label);
    }
    const keyed = p.answer.kind === 'single' ? [p.answer.value] : p.answer.kind === 'multi' ? p.answer.values : [];
    for (const l of keyed) {
      const opt = p.options.find((o) => o.label === l);
      if (!opt) out.push({ code: 'answer_not_in_options', field: 'answer', detail: `key (${l}) has no option`, suggestedRepair: 'option_repair', certain: true });
      else if (opt.blank) out.push({ code: 'answer_on_blank_option', field: 'question', detail: `key is (${l}) but option (${l}) is blank`, suggestedRepair: 'option_repair', certain: true });
    }
  }

  for (const [field, raw] of [['question', p.questionRaw], ['solution', p.solutionRaw]] as const) {
    for (const lm of raw.matchAll(LATEX)) {
      out.push({ code: 'markup_leak', field, detail: `raw LaTeX visible: ${lm[0]}`, suggestedRepair: 'markup_leak', findCandidate: lm[0], certain: true });
    }
    const align = [...raw.matchAll(ALIGN)].length;
    if (align) out.push({ code: 'markup_leak', field, detail: `${align} stray alignment marker(s) <mi>&amp;</mi> render as a visible "&"`, suggestedRepair: 'markup_leak', findCandidate: align === 1 ? raw.match(ALIGN)![0] : undefined, certain: true });
    const escaped = raw.match(/&lt;\/?[a-z]+[^&]{0,20}&gt;/i);
    if (escaped) out.push({ code: 'markup_leak', field, detail: `escaped HTML visible: ${escaped[0]}`, suggestedRepair: 'markup_leak', findCandidate: escaped[0], certain: true });
    for (const r of NOISE) {
      const m = raw.match(r);
      if (m) out.push({ code: 'noise', field, detail: `stray text: ${m[0].trim()}`, suggestedRepair: 'noise', findCandidate: m[0], certain: false });
    }
  }

  const exam = p.questionRaw.match(EXAM_TAG);
  if (exam) out.push({ code: 'exam_reference', field: 'question', detail: `exam tag: ${exam[0]}`, suggestedRepair: 'exam_reference', findCandidate: exam[0], certain: true });

  if (FIGURE.test(p.stemText) && p.images.question === 0) {
    out.push({ code: 'figure_without_image', field: 'question', detail: 'stem refers to a figure but quesImages is empty', suggestedRepair: 'diagram', certain: true });
  }

  for (const issue of p.answerIssues) {
    const tm = issue.includes('type mismatch');
    out.push({ code: tm ? 'type_mismatch_candidate' : 'answer_format', field: tm ? 'questionType' : 'answer', detail: issue, suggestedRepair: tm ? 'type_mismatch' : 'answer_key', certain: !tm });
  }
  if (p.answerIssues.length && p.type === 'mcq' && Array.isArray(p.answerRaw)) {
    const ls = letters(p.answerRaw);
    if (ls.length > 1 && JSON.stringify(ls) !== JSON.stringify(p.answerRaw)) {
      out.push({
        code: 'answer_format', field: 'answer',
        detail: `stored mcq key ${JSON.stringify(p.answerRaw)} is malformed; the same letters stored correctly are ${JSON.stringify(ls)}. Graders compare element by element, so students who mark ${ls.join(', ')} are marked wrong.`,
        suggestedRepair: 'answer_key', certain: true,
        suggestedEdit: { field: 'answer', find: JSON.stringify(p.answerRaw), replace: JSON.stringify(ls) },
      });
    }
  }
  if (p.answer.kind === 'invalid') {
    out.push({ code: 'answer_format', field: 'answer', detail: p.answer.reason, suggestedRepair: 'answer_key', certain: true });
  }

  if (p.type === 'integerQuestion' && !UNIT_HINT.test(p.stemText) && !DIMENSIONLESS.test(p.stemText)) {
    out.push({ code: 'integer_unit_unstated', field: 'question', detail: 'integer answer but no unit or "(in X)" stated in the stem', suggestedRepair: 'answer_form', certain: false });
  }

  for (const h of p.errorHistory) {
    const pairs = [...h.note.matchAll(/'([^']+)'\s*->\s*'([^']+)'/g)];
    for (const [, from, to] of pairs) {
      const gone = !p.questionRaw.includes(from!) && !p.solutionRaw.includes(from!);
      const present = p.questionRaw.includes(to!) || p.solutionRaw.includes(to!);
      if (gone && present) {
        out.push({
          code: 'already_fixed_candidate', field: 'question',
          detail: `errorHistory ${h.at} by ${h.actor}: '${from}' was replaced by '${to}' and the live record no longer contains '${from}'`,
          suggestedRepair: null, certain: true,
        });
      }
    }
  }
  return out;
}

