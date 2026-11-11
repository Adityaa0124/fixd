import fs from 'node:fs';
import path from 'node:path';
import type { Edit, RepairKey } from '@fixd/shared';
import { sameAnswer, fromSolver, answerToString } from '@fixd/shared';
import { ROOT, type Dataset } from '../data';
import { parseQuestion, type ParsedQuestion } from '../parse';
import { staticChecks } from '../checks/static';
import { blindSolve } from '../steps/solve';
import { triage } from '../steps/triage';
import { guard } from '../guard';
import type { CaseOut } from './types';
import { callJson } from '../llm/client';
import { MODELS } from '../llm/models';
import { PROOFREAD_SCHEMA, PROOFREAD_SYSTEM, PROOFREAD_VERSION, ProofreadZ, proofreadUser } from '../prompts/proofread';

/**
 * Defects nobody reported. Three sources:
 *  static   deterministic checks over all 43 questions
 *  noticed  other_issues the triage model saw on reported questions, beyond what was reported
 *  proofread one editorial pass per question over all 43 (spelling, markup, notation, wrong facts)
 *  sweep    blind solve x2 + report free triage on the questions nobody reported
 * Status is computed, never hand set: verified (guard passed and confident, or a certain static
 * fact), candidate (needs a human), rejected (an edit was proposed and the guard refused it).
 */
export interface SweepFinding {
  questionId: string;
  qid: string | null;
  subject: string;
  chapter: string;
  questionReported: boolean;
  source: 'static' | 'noticed' | 'proofread' | 'sweep' | 'key_check';
  repair: string | null;
  edit: Edit | null;
  note: string;
  confidence: number;
  guardOk: boolean;
  guardErrors: string[];
  status: 'verified' | 'candidate' | 'rejected';
}

const MECHANICAL: Record<string, string> = { '\\AA': 'Å' };

function judge(p: ParsedQuestion, ds: Dataset, repair: string | null, edit: Edit | null) {
  const spec = repair ? ds.taxonomy.repairs[repair as RepairKey] : undefined;
  if (!spec) return { guardOk: false, guardErrors: [`unknown repair ${repair}`], edit: null };
  if (spec.fields.length === 0) return { guardOk: true, guardErrors: [], edit: null };
  if (!edit || (!edit.find && !edit.replace)) return { guardOk: false, guardErrors: ['no edit proposed'], edit: null };
  const g = guard({ repair, edit, extra: [], p, taxonomy: ds.taxonomy });
  return { guardOk: g.ok, guardErrors: g.errors, edit: g.ok ? g.edits[0]! : edit };
}

function status(guardOk: boolean, errors: string[], confidence: number, hadEdit: boolean): SweepFinding['status'] {
  if (!guardOk && hadEdit && errors.length && errors[0] !== 'no edit proposed') return 'rejected';
  return guardOk && confidence >= 0.85 ? 'verified' : 'candidate';
}

export async function runSweep(ds: Dataset): Promise<SweepFinding[]> {
  const out: SweepFinding[] = [];
  const reported = new Set(ds.reports.map((r) => r.questionId));
  const casesFile = path.join(ROOT, 'engine/out/cases.json');
  const cases: CaseOut[] = fs.existsSync(casesFile) ? JSON.parse(fs.readFileSync(casesFile, 'utf8')) : [];
  const caseOf = new Map(cases.map((c) => [c.questionId, c]));
  const base = (p: ParsedQuestion) => ({
    questionId: p.id, qid: p.qid, subject: p.subject, chapter: p.chapter, questionReported: reported.has(p.id),
  });
  const push = (p: ParsedQuestion, source: SweepFinding['source'], repair: string | null, edit: Edit | null, note: string, confidence: number) => {
    const j = judge(p, ds, repair, edit);
    out.push({ ...base(p), source, repair, edit: j.edit ?? edit, note, confidence,
      guardOk: j.guardOk, guardErrors: j.guardErrors, status: status(j.guardOk, j.guardErrors, confidence, !!edit) });
  };

  // A. Static facts, every question.
  for (const rec of ds.questions) {
    const p = parseQuestion(rec);
    for (const f of staticChecks(p)) {
      if (!f.certain || f.code === 'already_fixed_candidate' || !f.suggestedRepair) continue;
      const mech = f.findCandidate && MECHANICAL[f.findCandidate.trim()];
      const edit = f.suggestedEdit
        ?? (mech ? { field: f.field, find: f.findCandidate!, replace: mech } as Edit : null)
        ?? (f.suggestedRepair === 'exam_reference' && f.findCandidate ? { field: f.field, find: f.findCandidate, replace: '' } as Edit : null);
      push(p, 'static', f.suggestedRepair, edit, `${f.code}: ${f.detail}`, 0.95);
    }
  }

  // B. Noticed on reported questions, beyond what the reports were about. No network.
  for (const c of cases) {
    const rec = ds.byId.get(c.questionId);
    if (!rec) continue;
    const p = parseQuestion(rec);
    for (const o of c.otherIssues ?? []) {
      const edit = o.find || o.replace ? ({ field: o.field, find: o.find, replace: o.replace } as Edit) : null;
      push(p, 'noticed', o.repair, edit, o.note, 0.85);
    }
  }

  // C. Proofread every question. Cheap model, editorial defects only, every edit through the guard.
  const recs = ds.questions;
  let idx = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const rec = recs[idx++];
      if (!rec) return;
      const p = parseQuestion(rec);
      const r = await callJson({
        purpose: 'sweep', model: MODELS.fast, system: PROOFREAD_SYSTEM, user: proofreadUser(p),
        schema: PROOFREAD_SCHEMA, zod: ProofreadZ, temperature: 0, variant: 'proofread', promptVersion: PROOFREAD_VERSION,
      });
      for (const i of r.data.issues) {
        const edit = i.find || i.replace ? ({ field: i.field, find: i.find, replace: i.replace } as Edit) : null;
        push(p, 'proofread', i.repair, edit, i.note, i.confidence);
      }
    }
  }));

  // D. Questions nobody reported: two blind solves plus report free triage.
  for (const rec of ds.questions.filter((q) => !reported.has(q._id))) {
    const p = parseQuestion(rec);
    const solves = await blindSolve(p);
    const t = await triage({ p, taxonomy: ds.taxonomy, findings: staticChecks(p), solves, reports: [], purpose: 'sweep' });
    const [s1, s2] = solves.map((s) => fromSolver(p.type, s.answer));
    if (s1 && s2 && solves.every((s) => s.solvable) && sameAnswer(s1, s2) && !sameAnswer(s1, p.answer)) {
      push(p, 'key_check', 'answer_key', { field: 'answer', find: answerToString(p.answer), replace: answerToString(s1) },
        `Both blind solves give ${answerToString(s1)}; key is ${answerToString(p.answer)}; stored solution concludes ${t.solution_final_answer ?? 'nothing'}.`,
        Math.min(...solves.map((s) => s.confidence), 0.8));
    }
    if (t.question_verdict === 'defect') push(p, 'sweep', t.repair, t.edit, t.evidence, t.confidence);
    for (const o of t.other_issues) {
      const edit = o.find || o.replace ? ({ field: o.field, find: o.find, replace: o.replace } as Edit) : null;
      push(p, 'sweep', o.repair, edit, o.note, 0.8);
    }
  }

  // Drop anything a report already covers: same question and same repair as the reported case.
  const fresh = out.filter((f) => {
    const c = caseOf.get(f.questionId);
    if (!c) return true;
    if (c.repair && f.repair === c.repair) return false;
    // The reported fix already rewrites the answer field; a static answer finding is the same defect.
    if (f.source === 'static' && f.repair === 'answer_key' && c.edits.some((e) => e.field === 'answer')) return false;
    return !c.edits.some((e) => f.edit && e.find.trim() === f.edit.find.trim());
  });

  // One finding per question + repair + normalized find; prefer verified, then confidence.
  const rank = { verified: 2, candidate: 1, rejected: 0 } as const;
  // Key on the changed core (common prefix and suffix stripped), so "\AA" and "<mi>\AA</mi>" are one defect.
  const core = (e: Edit) => {
    let i = 0; while (i < e.find.length && e.find[i] === e.replace[i]) i++;
    let j = 0; while (j < e.find.length - i && j < e.replace.length - i && e.find[e.find.length - 1 - j] === e.replace[e.replace.length - 1 - j]) j++;
    const removed = e.find.slice(i, e.find.length - j).replace(/<[^>]*>/g, '').trim().toLowerCase();
    return removed || e.find.replace(/<[^>]*>/g, '').trim().toLowerCase();   // pure insertion: key on its context
  };
  // Repairs with no edit (wrong_chapter) are one finding per question, whoever found them.
  const key = (f: SweepFinding) => `${f.questionId}|${f.repair}|${f.edit ? core(f.edit) : ''}`;
  const best = new Map<string, SweepFinding>();
  for (const f of fresh) {
    const b = best.get(key(f));
    if (!b || rank[f.status] > rank[b.status] || (rank[f.status] === rank[b.status] && f.confidence > b.confidence)) best.set(key(f), f);
  }
  // A static "something is wrong here" without an edit adds nothing once a verified edit covers that question and repair.
  const kept = [...best.values()].filter((f) => f.edit || f.status !== 'candidate' ||
    ![...best.values()].some((o) => o !== f && o.edit && o.status === 'verified' && o.questionId === f.questionId && o.repair === f.repair));
  return kept.sort((a, b) => rank[b.status] - rank[a.status] || b.confidence - a.confidence);
}
