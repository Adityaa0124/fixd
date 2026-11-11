import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../data';
import type { SweepFinding } from '../pipeline/sweep';

const sweepPath = path.join(ROOT, 'engine/out/sweep.json');
if (!fs.existsSync(sweepPath)) {
  console.warn('sweep.json not found; please run sweep first');
  process.exit(1);
}

const f: SweepFinding[] = JSON.parse(fs.readFileSync(sweepPath, 'utf8'));
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 140);
const row = (x: SweepFinding) =>
  `| \`${x.qid ?? x.questionId.slice(-6)}\` | ${x.subject} · ${x.chapter} | \`${x.repair ?? 'n/a'}\` | ${x.edit ? `\`${esc(x.edit.find)}\` → \`${esc(x.edit.replace)}\`` : 'n/a'} | ${esc(x.note)} |`;
const table = (xs: SweepFinding[]) =>
  xs.length
    ? ['| Question | Where | Repair | Edit | Evidence |', '|:---|:---|:---|:---|:---|', ...xs.map(row)].join('\n')
    : '_None._';

const confirmed = f.filter((x) => x.status === 'confirmed');
const candidates = f.filter((x) => x.status === 'candidate' && x.guardOk);

const md = `# BONUS.md

Defects in the question bank that were not reported by students, discovered through the Fixd sweep.

## How they were found

* Static checks across all 43 questions: literal facts about stored content including leaked markup, exam reference tags, and empty option labels.
* Secondary issues noticed by the triage engine during analysis of reported questions.
* Comprehensive sweep of unreported questions with dual blind solves and report free triage.
* Every finding must pass the scope guard and verified by faculty review.

## Confirmed (${confirmed.length})

${table(confirmed)}

## Candidates for faculty review (${candidates.length})

Passed the scope guard, awaiting faculty confirmation:

${table(candidates)}
`;

fs.writeFileSync(path.join(ROOT, 'BONUS.md'), md);
console.log(`BONUS.md: ${confirmed.length} confirmed, ${candidates.length} candidates`);

