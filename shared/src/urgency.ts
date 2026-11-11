import type { RepairKey, Route, Verdict } from './types';

export const SEVERITY: Record<RepairKey, number> = {
  answer_key: 10, wrong_question: 9, unsound: 9, type_mismatch: 9,
  stem_data: 8, option_repair: 8, identical_options: 8, diagram: 8,
  solution_fix: 6, solution_missing: 5, notation: 5,
  answer_form: 4, markup_leak: 4,
  wrong_chapter: 3, syllabus: 3,
  spelling: 2, noise: 1, exam_reference: 1,
};

/** Non defects still need closing, but they never outrank a real defect. */
const NON_DEFECT_SEVERITY = 0.5;

export interface UrgencyInput {
  verdict: Verdict;
  repair: RepairKey | null;
  route: Route;
  confidence: number;
  studentsAffected: number;
  firstReportedAt: string;
}

export interface UrgencyBreakdown {
  score: number;
  severity: number;
  students: number;
  ageDays: number;
  ageFactor: number;
  uncertainty: number;
}

export function urgency(i: UrgencyInput, now: Date = new Date()): UrgencyBreakdown {
  const severity = i.verdict === 'defect' && i.repair ? SEVERITY[i.repair] : NON_DEFECT_SEVERITY;
  const ageDays = Math.max(0, (now.getTime() - new Date(i.firstReportedAt).getTime()) / 86_400_000);
  const ageFactor = 1 + Math.min(ageDays, 14) / 7;          // caps at 3x after two weeks
  const uncertainty = i.route === 'faculty_review' ? 1 + (1 - i.confidence) : 1; // low confidence rises
  const students = Math.max(1, i.studentsAffected);
  const score = Math.round(students * severity * ageFactor * uncertainty * 10) / 10;
  return { score, severity, students, ageDays: Math.round(ageDays * 10) / 10, ageFactor, uncertainty };
}
