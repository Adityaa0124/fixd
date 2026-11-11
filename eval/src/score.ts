import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResultRow } from '@fixd/shared';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
interface Gold { reportId: string; verdict: string; repair: string | null; route: string; edit?: { field: string; find: string; replace: string }; note?: string }

const results: ResultRow[] = JSON.parse(fs.readFileSync(path.join(root, 'results.json'), 'utf8'));
const gold: Gold[] = JSON.parse(fs.readFileSync(path.join(root, 'eval/gold.json'), 'utf8'));
const byId = new Map(results.map((r) => [r.reportId, r]));
const reportQ = new Map<string, string>(JSON.parse(fs.readFileSync(path.join(root, 'data/reports.json'), 'utf8'))
  .map((r: { reportId: string; questionId: string }) => [r.reportId, r.questionId]));
const questions = new Map<string, Record<string, any>>(JSON.parse(fs.readFileSync(path.join(root, 'data/questions.json'), 'utf8'))
  .map((q: Record<string, any>) => [q._id, q]));

type E = { field: string; find: string; replace: string };
/** Applies an edit to the stored record. Returns the new field value, or null if find is not there exactly once. */
function apply(reportId: string, e: E): string | null {
  const q = questions.get(reportQ.get(reportId) ?? '');
  if (!q) return null;
  const body = q[q.questionType];
  if (e.field === 'answer') return e.replace.replace(/\s+/g, '');
  if (e.field === 'questionType') return e.find === q.questionType ? e.replace : null;
  const cur: string = body?.[e.field] ?? '';
  if (!e.find) return cur.trim() === '' ? e.replace : null;
  const n = cur.split(e.find).length - 1;
  return n === 1 ? cur.replace(e.find, () => e.replace) : null;
}
let badFind = 0, repAll = 0;

let v = 0, rep = 0, repN = 0, rt = 0, ed = 0, edN = 0, unsafe = 0, missing = 0;
const rows: string[] = [];
const confusion = new Map<string, number>();

for (const g of gold) {
  const r = byId.get(g.reportId);
  if (!r) { missing++; rows.push(`${g.reportId}  MISSING`); continue; }
  const vOk = r.verdict === g.verdict; if (vOk) v++;
  confusion.set(`${g.verdict} → ${r.verdict}`, (confusion.get(`${g.verdict} → ${r.verdict}`) ?? 0) + 1);
  let repOk = true;
  if (g.verdict === 'defect') { repN++; repOk = r.repair === g.repair; if (repOk) rep++; }
  if ((r.repair ?? null) === (g.repair ?? null)) repAll++;
  const applied = r.edit ? apply(g.reportId, r.edit) : undefined;
  if (r.edit && applied === null) badFind++;
  const rtOk = r.route === g.route; if (rtOk) rt++;
  if (g.edit) {
    edN++;
    const e = r.edit;
    // Same outcome on the stored record counts, whatever span the edit chose ("plexux" vs "Choroid plexux").
    const eOk = !!e && e.field === g.edit.field && applied != null && applied === apply(g.reportId, g.edit);
    if (eOk) ed++;
  }
  const isUnsafe = r.route === 'auto_apply' && (g.verdict !== 'defect' || g.route !== 'auto_apply' || !r.edit || applied === null ||
    (g.edit ? applied !== apply(g.reportId, g.edit) && g.edit.field === 'answer' : false));
  if (isUnsafe) unsafe++;
  if (!vOk || !repOk || !rtOk || isUnsafe) {
    rows.push(`${g.reportId}  verdict ${r.verdict}${vOk ? '' : ` (gold ${g.verdict})`}  repair ${r.repair}${repOk ? '' : ` (gold ${g.repair})`}  route ${r.route}${rtOk ? '' : ` (gold ${g.route})`}${isUnsafe ? '  UNSAFE' : ''}`);
  }
}

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a');
console.log('\nFixd eval vs eval/gold.json');
console.log('────────────────────────────────────────────');
console.log(`verdict accuracy     ${pct(v, gold.length)}  (${v}/${gold.length})`);
console.log(`repair accuracy      ${pct(rep, repN)}  (${rep}/${repN} defects)`);
console.log(`repair, all rows     ${pct(repAll, gold.length)}  (${repAll}/${gold.length})`);
console.log(`route accuracy       ${pct(rt, gold.length)}  (${rt}/${gold.length})`);
console.log(`edits not applicable ${badFind}  (find missing or not unique in the stored field)`);
console.log(`edit exact match     ${pct(ed, edN)}  (${ed}/${edN} labelled edits)`);
console.log(`UNSAFE auto applies  ${unsafe}`);
console.log(`missing rows         ${missing}`);
console.log('────────────────────────────────────────────');
console.log('confusion (gold → ours), mismatches only:');
for (const [k, n] of [...confusion].sort((a, b) => b[1] - a[1])) if (!k.split(' → ').every((x, _, a) => x === a[0])) console.log(`  ${k}: ${n}`);
console.log('\nmisses:');
for (const r of rows) console.log('  ' + r);

fs.mkdirSync(path.join(root, 'eval/out'), { recursive: true });
fs.writeFileSync(path.join(root, 'eval/out/last.json'), JSON.stringify({
  at: new Date().toISOString(), verdict: v / gold.length, repair: repN ? rep / repN : null, route: rt / gold.length,
  edit: edN ? ed / edN : null, repairAll: repAll / gold.length, badFind, unsafe, missing,
}, null, 2));
process.exit(unsafe > 0 ? 1 : 0);

