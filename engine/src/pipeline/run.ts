import {
  urgency, type CommentFlag, type Edit, type RawReport, type ResultRow, type RepairKey, type Route, type Verdict,
} from '@fixd/shared';
import type { Dataset } from '../data';
import { parseQuestion } from '../parse';
import { staticChecks } from '../checks/static';
import { sanitizeComment } from '../sanitize';
import { groupReports, type CaseGroup } from '../group';
import { blindSolve } from '../steps/solve';
import { triage } from '../steps/triage';
import { writeReply } from '../steps/reply';
import { guard } from '../guard';
import { agreement, route as routeCase } from '../router';
import { MODELS } from '../llm/models';
import { SOLVER_VERSION } from '../prompts/solver';
import { TRIAGE_VERSION } from '../prompts/triage';
import { REPLY_VERSION } from '../prompts/reply';
import type { CaseOut } from './types';

function fixSummary(edits: Edit[], route: Route): string {
  if (!edits.length) return 'none';
  const e = edits[0]!;
  const what = e.field === 'answer' ? `answer key changed from ${e.find} to ${e.replace}` : `${e.field} corrected`;
  return route === 'auto_apply' ? `${what} (live now)` : `${what} (waiting for a teacher to approve)`;
}

export async function runCase(ds: Dataset, g: CaseGroup): Promise<CaseOut> {
  const rec = ds.byId.get(g.questionId)!;
  const p = parseQuestion(rec);
  const findings = staticChecks(p);
  const inputs = g.reports.map((report) => ({ report, s: sanitizeComment(report.comment) }));
  const injected = inputs.some((i) => i.s.flags.includes('injection'));

  const solves = await blindSolve(p);
  let t = await triage({ p, taxonomy: ds.taxonomy, findings, solves, reports: inputs });

  let gr = t.question_verdict === 'defect'
    ? guard({ repair: t.repair, edit: t.edit, extra: t.extra_edits, p, taxonomy: ds.taxonomy })
    : null;
  if (gr && !gr.ok && t.edit) {
    const retryNote = `The scope guard rejected your edit: ${gr.errors.join('; ')}. ` +
      'Copy find exactly from <raw_fields>, keep the edit inside the allowed fields, or set edit to null.';
    t = await triage({ p, taxonomy: ds.taxonomy, findings, solves, reports: inputs, retryNote });
    gr = t.question_verdict === 'defect'
      ? guard({ repair: t.repair, edit: t.edit, extra: t.extra_edits, p, taxonomy: ds.taxonomy })
      : null;
  }

  const agree = agreement(p, solves, t, gr?.after ?? null);
  const { route, gates } = routeCase({ t, g: gr, agree, p, taxonomy: ds.taxonomy, injected });
  const confidence = Math.round((agree.solvesAgree ? t.confidence : Math.min(t.confidence, 0.7)) * 100) / 100;
  const edits = gr?.ok ? gr.edits : (t.edit ? [t.edit, ...t.extra_edits] : []);
  const evidence = t.evidence + (gr && !gr.ok ? ` Guard: ${gr.errors[0]}.` : '');

  const reports: CaseOut['reports'] = [];
  for (const { report, s } of inputs) {
    const pr = t.per_report.find((x) => x.reportId === report.reportId)!;
    let verdict = pr.verdict as Verdict;
    if (t.question_verdict === 'defect' && verdict === 'no_error') verdict = 'defect';
    if (t.question_verdict !== 'defect' && (s.flags.includes('injection') || s.flags.includes('gibberish'))) verdict = 'not_actionable';
    const rRoute: Route = verdict === 'defect' ? route : 'no_change';
    const reply = await writeReply({
      verdict, route: rRoute, studentWasRight: pr.student_was_right, evidence,
      fixSummary: verdict === 'defect' ? fixSummary(edits, rRoute) : 'none', lang: s.lang, comment: s.text,
    });
    reports.push({
      reportId: report.reportId, studentId: report.studentId, source: report.source, reportedAt: report.reportedAt,
      comment: report.comment, flags: s.flags as CommentFlag[], lang: s.lang, verdict, route: rRoute,
      studentClaim: pr.student_claim, studentWasRight: pr.student_was_right, reply,
    });
  }

  const caseVerdict = t.question_verdict as Verdict;
  return {
    questionId: p.id, qid: p.qid, subject: p.subject, chapter: p.chapter, questionType: p.type,
    verdict: caseVerdict, repair: (t.repair as RepairKey | null) ?? null,
    edit: edits[0] ?? null, edits, route, gates, confidence, evidence, agreement: agree, solves,
    solutionFinalAnswer: t.solution_final_answer, findings, otherIssues: t.other_issues,
    guardErrors: gr?.errors ?? [], before: p.snapshot, after: gr?.after ?? null,
    urgency: urgency({ verdict: caseVerdict, repair: t.repair as RepairKey | null, route, confidence,
      studentsAffected: new Set(g.reports.map((r) => r.studentId)).size, firstReportedAt: g.firstReportedAt }),
    firstReportedAt: g.firstReportedAt, reports,
    engine: { solver: SOLVER_VERSION, triage: TRIAGE_VERSION, reply: REPLY_VERSION, models: MODELS },
  };
}

export function toResults(cases: CaseOut[]): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const c of cases) for (const r of c.reports) {
    const isDefect = r.verdict === 'defect';
    rows.push({
      reportId: r.reportId,
      questionId: c.questionId,
      verdict: r.verdict,
      repair: isDefect ? c.repair : null,
      edit: isDefect ? c.edit : null,
      route: r.route,
      confidence: c.confidence,
      evidence: c.evidence,
      student_reply: r.reply,
    });
  }
  return rows.sort((a, b) => a.reportId.localeCompare(b.reportId, 'en', { numeric: true }));
}

export async function runAll(ds: Dataset, only?: Set<string>): Promise<CaseOut[]> {
  const groups = groupReports(ds.reports).filter((g) => !only || [...only].some((s) => g.questionId.endsWith(s)));
  const out: CaseOut[] = [];
  let i = 0;
  // Sequential per case keeps the limiter simple and logs readable; solves inside a case run in parallel.
  for (const g of groups) {
    i++;
    const t0 = Date.now();
    try {
      out.push(await runCase(ds, g));
      const c = out[out.length - 1]!;
      console.log(`[${i}/${groups.length}] ${g.questionId.slice(-4)} ${c.verdict}/${c.repair ?? '-'} → ${c.route} (${Date.now() - t0} ms)`);
    } catch (err) {
      console.error(`[${i}/${groups.length}] ${g.questionId.slice(-4)} FAILED: ${(err as Error).message}`);
      throw err;
    }
  }
  return out;
}

