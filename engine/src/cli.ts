import fs from 'node:fs';
import path from 'node:path';
import { loadDataset, ROOT } from './data';
import { runAll, toResults } from './pipeline/run';
import { runSweep } from './pipeline/sweep';
import { stats } from './llm/client';

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : undefined;
const ds = loadDataset();

if (args.includes('--sweep')) {
  const findings = await runSweep(ds);
  fs.mkdirSync(path.join(ROOT, 'engine/out'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'web/public'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'engine/out/sweep.json'), JSON.stringify(findings, null, 2));
  fs.copyFileSync(path.join(ROOT, 'engine/out/sweep.json'), path.join(ROOT, 'web/public/sweep.json'));
  console.log(`sweep: ${findings.length} findings`, stats());
  process.exit(0);
}

const cases = await runAll(ds, only);
const results = toResults(cases);
fs.mkdirSync(path.join(ROOT, 'engine/out'), { recursive: true });
if (!only) {
  fs.writeFileSync(path.join(ROOT, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'engine/out/cases.json'), JSON.stringify(cases, null, 2));
  fs.copyFileSync(path.join(ROOT, 'engine/out/cases.json'), path.join(ROOT, 'web/public/snapshot.json'));
} else {
  fs.writeFileSync(path.join(ROOT, 'engine/out/partial.json'), JSON.stringify({ cases, results }, null, 2));
}
const by = (k: keyof (typeof results)[number]) =>
  Object.entries(results.reduce<Record<string, number>>((m, r) => ({ ...m, [String(r[k])]: (m[String(r[k])] ?? 0) + 1 }), {}));
console.log('verdicts', by('verdict'));
console.log('routes', by('route'));
console.log(stats());

