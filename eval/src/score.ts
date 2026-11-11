import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ResultRow } from '@fixd/shared';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
interface Gold { reportId: string; verdict: string; repair: string | null; route: string; edit?: { field: string; find: string; replace: string }; note?: string }

const results: ResultRow[] = JSON.parse(fs.readFileSync(path.join(root, 'results.json'), 'utf8'));
const gold: Gold[] = JSON.parse(fs.readFileSync(path.join(root, 'eval/gold.json'), 'utf8'));
const byId = new Map(results.map((r) => [r.reportId, r]));

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
  const rtOk = r.route === g.route; if (rtOk) rt++;
  if (g.edit) {
    edN++;
    const e = r.edit;
    const eOk = !!e && e.field === g.edit.field && e.replace.trim() === g.edit.replace.trim() &&
      (g.edit.field !== 'answer' || e.find.trim() === g.edit.find.trim());
    if (eOk) ed++;
  }
  const isUnsafe = r.route === 'auto_apply' && (g.verdict !== 'defect' || g.route !== 'auto_apply');
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
console.log(`route accuracy       ${pct(rt, gold.length)}  (${rt}/${gold.length})`);
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
  edit: edN ? ed / edN : null, unsafe, missing,
}, null, 2));
process.exit(unsafe > 0 ? 1 : 0);

