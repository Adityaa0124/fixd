export type QuestionType = 'scq' | 'mcq' | 'integerQuestion';
export type OptionLabel = 'A' | 'B' | 'C' | 'D';
export const OPTION_LABELS: OptionLabel[] = ['A', 'B', 'C', 'D'];

export type Verdict =
  | 'defect'
  | 'no_error'
  | 'display_issue'
  | 'app_issue'
  | 'language_mode'
  | 'already_fixed'
  | 'not_actionable';

export const VERDICTS: Verdict[] = [
  'defect', 'no_error', 'display_issue', 'app_issue', 'language_mode', 'already_fixed', 'not_actionable',
];

export type RepairKey =
  | 'spelling' | 'noise' | 'exam_reference' | 'markup_leak' | 'answer_form' | 'notation'
  | 'stem_data' | 'option_repair' | 'solution_fix' | 'solution_missing' | 'answer_key'
  | 'type_mismatch' | 'identical_options' | 'diagram' | 'wrong_question' | 'unsound'
  | 'wrong_chapter' | 'syllabus';

export type Route = 'auto_apply' | 'faculty_review' | 'no_change';

export type EditField = 'question' | 'solution' | 'answer' | 'questionType';

export interface Edit {
  field: EditField;
  find: string;
  replace: string;
}

export interface TaxonomyRepair {
  fields: EditField[];
  auto: boolean;
  label: string;
}

export interface Taxonomy {
  verdicts: Record<Verdict, string>;
  repairs: Record<RepairKey, TaxonomyRepair>;
}

export interface ErrorHistoryEntry {
  type: string;
  actor: string;
  at: string;
  note: string;
}

export interface QuestionBody {
  question: string;
  solution: string;
  answer: string | string[];
  quesImages: string[];
  solutionImages: string[];
}

export interface RawQuestion {
  _id: string;
  qid: string | null;
  questionType: QuestionType;
  subject: string;
  chapter: string;
  concept: string | null;
  subConcept: string | null;
  level: string;
  error: number;
  updatedAt: string;
  errorHistory: ErrorHistoryEntry[];
  scq?: QuestionBody;
  mcq?: QuestionBody;
  integerQuestion?: QuestionBody;
}

export interface RawReport {
  reportId: string;
  questionId: string;
  studentId: string;
  source: 'android' | 'ios' | 'web';
  reportedAt: string;
  comment: string;
}

/** What the brief auto scorer reads. Exact shape, exact key order. */
export interface ResultRow {
  reportId: string;
  questionId: string;
  verdict: Verdict;
  repair: RepairKey | null;
  edit: Edit | null;
  route: Route;
  confidence: number;
  evidence: string;
  student_reply: string;
}

export type CommentFlag =
  | 'injection'
  | 'gibberish'
  | 'low_content'
  | 'language_request'
  | 'app_behaviour'
  | 'display_behaviour';

export type Lang = 'english' | 'hinglish';

export interface Gate {
  name: 'verdict' | 'taxonomy' | 'guard' | 'confidence' | 'agreement' | 'subject' | 'provenance' | 'option_source';
  pass: boolean;
  detail: string;
}

export interface Snapshot {
  questionType: QuestionType;
  question: string;
  solution: string;
  answer: string | string[];
}

