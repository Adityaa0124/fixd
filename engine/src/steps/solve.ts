import type { ParsedQuestion } from '../parse';
import { callJson } from '../llm/client';
import { MODELS } from '../llm/models';
import { SOLVER_SCHEMA, SOLVER_SYSTEM, SOLVER_VERSION, SolverZ, solverUser, type Solve } from '../prompts/solver';

/** Two independent solves. Different variant keys so the cache keeps both; temperature 0.2 gives diversity. */
export async function blindSolve(p: ParsedQuestion): Promise<Solve[]> {
  const user = solverUser(p);
  const run = (variant: string) => callJson({
    purpose: 'solve', model: MODELS.solver, system: SOLVER_SYSTEM, user,
    schema: SOLVER_SCHEMA, zod: SolverZ, temperature: 0.2, variant, promptVersion: SOLVER_VERSION,
  }).then((r) => r.data);
  return Promise.all([run('solve-1'), run('solve-2')]);
}

