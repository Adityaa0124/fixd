/**
 * Writes the shipped prompts into PROMPTS.md between the generated markers, verbatim from source,
 * so the documentation can never drift from what the engine actually sends.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../data';
import { SOLVER_METHODS, SOLVER_SYSTEM, SOLVER_VERSION } from '../prompts/solver';
import { TRIAGE_SYSTEM, TRIAGE_VERSION } from '../prompts/triage';
import { REPLY_SYSTEM, REPLY_VERSION } from '../prompts/reply';
import { PROOFREAD_SYSTEM, PROOFREAD_VERSION } from '../prompts/proofread';

const src = (f: string) => fs.readFileSync(path.join(ROOT, 'engine/src/prompts', f), 'utf8');
const between = (s: string, start: string, end: string) => s.slice(s.indexOf(start) + start.length, s.indexOf(end, s.indexOf(start) + start.length));
const block = (s: string) => '```text\n' + s.trim() + '\n```';

const solverUser = between(src('solver.ts'), 'const SOLVER_USER = `', '`;');
const triageUser = between(src('triage.ts'), 'const TRIAGE_USER = `', '`;');
const replyUser = between(src('reply.ts'), 'const REPLY_USER = `', '`;');
const proofUser = between(src('proofread.ts'), 'const USER = `', '`;');
const runSrc = fs.readFileSync(path.join(ROOT, 'engine/src/pipeline/run.ts'), 'utf8');
const retry = between(runSrc, 'const retryNote = ', ';').trim();
const clientSrc = fs.readFileSync(path.join(ROOT, 'engine/src/llm/client.ts'), 'utf8');
const repair = between(clientSrc, 'raw = await send(c, ', ');').trim();

const md = `<!-- generated:prompts:start (npm run prompts:md, do not edit by hand) -->

### 1.1 Blind solver · \`${SOLVER_VERSION}\`

Runs twice per question with the same system prompt and two different methods. Neither run sees the key, the stored solution or any comment.

**System**

${block(SOLVER_SYSTEM)}

**User template**

${block(solverUser)}

**\`{{method}}\` for solve 1 (\`direct\`, temperature 0.2)**

${block(SOLVER_METHODS.direct)}

**\`{{method}}\` for solve 2 (\`elimination\`, temperature 0.7)**

${block(SOLVER_METHODS.elimination)}

### 1.2 Triage · \`${TRIAGE_VERSION}\`

**System**

${block(TRIAGE_SYSTEM)}

**User template**

${block(triageUser)}

**Guard retry** (sent once, appended as \`<previous_attempt_rejected>\`, only when the scope guard refused the first edit)

${block(retry)}

### 1.3 Reply writer · \`${REPLY_VERSION}\`

**System**

${block(REPLY_SYSTEM)}

**User template**

${block(replyUser)}

### 1.4 Proofreader (bonus sweep) · \`${PROOFREAD_VERSION}\`

**System**

${block(PROOFREAD_SYSTEM)}

**User template**

${block(proofUser)}

### 1.5 JSON repair (any call)

Appended once when a response fails Zod validation; a second failure aborts that call.

${block(repair)}

<!-- generated:prompts:end -->`;

const file = path.join(ROOT, 'PROMPTS.md');
const doc = fs.readFileSync(file, 'utf8');
const re = /<!-- generated:prompts:start[\s\S]*?<!-- generated:prompts:end -->/;
if (!re.test(doc)) { console.error('markers not found in PROMPTS.md'); process.exit(1); }
fs.writeFileSync(file, doc.replace(re, () => md));
console.log('PROMPTS.md: prompts regenerated from source');
