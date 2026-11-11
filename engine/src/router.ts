import {
  answerToString, fromSolver, normalizeAnswer, sameAnswer, type Answer, type Gate, type RepairKey, type Route, type Snapshot, type Taxonomy,
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
  /** Stem or option repairs only: two fresh blind solves of the question AFTER the edit. */
  postFix?: { solve1: string | null; solve2: string | null; agree: boolean; matchKey: boolean };
}

/** Repairs that make an unsolvable question solvable; verified by solving the repaired question. */
export const VERIFY_BY_RESOLVE = new Set<RepairKey>(['stem_data', 'option_repair']);

export function postFixAgreement(p: ParsedQuestion, solves: Solve[]): NonNullable<Agreement['postFix']> {
  const a1 = fromSolver(p.type, solves[0]?.answer);
  const a2 = fromSolver(p.type, solves[1]?.answer);
  const show = (a: Answer) => (a.kind === 'invalid' ? null : a.kind === 'multi' ? a.values.join(',') : a.value);
  return { solve1: show(a1), solve2: show(a2), agree: sameAnswer(a1, a2), matchKey: sameAnswer(a1, p.answer) && sameAnswer(a2, p.answer) };
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

/** Repairs whose correctness depends on what the right answer is. The rest are editorial. */
export const ANSWER_SENSITIVE = new Set<RepairKey>(['answer_key', 'solution_fix', 'solution_missing', 'stem_data', 'option_repair', 'type_mismatch']);

const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const nums = (s: string) => s.match(/\d+(?:\.\d+)?/g) ?? [];

/** Confidence after evidence checks: answer sensitive repairs cannot be confident when the blind solves disagree. */
export function effectiveConfidence(t: Triage, agree: Agreement): number {
  const sensitive = t.repair ? ANSWER_SENSITIVE.has(t.repair as RepairKey) : false;
  // Missing data makes the original unsolvable; then the post fix solves are the evidence that counts.
  const evidenceAgrees = agree.postFix ? agree.postFix.agree && agree.postFix.matchKey : agree.solvesAgree;
  const c = sensitive && !evidenceAgrees ? Math.min(t.confidence, 0.7) : t.confidence;
  return Math.round(c * 100) / 100;
}

/** True when an answer_key edit keeps the same letters and only fixes how they are stored. */
export function isFormatOnlyKeyFix(p: ParsedQuestion, after: Snapshot | null): boolean {
  if (!after) return false;
  const before = p.answer;
  const next = normalizeAnswer(after.questionType, after.answer);
  return before.kind !== 'invalid' && sameAnswer(before, next) && JSON.stringify(p.answerRaw) !== JSON.stringify(after.answer);
}

export function route(args: {
  t: Triage; g: GuardResult | null; agree: Agreement; p: ParsedQuestion; taxonomy: Taxonomy; injected: boolean;
  confidence: number;
}): { route: Route; gates: Gate[] } {
  const { t, g, agree, p, taxonomy } = args;
  const gates: Gate[] = [];
  const gate = (name: Gate['name'], pass: boolean, detail: string) => { gates.push({ name, pass, detail }); return pass; };

  if (!gate('verdict', t.question_verdict === 'defect', `verdict ${t.question_verdict}`)) return { route: 'no_change', gates };

  const repair = t.repair as RepairKey | null;
  const spec = repair ? taxonomy.repairs[repair] : undefined;
  let ok = gate('taxonomy', !!spec?.auto, spec ? `${repair} is auto: ${spec.auto}` : `unknown repair ${repair}`);
  ok = gate('guard', !!g?.ok && !!g.after, g?.ok ? 'edit in scope and applies cleanly' : (g?.errors.join('; ') || 'no edit')) && ok;
  ok = gate('confidence', args.confidence >= AUTO_CONFIDENCE, `${args.confidence.toFixed(2)} vs ${AUTO_CONFIDENCE}`) && ok;
  ok = gate('provenance', !args.injected, args.injected ? 'the only reports on this question are flagged (injection or gibberish)' : 'driven by a genuine report or a static check') && ok;

  if (repair === 'answer_key' && isFormatOnlyKeyFix(p, g?.after ?? null)) {
    const keyOk = agree.solvesMatchKey || (agree.solutionMatchesProposed ?? false) || sameAnswer(normalizeAnswer(p.type, t.solution_final_answer ?? ''), p.answer);
    ok = gate('agreement', keyOk, `format fix only, same letters; solves ${agree.solve1}/${agree.solve2}, solution ${t.solution_final_answer ?? 'none'}`) && ok;
  } else if (repair === 'answer_key') {
    const agreeOk = agree.solvesAgree && agree.solvesMatchProposed === true && agree.solutionMatchesProposed === true;
    ok = gate('agreement', agreeOk,
      `solves ${agree.solve1}/${agree.solve2}, solution ${t.solution_final_answer ?? 'none'}, proposed ${g?.after ? JSON.stringify(g.after.answer) : 'none'}`) && ok;
    ok = gate('subject', !RECALL_SUBJECTS.has(p.subject), `${p.subject}${RECALL_SUBJECTS.has(p.subject) ? ' answer keys always go to faculty' : ''}`) && ok;
  }
  if (repair === 'option_repair') {
    // Verified in code, not taken from the model: every number in the restored text must appear in the stored solution.
    const e = g?.edits[0];
    const added = e ? stripTags(e.replace).replace(stripTags(e.find), '').trim() : '';
    const solution = stripTags(p.solutionRaw) + ' ' + p.solutionText;
    const n = nums(added);
    const fromSolution = added.length > 0 && n.length > 0 && n.every((x) => new RegExp(`(?<![\\d.])${x.replace('.', '\\.')}(?![\\d])`).test(solution));
    const verified = !!agree.postFix?.agree && !!agree.postFix?.matchKey;
    ok = gate('option_source', fromSolution || verified,
      `restored "${added.slice(0, 40)}": ${fromSolution ? 'values stated in the solution' : 'values not literally in the solution'}${verified ? ', and the repaired question solves to the key' : ''}`) && ok;
  }
  if (repair && VERIFY_BY_RESOLVE.has(repair)) {
    const pf = agree.postFix;
    ok = gate('verification', !!pf?.agree && !!pf?.matchKey,
      pf ? `after the fix, blind solves give ${pf.solve1}/${pf.solve2}; key ${answerToString(p.answer)}` : 'repaired question not re-solved') && ok;
  }
  if (repair === 'solution_fix' || repair === 'solution_missing') {
    ok = gate('agreement', agree.solvesAgree && agree.solvesMatchKey, `solves ${agree.solve1}/${agree.solve2} vs key`) && ok;
  }
  return { route: ok ? 'auto_apply' : 'faculty_review', gates };
}

