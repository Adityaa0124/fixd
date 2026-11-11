import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { ParsedQuestion } from '../parse';
import { optionsText } from '../parse';
import { fill } from './render';

export const SOLVER_VERSION = 'solver-v2';

export const SOLVER_SYSTEM = `You are a senior JEE and NEET faculty member solving a question from first principles.

You are deliberately NOT shown the official answer, the official solution or any
student opinion. Do not guess what the official answer might be. Solve it yourself.

Rules
1. Work only from the question text and options given below.
2. If a value, figure or condition that the question needs is missing, do not invent it.
   Set "solvable" to false and say exactly what is missing.
3. For single correct (scq) return one letter. For multiple correct (mcq) return every
   correct letter. For integer type return the number exactly as it should be entered.
4. Keep steps short: at most 6, each one line, showing the key equation and value.
5. Report your honest confidence between 0 and 1. A clean numeric match to one option
   is high. A recall based biology fact you are unsure of is not.
6. Also report any option that is blank, cut off, or identical to another option.

Output note: "answer" is always a JSON array of strings. Use one element for single
correct and integer type.`;

/**
 * Two genuinely different routes to the answer. Same model, different method and temperature,
 * so agreement between them is evidence rather than an echo.
 */
export const SOLVER_METHODS = {
  direct: `Method: solve it the standard way, from the governing principle to a final value,
then match that value to an option.`,
  elimination: `Method: do NOT solve it the textbook way. Test each option on its own merits
(substitute it back, check units, limiting cases, sign, order of magnitude, or the fact it
claims) and eliminate options until the answer is forced. For integer type, reach the number
by a different route than the obvious one (energy instead of force, a different reference
frame, a dimensional or limiting case check) and state it.`,
} as const;
export type SolverMethod = keyof typeof SOLVER_METHODS;

const SOLVER_USER = `{{method}}

Subject: {{subject}} · Chapter: {{chapter}} · Type: {{questionType}}

<question>
{{stem_text}}
</question>

<options>
{{options}}
</options>

Return JSON only.`;

export function solverUser(p: ParsedQuestion, method: SolverMethod = 'direct'): string {
  return fill(SOLVER_USER, {
    method: SOLVER_METHODS[method],
    subject: p.subject, chapter: p.chapter, questionType: p.type,
    stem_text: p.stemText, options: optionsText(p),
  });
}

export const SolverZ = z.object({
  solvable: z.boolean(),
  missing: z.string().nullable(),
  answer: z.array(z.string()).nullable(),
  value: z.string().nullable(),
  steps: z.array(z.string()).max(8),
  confidence: z.number().min(0).max(1),
  option_flags: z.array(z.object({ label: z.string(), issue: z.enum(['blank', 'cut_off', 'duplicate']) })),
});
export type Solve = z.infer<typeof SolverZ>;

export const SOLVER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    solvable: { type: Type.BOOLEAN },
    missing: { type: Type.STRING, nullable: true },
    answer: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
    value: { type: Type.STRING, nullable: true },
    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.NUMBER },
    option_flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { label: { type: Type.STRING }, issue: { type: Type.STRING, enum: ['blank', 'cut_off', 'duplicate'] } },
        required: ['label', 'issue'],
      },
    },
  },
  required: ['solvable', 'missing', 'answer', 'value', 'steps', 'confidence', 'option_flags'],
  propertyOrdering: ['solvable', 'missing', 'steps', 'value', 'answer', 'confidence', 'option_flags'],
};

