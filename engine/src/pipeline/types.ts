import type {
  CommentFlag, Edit, Gate, Lang, RepairKey, Route, Snapshot, UrgencyBreakdown, Verdict,
} from '@fixd/shared';
import type { Finding } from '../checks/static';
import type { Solve } from '../prompts/solver';
import type { Triage } from '../prompts/triage';
import type { Agreement } from '../router';

export interface CaseOut {
  questionId: string;
  qid: string | null;
  subject: string;
  chapter: string;
  questionType: string;
  verdict: Verdict;
  repair: RepairKey | null;
  edit: Edit | null;
  edits: Edit[];                     // edit + extra_edits after guard normalization
  route: Route;
  gates: Gate[];
  confidence: number;
  evidence: string;
  agreement: Agreement;
  solves: Solve[];
  solutionFinalAnswer: string | null;
  findings: Finding[];
  otherIssues: Triage['other_issues'];
  guardErrors: string[];
  before: Snapshot;
  after: Snapshot | null;
  urgency: UrgencyBreakdown;
  firstReportedAt: string;
  reports: Array<{
    reportId: string; studentId: string; source: string; reportedAt: string; comment: string;
    flags: CommentFlag[]; lang: Lang; verdict: Verdict; route: Route;
    studentClaim: string; studentWasRight: boolean; reply: string;
  }>;
  engine: { solver: string; triage: string; reply: string; models: { solver: string; fast: string } };
}

