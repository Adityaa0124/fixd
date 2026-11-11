import {
  letters, urgency, type CommentFlag, type Edit, type RawReport, type ResultRow, type RepairKey, type Route, type Verdict,
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
import { agreement, effectiveConfidence, postFixAgreement, route as routeCase, VERIFY_BY_RESOLVE } from '../router';
import { MODELS } from '../llm/models';
import { SOLVER_VERSION } from '../prompts/solver';
import { TRIAGE_VERSION } from '../prompts/triage';
import { REPLY_VERSION } from '../prompts/reply';
import type { Triage } from '../prompts/triage';
import type { CaseOut } from './types';

function fixSummary(edits: Edit[], route: Route): string {
  if (!edits.length) return 'none';
  const e = edits[0]!;
  const what = e.field === 'answer' ? `answer key changed from ${e.find} to ${e.replace}` : `${e.field} corrected`;
  return route === 'auto_apply' ? `${what} (live now)` : `${what} (waiting for a teacher to approve)`;
}

const COT = /\b(wait|hmm|let'?s re-?(?:evaluate|check|read)|let me|re-?evaluat\w*|actually,|on second thought)\b/i;

/** Evidence is shown to faculty and students; keep conclusions, drop any thinking out loud. */
export function cleanEvidence(s: string): string {
  const sentences = s.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter(Boolean);
  const kept = sentences.filter((x) => !COT.test(x));
  const out = (kept.length ? kept : sentences.slice(-1)).slice(-3).join(' ');
  return out.replace(/[—–]/g, ',').trim();
}

const NO_FIELD = (taxonomy: Dataset['taxonomy'], repair: string | null) =>
  !!repair && (taxonomy.repairs[repair as RepairKey]?.fields.length ?? 1) === 0;

function guarded(ds: Dataset, p: ReturnType<typeof parseQuestion>, t: Triage) {
  if (t.question_verdict !== 'defect') return null;
  if (NO_FIELD(ds.taxonomy, t.repair)) { t.edit = null; t.extra_edits = []; }
  if (t.repair === 'type_mismatch' && t.edit && !t.extra_edits.some((e) => e.field === 'answer')) {
    // Switching type must leave a key valid for the new type. Add the mechanical answer rewrite.
    const ls = letters(p.answerRaw);
    if (t.edit.replace === 'scq' && ls.length === 1) {
      t.extra_edits.push({ field: 'answer', find: JSON.stringify(p.answerRaw), replace: ls[0]! });
    }
  }
  return guard({ repair: t.repair, edit: t.edit, extra: t.extra_edits, p, taxonomy: ds.taxonomy });
}

export async function runCase(ds: Dataset, g: CaseGroup): Promise<CaseOut> {
  const rec = ds.byId.get(g.questionId)!;
  const p = parseQuestion(rec);
  const findings = staticChecks(p);
  const inputs = g.reports.map((report) => ({ report, s: sanitizeComment(report.comment) }));
  // Provenance: a question is only "driven by a flagged comment" when no genuine report exists.
  const injected = inputs.every((i) => i.s.flags.includes('injection') || i.s.flags.includes('gibberish'));

  const solves = await blindSolve(p);
  let t = await triage({ p, taxonomy: ds.taxonomy, findings, solves, reports: inputs });
  let gr = guarded(ds, p, t);
  const rejected: Edit[] = [];

  if (gr && !gr.ok && t.edit) {
    const retryNote = `The scope guard rejected your edit: ${gr.errors.join('; ')}. ` +
      'Copy find exactly from <raw_question> or <raw_solution>, keep the edit inside the allowed fields, or set edit to null.';
    const t2 = await triage({ p, taxonomy: ds.taxonomy, findings, solves, reports: inputs, retryNote });
    const gr2 = guarded(ds, p, t2);
    if (gr2 && (gr2.ok || !t2.edit) && t2.question_verdict === 'defect') { t = t2; gr = gr2; }
    else {
      // Keep the first judgement, but never ship an edit the guard refused.
      rejected.push(t.edit, ...t.extra_edits);
      t = { ...t, edit: null, extra_edits: [] };
    }
  }

  const agree = agreement(p, solves, t, gr?.ok ? gr.after : null);
  if (gr?.ok && gr.after && t.edit && VERIFY_BY_RESOLVE.has(t.repair as RepairKey)) {
    // Close the loop: solve the repaired question blind. If it now lands on the key, the fix is verified.
    const body = rec[rec.questionType]!;
    const fixed = parseQuestion({ ...rec, [rec.questionType]: { ...body, question: gr.after.question, solution: gr.after.solution } });
    agree.postFix = postFixAgreement(fixed, await blindSolve(fixed));
  }
  const confidence = effectiveConfidence(t, agree);
  const { route, gates } = routeCase({ t, g: gr, agree, p, taxonomy: ds.taxonomy, injected, confidence });
  const edits = gr?.ok && t.edit ? gr.edits : [];
  const evidence = cleanEvidence(t.evidence);

  const reports: CaseOut['reports'] = [];
  for (const { report, s } of inputs) {
    const pr = t.per_report.find((x) => x.reportId === report.reportId)!;
    let verdict = pr.verdict as Verdict;
    if (t.question_verdict === 'defect' && verdict === 'no_error') verdict = 'defect';
    if (t.question_verdict !== 'defect' && (s.flags.includes('injection') || s.flags.includes('gibberish'))) verdict = 'not_actionable';
    // Taxonomy: not_actionable is for empty or unintelligible comments. "wrong" is a claim; if the record checks out it is no_error.
    if (verdict === 'not_actionable' && !s.flags.includes('injection') && !s.flags.includes('gibberish') && s.text.trim()) verdict = 'no_error';
    const rRoute: Route = verdict === 'defect' ? route : 'no_change';
    const studentWasRight = verdict === 'defect' ? pr.student_was_right : false;
    const reply = await writeReply({
      verdict, route: rRoute, studentWasRight, evidence,
      fixSummary: verdict === 'defect' ? fixSummary(edits, rRoute) : 'none', lang: s.lang, comment: s.text,
    });
    reports.push({
      reportId: report.reportId, studentId: report.studentId, source: report.source, reportedAt: report.reportedAt,
      comment: report.comment, flags: s.flags as CommentFlag[], lang: s.lang, verdict, route: rRoute,
      studentClaim: pr.student_claim, studentWasRight, reply,
    });
  }

  const caseVerdict = t.question_verdict as Verdict;
  return {
    questionId: p.id, qid: p.qid, subject: p.subject, chapter: p.chapter, questionType: p.type,
    verdict: caseVerdict, repair: caseVerdict === 'defect' ? (t.repair as RepairKey | null) ?? null : null,
    edit: edits[0] ?? null, edits, editsRejected: rejected, route, gates, confidence, evidence, agreement: agree, solves,
    solutionFinalAnswer: t.solution_final_answer, findings, otherIssues: t.other_issues,
    guardErrors: gr?.errors ?? [], before: p.snapshot, after: edits.length ? gr?.after ?? null : null,
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
  const out: CaseOut[] = new Array(groups.length);
  const workers = Math.max(1, Number(process.env.FIXD_CASE_CONCURRENCY ?? 4));
  let next = 0, done = 0;
  // A small pool across cases; the per model limiter in llm/client still caps request rate.
  await Promise.all(Array.from({ length: workers }, async () => {
    for (;;) {
      const i = next++;
      if (i >= groups.length) return;
      const g = groups[i]!;
      const t0 = Date.now();
      const c = await runCase(ds, g);
      out[i] = c;
      console.log(`[${++done}/${groups.length}] ${g.questionId.slice(-4)} ${c.verdict}/${c.repair ?? '-'} → ${c.route} (${Date.now() - t0} ms)`);
    }
  }));
  return out;
}
