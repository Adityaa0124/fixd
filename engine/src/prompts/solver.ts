import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import type { ParsedQuestion } from '../parse';
import { optionsText } from '../parse';
import { fill } from './render';

export const SOLVER_VERSION = 'solver-v1.1';

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

const SOLVER_USER = `Subject: {{subject}} · Chapter: {{chapter}} · Type: {{questionType}}

<question>
{{stem_text}}
</question>

<options>
{{options}}
</options>

Return JSON only.`;

export function solverUser(p: ParsedQuestion): string {
  return fill(SOLVER_USER, {
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

