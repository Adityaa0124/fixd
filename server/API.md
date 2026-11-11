# Fixd API

Express 4 + Prisma on Postgres. Base path `/api`. JSON in, JSON out. All timestamps are ISO 8601 strings.

Errors always look like `{ "error": "human readable message" }`.

| Status | Meaning |
|:---|:---|
| 400 | Body or query failed validation, or an edit cannot be applied (find not found, wrong answer format, field outside repair scope) |
| 404 | Case not found |
| 409 | Action not allowed in the current state (wrong status, approve blocked by the guard, nothing to undo, reply already sent) |
| 429 | Rate limited (demo reset) |
| 500 | Internal error. Message is always the generic `"internal error"`; details go to server logs only |
| 503 | `/api/health` only: database unreachable |

Case ids are **stable across reseeds**: `case.id === case.questionId`.

---

## Health

### `GET /api/ping`
No database access. Use for keep warm.
```json
{ "ok": true }
```

### `GET /api/health`
```json
{ "ok": true, "db": true, "cases": 39, "version": "a1b2c3d" }
```
503 → `{ "ok": false, "db": false }`

---

## Cases

### Lanes

| Lane | Case statuses |
|:---|:---|
| `needs_review` (default) | `open` |
| `spot_check` | `auto_applied` |
| `no_change` | `no_change` |
| `done` | `approved`, `edited`, `rejected`, `confirmed`, `acknowledged` |

### `GET /api/cases?lane=needs_review&q=text`
`lane` must be one of the four above (400 otherwise). `q` is a case insensitive substring match over qid, questionId, chapter, subject, verdict, repair and preview.

Sort: `no_change` lane oldest first report first; every other lane by `urgency` descending.

```ts
{
  items: CaseSummary[];
  counts: { needs_review: number; spot_check: number; no_change: number; done: number };
}

interface CaseSummary {
  id: string;                 // same as questionId
  questionId: string;
  qid: string | null;
  subject: string;
  chapter: string;
  verdict: string;            // taxonomy verdict key
  repair: string | null;      // taxonomy repair key
  route: 'auto_apply' | 'faculty_review' | 'no_change';
  status: string;             // see lanes
  confidence: number;         // 0..1
  urgency: number;
  students: number;           // distinct studentIds
  reports: number;            // report count
  firstReportedAt: string | null;  // earliest reportedAt, ISO
  preview: string;            // first 140 chars of the original stem as text
  flags: string[];            // union of report comment flags
  approvable: boolean;        // NEW: true when Approve would succeed right now
  blockedReason: string | null; // NEW: why Approve is blocked, plain words
}
```

### `GET /api/cases/:id`
```ts
interface CaseDetail extends CaseSummary {
  evidence: string;
  gates: Gate[];              // engine gate list, passed through as stored
  agreement: unknown;         // engine agreement object
  solves: unknown[];          // engine solve objects
  findings: unknown[];        // static findings
  otherIssues: unknown[];
  guardErrors: string[];
  editsRejected: unknown[];   // NEW: edits the engine guard rejected (never applied, never approvable); [] when absent
  edits: Edit[];              // proposed edits (empty when none)
  urgencyBreakdown: unknown;
  engineMeta: unknown;
  reports: Report[];
  actions: Action[];          // newest first
  versions: { version: number; createdBy: string; reason: string; createdAt: string; actionId: number | null }[];
  currentVersion: number;
  current: Snapshot;          // live content
  original: Snapshot;         // version 1, as imported
  proposed: Snapshot | null;  // current + edits, only while status is open and edits apply cleanly
  previous: Snapshot | null;  // NEW: content just before the latest applied change (diff source for spot_check and done)
  answerOptions: { label: string; text: string; blank: boolean }[];
  lastActionId?: number;      // NEW: only on POST actions responses, id of the action just written
}

interface Edit { field: 'question' | 'solution' | 'answer' | 'questionType'; find: string; replace: string }
interface Snapshot { questionType: 'scq' | 'mcq' | 'integerQuestion'; question: string; solution: string; answer: string | string[] }

interface Report {
  id: string; questionId: string; studentId: string; source: string; reportedAt: string;
  comment: string; flags: string[]; lang: string; verdict: string; route: string;
  studentClaim: string; studentWasRight: boolean;
  aiReply: string;            // engine draft
  finalReply: string | null;  // faculty edited text, if any
  replyStatus: 'draft' | 'sent';
}

interface Action {
  id: number; caseId: string;
  type: 'auto_apply' | 'approve' | 'edit' | 'reject' | 'confirm' | 'revert' | 'acknowledge' | 'undo';
  actor: string; note: string | null; edits: Edit[] | null;
  statusBefore: string; statusAfter: string;
  versionFrom: number | null; versionTo: number | null;
  undone: boolean; createdAt: string;
}
```

### `POST /api/cases/:id/actions`
Body is one of:

| type | Allowed from status | Body | Effect |
|:---|:---|:---|:---|
| `approve` | `open` | `{ actor, replies?, note? }` | Applies `edits` as a new version (if any) → `approved`. Refused with 409 when `approvable` is false. |
| `edit` | `open` | `{ actor, edits: Edit[1..5], replies?, note? }` | Applies the faculty edits → `edited`. Fields must be inside the repair's allowed fields. |
| `reject` | `open` | `{ actor, reason, replies? }` | No content change → `rejected`. |
| `confirm` | `auto_applied` | `{ actor, replies? }` | Accepts the engine's auto fix → `confirmed`. |
| `revert` | `auto_applied` | `{ actor, reason, replies? }` | Restores the content from before the auto fix as a new version → `rejected`. |
| `acknowledge` | `no_change` | `{ actor, replies? }` | Marks the no change verdict reviewed → `acknowledged`. |
| `undo` | any | `{ actor, actionId? }` | Undoes `actionId`, or by default the latest undoable action **of this case**. Only the latest undoable action can be undone. Restores content, case status and reply state. |

Limits: `actor` 1..60 chars, `note` and `reason` 1..500, each reply 1..600, `find`/`replace` up to 20000.

`replies` is `{ [reportId]: text }`. Only report ids that belong to this case are accepted (400 otherwise).

Reply sending rules:
* `approve`, `edit`, `confirm`, `acknowledge`: every `draft` report on the case is marked `sent` (with the faculty text when given, otherwise the AI draft).
* `reject`, `revert`: only reports with an explicit entry in `replies` are sent. The AI draft described a fix that did not happen, so untouched drafts stay `draft`.
* A reply for a report that is already `sent` with different text → 409 `reply already sent`. Same text is ignored.
* `undo` restores every report on the case to its state before the undone action.

Answer validation on `edit` (checked on the resulting snapshot):
* `scq`: one option letter that exists in the question.
* `mcq`: a JSON array of one or more distinct existing option letters, like `["A","C"]`.
* `integerQuestion`: a number, like `12` or `0.08`.

Response: `CaseDetail` with `lastActionId`.

Every mutating action writes one `AuditLog` row with `before` and `after` snapshots when content changed (approve, edit, revert, undo that restored content) and sets `QuestionVersion.actionId` on the version it created.

---

## Audit and stats

### `GET /api/audit?limit=100&caseId=...`
`limit` integer 1..500, default 100 (bad values fall back to the default). `caseId` optional filter.
```ts
{
  id: number; at: string; actor: string;
  action: 'seed' | 'auto_apply' | 'approve' | 'edit' | 'reject' | 'confirm' | 'revert' | 'acknowledge' | 'undo' | 'demo_reset';
  caseId: string | null; questionId: string | null;
  qid: string | null;          // NEW: question qid for display
  summary: string;
  before: Snapshot | null; after: Snapshot | null;
}[]
```
Newest first.

### `GET /api/stats`
```ts
{
  cases: number; open: number; autoApplied: number; defects: number; resolved: number;
  autoApplyActions: number;    // NEW: engine auto_apply actions
  reverts: number;             // NEW: faculty reverts of auto fixes (not undone)
  autoFixRevertRate: number | null; // NEW: reverts / autoApplyActions, null when no auto applies
}
```

### `GET /api/sweep`
Contents of `engine/out/sweep.json` (array), `[]` when missing.

---

## Demo

### `POST /api/demo/reset`
Public. Rate limited to 5 per hour per IP (429 after). Wipes every action, reply change and version and reseeds from `engine/out/cases.json`.
```json
{ "seeded": { "questions": 43, "cases": 39 } }
```

### `POST /api/admin/reset`
Same as demo reset, no rate limit, requires header `x-admin-token: $ADMIN_TOKEN` (401 otherwise).

---

## Removed

`POST /api/cases/:id/rerun` is gone. Engine runs are offline and cached (`npm run engine`); the deployed API never calls an LLM.

---

## Tests

`npm run test:db -w @fixd/server` runs integration tests (approve, guard refusal, undo, revert, reset, validation) against the database in `DATABASE_URL`. They mutate data and reseed at the end, so plain `npm test` skips them.
