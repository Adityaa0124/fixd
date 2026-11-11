import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { ParsedQuestion } from '../parse';
import { optionsText } from '../parse';
import { fill } from './render';

export const PROOFREAD_VERSION = 'proofread-v1';

export const PROOFREAD_SYSTEM = `You proofread one JEE or NEET question record before it is shown to lakhs of students.
Nobody has reported a problem. Find editorial defects only, and propose the smallest fix for each.

Look for
* spelling: a misspelt word, or two words run together ("riceis", "ofleaf"). Fix only that word.
* markup_leak: raw LaTeX or HTML visible as text (\\frac, \\AA, &lt;br&gt;, a stray "&" from an
  alignment marker such as <mi>&amp;</mi>).
* notation: a symbol, exponent, equals sign or bracket lost in one expression.
* exam_reference / noise: "(JEE Main 2019)" style tags, question numbers, "Space for rough work".
* solution_fix: a factually wrong statement or a wrong step in the solution (say what is wrong).
* wrong_chapter: the question clearly belongs to a different chapter than the one it is filed under.

Rules
* Do not re-solve the question or judge the answer key. Do not restyle correct text.
* "find" is copied CHARACTER FOR CHARACTER from <raw_question> or <raw_solution> and occurs there
  exactly once; make it longer only as much as needed to be unique. "replace" changes only the defect.
* For wrong_chapter use find "" and replace "" and name the right chapter in the note.
* Confidence 0 to 1: 0.9 and above only when the defect is unambiguous.
* Return an empty list when the record is clean. Precision matters more than recall.`;

const USER = `Subject: {{subject}} · Chapter: {{chapter}} · Type: {{type}}

<stem>{{stem}}</stem>
<options>{{options}}</options>
<solution>{{solution}}</solution>

<raw_question>{{raw_question}}</raw_question>
<raw_solution>{{raw_solution}}</raw_solution>

Return JSON only.`;

export function proofreadUser(p: ParsedQuestion): string {
  return fill(USER, {
    subject: p.subject, chapter: p.chapter, type: p.type, stem: p.stemText, options: optionsText(p),
    solution: p.solutionText || '(empty)', raw_question: p.questionRaw, raw_solution: p.solutionRaw,
  });
}

export const ProofreadZ = z.object({
  issues: z.array(z.object({
    repair: z.enum(['spelling', 'markup_leak', 'notation', 'exam_reference', 'noise', 'solution_fix', 'wrong_chapter']),
    field: z.enum(['question', 'solution']),
    find: z.string(), replace: z.string(), note: z.string(), confidence: z.number().min(0).max(1),
  })),
});
export type Proofread = z.infer<typeof ProofreadZ>;

export const PROOFREAD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          note: { type: Type.STRING },
          repair: { type: Type.STRING, enum: ['spelling', 'markup_leak', 'notation', 'exam_reference', 'noise', 'solution_fix', 'wrong_chapter'] },
          field: { type: Type.STRING, enum: ['question', 'solution'] },
          find: { type: Type.STRING }, replace: { type: Type.STRING }, confidence: { type: Type.NUMBER },
        },
        required: ['note', 'repair', 'field', 'find', 'replace', 'confidence'],
        propertyOrdering: ['note', 'repair', 'field', 'find', 'replace', 'confidence'],
      },
    },
  },
  required: ['issues'],
};
