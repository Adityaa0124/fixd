import type { Edit, Gate, Snapshot } from '@fixd/shared';
export type { Edit, Gate, Snapshot };

export interface CaseSummary {
  id: string;
  questionId: string;
  qid: string | null;
  subject: string;
  chapter: string;
  verdict: string;
  repair: string | null;
  route: string;
  status: string;
  confidence: number;
  urgency: number;
  students: number;
  reports: number;
  firstReportedAt: string | null;
  preview: string;
  flags: string[];
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
  replyStatus: string;
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
  createdAt: string;
}

export interface VersionItem {
  version: number;
  createdBy: string;
  reason: string;
  createdAt: string;
}

export interface CaseDetail extends Omit<CaseSummary, 'reports'> {
  evidence: string;
  gates: Record<string, Gate>;
  agreement: {
    solvesAgree?: boolean;
    solutionAgreesWithKey?: boolean;
    solutionAgreesWithSolver?: boolean;
    studentAgreesWithSolver?: boolean;
  };
  solves: Array<{ answer: unknown; text?: string; reasoning?: string }>;
  findings: string[];
  otherIssues: Array<{ field: string; claim: string; edit?: Edit }>;
  guardErrors: string[];
  edits: Edit[];
  urgencyBreakdown: {
    score: number;
    students: number;
    severity: number;
    ageDays: number;
    uncertainty: number;
  };
  engineMeta: unknown;
  reports: ReportItem[];
  actions: ActionItem[];
  versions: VersionItem[];
  currentVersion: number;
  current: Snapshot;
  original: Snapshot;
  proposed: Snapshot | null;
  answerOptions: Array<{ label: string; text: string; blank?: boolean }>;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  caseId: string | null;
  questionId: string | null;
  summary: string;
  before: unknown;
  after: unknown;
}

export type Lane = 'needs_review' | 'spot_check' | 'no_change' | 'done' | 'sweep';

export interface SweepFinding {
  questionId: string;
  qid: string | null;
  subject: string;
  chapter: string;
  source: 'static' | 'triage_other_issue' | 'sweep_triage' | 'key_check';
  repair: string | null;
  edit: Edit | null;
  note: string;
  confidence: number;
  guardOk: boolean;
  guardErrors: string[];
  status: 'candidate' | 'confirmed' | 'rejected';
}
