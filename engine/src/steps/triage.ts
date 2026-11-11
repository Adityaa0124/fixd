import type { Taxonomy } from '@fixd/shared';
import type { ParsedQuestion } from '../parse';
import type { Finding } from '../checks/static';
import { callJson } from '../llm/client';
import { MODELS } from '../llm/models';
import { TRIAGE_SCHEMA, TRIAGE_SYSTEM, TRIAGE_VERSION, TriageZ, triageUser, type Triage, type TriageReportInput } from '../prompts/triage';
import type { Solve } from '../prompts/solver';

export async function triage(args: {
  p: ParsedQuestion; taxonomy: Taxonomy; findings: Finding[]; solves: Solve[];
  reports: TriageReportInput[]; retryNote?: string; purpose?: 'triage' | 'sweep';
}): Promise<Triage> {
  const r = await callJson({
    purpose: args.purpose ?? 'triage', model: MODELS.fast, system: TRIAGE_SYSTEM,
    user: triageUser(args), schema: TRIAGE_SCHEMA, zod: TriageZ, temperature: 0,
    variant: args.retryNote ? 'retry' : undefined, promptVersion: TRIAGE_VERSION,
  });
  const t = r.data;
  // Contract: one per_report row per input report. Fill gaps instead of failing the run.
  for (const { report } of args.reports) {
    if (!t.per_report.some((x) => x.reportId === report.reportId)) {
      t.per_report.push({ reportId: report.reportId, verdict: t.question_verdict, comment_flag: 'none',
        student_claim: '', student_was_right: t.question_verdict === 'defect' });
    }
  }
  return t;
}

