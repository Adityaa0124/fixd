import { loadDataset } from '../data';
import { parseQuestion } from '../parse';
import { staticChecks } from '../checks/static';
import { sanitizeComment } from '../sanitize';
import { blindSolve } from '../steps/solve';
import { triage } from '../steps/triage';
import { stats } from '../llm/client';

const suffix = process.argv[2] ?? 'a949';
const ds = loadDataset();
const rec = ds.questions.find((q) => q._id.endsWith(suffix))!;
const p = parseQuestion(rec);
const findings = staticChecks(p);
const reports = ds.reports.filter((r) => r.questionId === rec._id).map((report) => ({ report, s: sanitizeComment(report.comment) }));
const solves = await blindSolve(p);
console.log('SOLVES', JSON.stringify(solves, null, 1));
const t = await triage({ p, taxonomy: ds.taxonomy, findings, solves, reports });
console.log('TRIAGE', JSON.stringify(t, null, 1), stats());

