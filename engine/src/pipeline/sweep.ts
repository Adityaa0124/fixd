import fs from 'node:fs';
import path from 'node:path';
import type { Edit } from '@fixd/shared';
import { sameAnswer, fromSolver, answerToString } from '@fixd/shared';
import { ROOT, type Dataset } from '../data';
import { parseQuestion, type ParsedQuestion } from '../parse';
import { staticChecks } from '../checks/static';
import { blindSolve } from '../steps/solve';
import { triage } from '../steps/triage';
import { guard } from '../guard';
import type { CaseOut } from './types';

export interface SweepFinding {
  questionId: string;
  qid: string | null;
  subject: string;
  chapter: string;
  source: 'static' | 'triage_other_issue' | 'sweep_triage' | 'key_check';
  repair: string | null;
  edit: Edit | null;
  note: string;
  confidence: number;
  guardOk: boolean;
  guardErrors: string[];
  status: 'candidate' | 'confirmed' | 'rejected';
}

const base = (p: ParsedQuestion) => ({
  questionId: p.id,
  qid: p.qid,
  subject: p.subject,
  chapter: p.chapter,
});

function checked(p: ParsedQuestion, ds: Dataset, repair: string | null, edit: Edit | null) {
  if (!repair || !edit) return { guardOk: false, guardErrors: ['no edit'], edit: null };
  const g = guard({ repair, edit, extra: [], p, taxonomy: ds.taxonomy });
  return { guardOk: g.ok, guardErrors: g.errors, edit: g.edits[0] ?? edit };
}

export async function runSweep(ds: Dataset): Promise<SweepFinding[]> {
  const out: SweepFinding[] = [];
  const reported = new Set(ds.reports.map((r) => r.questionId));

  // A. Static, every question, certain findings only.
  for (const rec of ds.questions) {
    const p = parseQuestion(rec);
    for (const f of staticChecks(p).filter(
      (x) => x.certain && x.code !== 'already_fixed_candidate'
    )) {
      const edit = f.findCandidate
        ? ({ field: f.field, find: f.findCandidate, replace: '' } as Edit)
        : null;
      const g =
        f.suggestedRepair && edit
          ? checked(p, ds, f.suggestedRepair, edit)
          : { guardOk: false, guardErrors: ['static, no edit'], edit: null };
      out.push({
        ...base(p),
        source: 'static',
        repair: f.suggestedRepair,
        edit,
        note: `${f.code}: ${f.detail}`,
        confidence: 0.95,
        guardOk: g.guardOk,
        guardErrors: g.guardErrors,
        status: 'candidate',
      });
    }
  }

  // B. other_issues already produced by the main run. No network.
  const casesFile = path.join(ROOT, 'engine/out/cases.json');
  const cases: CaseOut[] = fs.existsSync(casesFile)
    ? JSON.parse(fs.readFileSync(casesFile, 'utf8'))
    : [];
  for (const c of cases) {
    const qRec = ds.byId.get(c.questionId);
    if (!qRec) continue;
    const p = parseQuestion(qRec);
    for (const o of c.otherIssues ?? []) {
      const oAny = o as any;
      const edit =
        oAny.edit ??
        ({ field: oAny.field, find: oAny.find, replace: oAny.replace } as Edit);
      const repair = oAny.repair ?? c.repair;
      const g = checked(p, ds, repair, edit);
      out.push({
        ...base(p),
        source: 'triage_other_issue',
        repair,
        edit: g.edit ?? edit,
        note: oAny.claim ?? oAny.note ?? '',
        confidence: 0.8,
        guardOk: g.guardOk,
        guardErrors: g.guardErrors,
        status: 'candidate',
      });
    }
  }

  // C + D. Unreported questions: full blind solve + triage with zero reports.
  for (const rec of ds.questions.filter((q) => !reported.has(q._id))) {
    const p = parseQuestion(rec);
    const findings = staticChecks(p);
    const solves = await blindSolve(p);
    const t = await triage({
      p,
      taxonomy: ds.taxonomy,
      findings,
      solves,
      reports: [],
      purpose: 'sweep',
    });

    const [s1, s2] = solves.map((s) => fromSolver(p.type, s.answer));
    if (
      s1 &&
      s2 &&
      solves.every((s) => s.solvable) &&
      sameAnswer(s1, s2) &&
      !sameAnswer(s1, p.answer)
    ) {
      out.push({
        ...base(p),
        source: 'key_check',
        repair: 'answer_key',
        edit: {
          field: 'answer',
          find: answerToString(p.answer),
          replace: answerToString(s1),
        },
        note: `Both blind solves give ${answerToString(s1)}; key is ${answerToString(p.answer)}. Solution says: ${t.solution_final_answer ?? 'n/a'}`,
        confidence: Math.min(...solves.map((s) => s.confidence)),
        guardOk: true,
        guardErrors: [],
        status: 'candidate',
      });
    }
    if (t.question_verdict === 'defect') {
      const g = checked(p, ds, t.repair, t.edit);
      out.push({
        ...base(p),
        source: 'sweep_triage',
        repair: t.repair,
        edit: g.edit ?? t.edit,
        note: t.evidence,
        confidence: t.confidence,
        guardOk: g.guardOk,
        guardErrors: g.guardErrors,
        status: 'candidate',
      });
    }
    for (const o of t.other_issues) {
      const edit = { field: o.field, find: o.find, replace: o.replace } as Edit;
      const g = checked(p, ds, o.repair, edit);
      out.push({
        ...base(p),
        source: 'sweep_triage',
        repair: o.repair,
        edit: g.edit ?? edit,
        note: o.note,
        confidence: 0.75,
        guardOk: g.guardOk,
        guardErrors: g.guardErrors,
        status: 'candidate',
      });
    }
  }

  // Dedupe: filter out reported edits first
  const reportedEdits = new Set(
    cases.flatMap((c) => c.edits.map((e) => `${c.questionId}|${e.find}`))
  );
  const fresh = out.filter(
    (f) => !f.edit || !reportedEdits.has(`${f.questionId}|${f.edit.find}`)
  );

  // Dedupe: same question + repair + find string is one finding; keep highest confidence.
  const key = (f: SweepFinding) =>
    `${f.questionId}|${f.repair}|${f.edit?.find ?? f.note.slice(0, 40)}`;
  const best = new Map<string, SweepFinding>();
  for (const f of fresh) {
    if (!best.has(key(f)) || best.get(key(f))!.confidence < f.confidence) {
      best.set(key(f), f);
    }
  }
  return [...best.values()].sort(
    (a, b) => Number(b.guardOk) - Number(a.guardOk) || b.confidence - a.confidence
  );
}
