import { applyEdits, type Edit, type Snapshot } from '@fixd/shared';
import type { ActionItem, CaseDetailRaw, CaseLane, ReportItem, VersionItem } from './types';
import { GATE_LABEL, laneOf } from './labels';

/** One normalized shape for a case, whether it came from the live API or the snapshot. */
export interface CaseView {
  id: string;
  questionId: string;
  qid: string | null;
  subject: string;
  chapter: string;
  status: string;
  lane: CaseLane;
  verdict: string;
  repair: string | null;
  route: string;
  confidence: number;
  evidence: string;
  gates: Array<{ name: string; label: string; pass: boolean; detail: string }>;
  solves: Array<{ answer: string | null; steps: string[]; solvable: boolean; missing: string | null }>;
  agreement: {
    solvesAgree: boolean | null;
    solvesMatchKey: boolean | null;
    solutionMatchesProposed: boolean | null;
    solvable: boolean | null;
  };
  findings: Array<{ code: string; field: string; detail: string; certain: boolean }>;
  otherIssues: Array<{ repair: string; field: string; find: string; replace: string; note: string }>;
  guardErrors: string[];
  editsRejected: Edit[];
  edits: Edit[];
  urgency: { score: number; severity: number; students: number; ageDays: number; ageFactor: number; uncertainty: number };
  reports: ReportItem[];
  actions: ActionItem[];
  versions: VersionItem[];
  currentVersion: number;
  current: Snapshot;
  original: Snapshot;
  /** What the diff compares: before and after of the change this case is about. */
  diffBefore: Snapshot;
  diffAfter: Snapshot | null;
  applyError: string | null;
  options: Array<{ label: string; text: string; blank: boolean }>;
  approvable: boolean;
  blockedReason: string | null;
  students: number;
}

const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const str = (x: unknown): string => (x == null ? '' : String(x));

/** Removes thinking aloud that sometimes leaks into model evidence. */
export function cleanEvidence(e: string): string {
  const sentences = e.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(
    (s) => !/^(wait|hmm|actually,? let|let'?s (re|double|check)|let me|re-?evaluat|on second thought)/i.test(s.trim())
  );
  return (kept.length ? kept : sentences).join(' ').replace(/\s*Guard:.*$/s, '').trim();
}

function solveAnswer(a: unknown): string | null {
  if (a == null) return null;
  if (Array.isArray(a)) return a.length ? a.map(String).join(', ') : null;
  return String(a);
}

function sameEdit(a: Edit, b: Edit) {
  return a.field === b.field && a.find === b.find && a.replace === b.replace;
}

export function adaptCase(raw: CaseDetailRaw): CaseView {
  const lane = laneOf(raw.status);
  const edits = arr<Edit>(raw.edits);
  const gatesRaw = raw.gates;
  const gates = (Array.isArray(gatesRaw)
    ? (gatesRaw as Array<{ name: string; pass: boolean; detail?: string }>)
    : Object.entries((gatesRaw as Record<string, { pass: boolean; detail?: string }>) ?? {}).map(([name, g]) => ({ name, ...g }))
  ).map((g) => ({ name: g.name, label: GATE_LABEL[g.name] ?? g.name, pass: !!g.pass, detail: str(g.detail) }));

  const solves = arr<Record<string, unknown>>(raw.solves).map((s) => ({
    answer: solveAnswer(s.answer),
    steps: Array.isArray(s.steps) ? (s.steps as unknown[]).map(String) : s.reasoning || s.text ? [str(s.reasoning || s.text)] : [],
    solvable: s.solvable !== false,
    missing: (s.missing as string | null) ?? null,
  }));

  const ag = (raw.agreement ?? {}) as Record<string, unknown>;
  const b = (k: string) => (typeof ag[k] === 'boolean' ? (ag[k] as boolean) : null);

  const findings = arr<unknown>(raw.findings).map((f) =>
    typeof f === 'string'
      ? { code: '', field: '', detail: f, certain: false }
      : {
          code: str((f as Record<string, unknown>).code),
          field: str((f as Record<string, unknown>).field),
          detail: str((f as Record<string, unknown>).detail),
          certain: !!(f as Record<string, unknown>).certain,
        }
  );

  const otherIssues = arr<Record<string, unknown>>(raw.otherIssues).map((o) => ({
    repair: str(o.repair),
    field: str(o.field),
    find: str(o.find ?? (o.edit as Edit | undefined)?.find),
    replace: str(o.replace ?? (o.edit as Edit | undefined)?.replace),
    note: str(o.note ?? o.claim),
  }));

  const guardErrors = arr<unknown>(raw.guardErrors).map(str);
  const editsRejected = arr<Edit>(raw.editsRejected);

  // What changed or would change
  let diffBefore = raw.current;
  let diffAfter: Snapshot | null = null;
  let applyError: string | null = null;
  if (lane === 'needs_review') {
    if (edits.length) {
      try {
        diffAfter = raw.proposed ?? applyEdits(raw.current, edits);
      } catch (e) {
        applyError = (e as Error).message;
      }
    }
  } else {
    diffBefore = raw.previous ?? raw.original;
    diffAfter = raw.current;
  }

  // Approve gating: prefer the server's verdict, recompute for older payloads
  let approvable = raw.approvable ?? true;
  let blockedReason = raw.blockedReason ?? null;
  if (raw.approvable === undefined) {
    if (applyError) [approvable, blockedReason] = [false, 'The proposed edit does not apply to the stored text.'];
    else if (edits.some((e) => e.find === e.replace)) [approvable, blockedReason] = [false, 'The proposed edit changes nothing.'];
    else if (guardErrors.length && edits.length) [approvable, blockedReason] = [false, 'The scope guard rejected this edit.'];
  }
  if (lane !== 'needs_review') approvable = false;

  const u = (raw.urgencyBreakdown ?? {}) as Record<string, number>;
  return {
    id: raw.id,
    questionId: raw.questionId,
    qid: raw.qid,
    subject: raw.subject,
    chapter: raw.chapter,
    status: raw.status,
    lane,
    verdict: raw.verdict,
    repair: raw.repair,
    route: raw.route,
    confidence: Number(raw.confidence ?? 0),
    evidence: cleanEvidence(str(raw.evidence)),
    gates,
    solves,
    agreement: {
      solvesAgree: b('solvesAgree'),
      solvesMatchKey: b('solvesMatchKey'),
      solutionMatchesProposed: b('solutionMatchesProposed'),
      solvable: b('solvable'),
    },
    findings,
    otherIssues,
    guardErrors,
    editsRejected: editsRejected.filter((r) => !edits.some((e) => sameEdit(e, r))),
    edits,
    urgency: {
      score: Number(u.score ?? raw.urgency ?? 0),
      severity: Number(u.severity ?? 0),
      students: Number(u.students ?? raw.students ?? 1),
      ageDays: Number(u.ageDays ?? 0),
      ageFactor: Number(u.ageFactor ?? 1),
      uncertainty: Number(u.uncertainty ?? 1),
    },
    reports: arr<ReportItem>(raw.reports),
    actions: arr<ActionItem>(raw.actions),
    versions: arr<VersionItem>(raw.versions),
    currentVersion: raw.currentVersion ?? 1,
    current: raw.current,
    original: raw.original,
    diffBefore,
    diffAfter,
    applyError,
    options: arr<{ label: string; text: string; blank?: boolean }>(raw.answerOptions).map((o) => ({ ...o, blank: !!o.blank })),
    approvable,
    blockedReason,
    students: raw.students,
  };
}
