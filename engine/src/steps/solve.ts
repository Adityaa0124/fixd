import type { ParsedQuestion } from '../parse';
import { callJson } from '../llm/client';
import { MODELS } from '../llm/models';
import { SOLVER_SCHEMA, SOLVER_SYSTEM, SOLVER_VERSION, SolverZ, solverUser, type Solve, type SolverMethod } from '../prompts/solver';

/**
 * Two blind solves that differ in method and temperature, never in what they are shown:
 * neither sees the answer key, the stored solution or any student comment.
 */
export async function blindSolve(p: ParsedQuestion): Promise<Solve[]> {
  const run = (method: SolverMethod, temperature: number) => callJson({
    purpose: 'solve', model: MODELS.solver, system: SOLVER_SYSTEM, user: solverUser(p, method),
    schema: SOLVER_SCHEMA, zod: SolverZ, temperature, variant: method, promptVersion: SOLVER_VERSION,
  }).then((r) => r.data);
  return Promise.all([run('direct', 0.2), run('elimination', 0.7)]);
}
