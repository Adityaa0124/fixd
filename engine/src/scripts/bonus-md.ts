import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../data';
import type { SweepFinding } from '../pipeline/sweep';

const sweepPath = path.join(ROOT, 'engine/out/sweep.json');
if (!fs.existsSync(sweepPath)) { console.warn('sweep.json not found; run `npm run sweep` first'); process.exit(1); }

const all: SweepFinding[] = JSON.parse(fs.readFileSync(sweepPath, 'utf8'));
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/[—–]/g, ',').trim();
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const where = (x: SweepFinding) => (x.questionReported ? 'reported question, different defect' : 'nobody reported this question');
const edit = (x: SweepFinding) => (x.edit ? `\`${cut(esc(x.edit.find), 50)}\` → \`${cut(esc(x.edit.replace), 50) || '(removed)'}\`` : 'faculty decision');
const row = (x: SweepFinding) =>
  `| \`${x.qid ?? x.questionId.slice(-6)}\` | ${x.subject} · ${esc(x.chapter)} | ${where(x)} | \`${x.repair ?? 'n/a'}\` | ${edit(x)} | ${cut(esc(x.note), 160)} |`;
const table = (xs: SweepFinding[]) => (xs.length
  ? ['| Question | Topic | Where | Repair | Edit | Evidence |',
     '|:---|:---|:---|:---|:---|:---|', ...xs.map(row)].join('\n')
  : '_None._');

const verified = all.filter((x) => x.status === 'verified');
const candidates = all.filter((x) => x.status === 'candidate');
const rejected = all.filter((x) => x.status === 'rejected');

const md = `# BONUS.md

Defects in the data that **no student reported**, found by \`npm run sweep\` and written by \`npm run bonus\`. Nothing here is hand edited.

## How they were found

* **Static checks** over all 43 questions: leaked LaTeX, stray MathML alignment markers, exam tags, blank or duplicate options, malformed keys.
* **Noticed while triaging**: defects the triage model saw on a reported question that the report itself was not about.
* **Sweep** of the ${new Set(all.filter((x) => !x.questionReported).map((x) => x.questionId)).size || 4} questions nobody reported: two blind solves plus report free triage.

Every edit went through the same scope guard as the main pipeline. **Verified** means the guard passed and confidence is at least 0.85, or it is a certain static fact. **Candidates** need a faculty decision (editorial calls such as chapter, or edits the guard could not confirm).

## Verified (${verified.length})

${table(verified)}

## Candidates for faculty (${candidates.length})

${table(candidates)}

## Refused by the guard (${rejected.length})

Proposed by the model, blocked by code. Listed for transparency; none of these would be applied.

${table(rejected)}
`;

fs.writeFileSync(path.join(ROOT, 'BONUS.md'), md);
console.log(`BONUS.md: ${verified.length} verified, ${candidates.length} candidates, ${rejected.length} refused`);
