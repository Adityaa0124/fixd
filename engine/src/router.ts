import {
  fromSolver, normalizeAnswer, sameAnswer, type Answer, type Gate, type RepairKey, type Route, type Snapshot, type Taxonomy,
} from '@fixd/shared';
import type { ParsedQuestion } from './parse';
import type { Solve } from './prompts/solver';
import type { Triage } from './prompts/triage';
import type { GuardResult } from './guard';

export const AUTO_CONFIDENCE = 0.85;
const RECALL_SUBJECTS = new Set(['Botany', 'Zoology', 'Biology']);

export interface Agreement {
  solve1: string | null;
  solve2: string | null;
  solvesAgree: boolean;
  solvesMatchKey: boolean;
  solvesMatchProposed: boolean | null;
  solutionMatchesProposed: boolean | null;
  solvable: boolean;
}

export function agreement(p: ParsedQuestion, solves: Solve[], t: Triage, after: Snapshot | null): Agreement {
  const a1 = fromSolver(p.type, solves[0]?.answer);
  const a2 = fromSolver(p.type, solves[1]?.answer);
  const proposed: Answer | null = after && t.repair === 'answer_key' ? normalizeAnswer(after.questionType, after.answer) : null;
  const sol: Answer | null = t.solution_final_answer ? normalizeAnswer(p.type, t.solution_final_answer) : null;
  const show = (a: Answer) => (a.kind === 'invalid' ? null : a.kind === 'multi' ? a.values.join(',') : a.value);
  return {
    solve1: show(a1), solve2: show(a2),
    solvesAgree: sameAnswer(a1, a2),
    solvesMatchKey: sameAnswer(a1, p.answer) && sameAnswer(a2, p.answer),
    solvesMatchProposed: proposed ? sameAnswer(a1, proposed) && sameAnswer(a2, proposed) : null,
    solutionMatchesProposed: proposed && sol ? sameAnswer(sol, proposed) : null,
    solvable: solves.every((s) => s.solvable),
  };
}

export function route(args: {
  t: Triage; g: GuardResult | null; agree: Agreement; p: ParsedQuestion; taxonomy: Taxonomy; injected: boolean;
}): { route: Route; gates: Gate[] } {
  const { t, g, agree, p, taxonomy } = args;
  const gates: Gate[] = [];
  const gate = (name: Gate['name'], pass: boolean, detail: string) => { gates.push({ name, pass, detail }); return pass; };

  if (!gate('verdict', t.question_verdict === 'defect', `verdict ${t.question_verdict}`)) return { route: 'no_change', gates };

  const repair = t.repair as RepairKey | null;
  const spec = repair ? taxonomy.repairs[repair] : undefined;
  let ok = gate('taxonomy', !!spec?.auto, spec ? `${repair} is auto: ${spec.auto}` : `unknown repair ${repair}`);
  ok = gate('guard', !!g?.ok && !!g.after, g?.ok ? 'edit in scope and applies cleanly' : (g?.errors.join('; ') || 'no edit')) && ok;
  ok = gate('confidence', t.confidence >= AUTO_CONFIDENCE, `${t.confidence.toFixed(2)} vs ${AUTO_CONFIDENCE}`) && ok;
  ok = gate('provenance', !args.injected, args.injected ? 'a report on this question is a flagged injection attempt' : 'no flagged comments') && ok;

  if (repair === 'answer_key') {
    const agreeOk = agree.solvesAgree && agree.solvesMatchProposed === true && agree.solutionMatchesProposed === true;
    ok = gate('agreement', agreeOk,
      `solves ${agree.solve1}/${agree.solve2}, solution ${t.solution_final_answer ?? 'none'}, proposed ${g?.after ? JSON.stringify(g.after.answer) : 'none'}`) && ok;
    ok = gate('subject', !RECALL_SUBJECTS.has(p.subject), `${p.subject}${RECALL_SUBJECTS.has(p.subject) ? ' answer keys always go to faculty' : ''}`) && ok;
  }
  if (repair === 'option_repair') {
    ok = gate('option_source', t.option_text_source === 'solution' || t.option_text_source === 'solver',
      `restored option text source: ${t.option_text_source ?? 'none'}`) && ok;
  }
  if (repair === 'solution_fix' || repair === 'solution_missing') {
    ok = gate('agreement', agree.solvesAgree && agree.solvesMatchKey, `solves ${agree.solve1}/${agree.solve2} vs key`) && ok;
  }
  return { route: ok ? 'auto_apply' : 'faculty_review', gates };
}

