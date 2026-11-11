import type { Edit, Gate, Snapshot } from '@fixd/shared';
export type { Edit, Gate, Snapshot };

/** Mirrors server/API.md. Everything optional that older payloads may lack. */
export interface CaseSummary {
  id: string;
  questionId: string;
  qid: string | null;
  subject: string;
  chapter: string;
  verdict: string;
  repair: string | null;
  route: 'auto_apply' | 'faculty_review' | 'no_change' | string;
  status: string;
  confidence: number;
  urgency: number;
  students: number;
  reports: number;
  firstReportedAt: string | null;
  preview: string;
  flags: string[];
  approvable?: boolean;
  blockedReason?: string | null;
}

export interface ReportItem {
  id: string;
  studentId: string;
  source: string;
  reportedAt: string;
  comment: string;
  flags: string[];
  lang: string;
  verdict: string;
  route: string;
  studentClaim: string;
  studentWasRight: boolean;
  aiReply: string;
  finalReply: string | null;
  replyStatus: 'draft' | 'sent' | string;
}

export interface ActionItem {
  id: number;
  type: string;
  actor: string;
  note: string | null;
  edits: Edit[] | null;
  statusBefore: string;
  statusAfter: string;
  versionFrom: number | null;
  versionTo: number | null;
  undone?: boolean;
  createdAt: string;
}

export interface VersionItem {
  version: number;
  createdBy: string;
  reason: string;
  createdAt: string;
  actionId?: number | null;
}

export interface CaseDetailRaw extends Omit<CaseSummary, 'reports'> {
  evidence: string;
  gates: unknown;
  agreement: unknown;
  solves: unknown;
  findings: unknown;
  otherIssues: unknown;
  guardErrors: unknown;
  editsRejected?: unknown;
  edits: Edit[];
  urgencyBreakdown: unknown;
  engineMeta: unknown;
  reports: ReportItem[];
  actions: ActionItem[];
  versions: VersionItem[];
  currentVersion: number;
  current: Snapshot;
  original: Snapshot;
  proposed: Snapshot | null;
  previous?: Snapshot | null;
  answerOptions: Array<{ label: string; text: string; blank?: boolean }>;
  lastActionId?: number;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  caseId: string | null;
  questionId: string | null;
  qid?: string | null;
  summary: string;
  before: Snapshot | null | unknown;
  after: Snapshot | null | unknown;
}

export interface Stats {
  cases: number;
  open: number;
  autoApplied: number;
  defects: number;
  resolved: number;
  autoApplyActions?: number;
  reverts?: number;
  autoFixRevertRate?: number | null;
}

export type Lane = 'needs_review' | 'spot_check' | 'no_change' | 'done' | 'sweep';
export type CaseLane = Exclude<Lane, 'sweep'>;

export interface SweepFindingRaw {
  questionId?: string;
  qid?: string | null;
  subject?: string;
  chapter?: string;
  source?: string;
  repair?: string | null;
  edit?: Edit | null;
  note?: string;
  confidence?: number;
  guardOk?: boolean;
  guardErrors?: string[];
  status?: string;
  reported?: boolean;
}

export interface SnapshotFile {
  generatedAt: string;
  engine: unknown;
  items: CaseSummary[];
  details: Record<string, CaseDetailRaw>;
  sweep: SweepFindingRaw[];
}
