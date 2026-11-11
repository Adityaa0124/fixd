import taxonomy from '../../../data/taxonomy.json';
import type { CaseLane, Lane } from './types';

type Field = 'question' | 'solution' | 'answer' | 'questionType';
const TAX = taxonomy as unknown as {
  verdicts: Record<string, string>;
  repairs: Record<string, { fields: Field[]; auto: boolean; label: string }>;
};

export const LANE_LABEL: Record<Lane, string> = {
  needs_review: 'Needs you',
  spot_check: 'AI fixed',
  no_change: 'No change',
  done: 'Done',
  sweep: 'Unreported',
};

export const LANE_HINT: Record<Lane, string> = {
  needs_review: 'Real or likely defects the AI will not change on its own. Ordered by harm.',
  spot_check: 'Fixes the AI already applied. Confirm or revert.',
  no_change: 'Reports where the question is fine. Check the reply and close.',
  done: 'Everything a person has closed.',
  sweep: 'Defects in the bank that no student reported, found by the sweep.',
};

export const VERDICT_LABEL: Record<string, string> = {
  defect: 'Defect',
  no_error: 'Student mistake',
  display_issue: 'Display issue',
  app_issue: 'App issue',
  language_mode: 'Language request',
  already_fixed: 'Already fixed',
  not_actionable: 'Nothing to act on',
};

export const REPAIR_LABEL: Record<string, string> = {
  spelling: 'Spelling',
  noise: 'Stray text',
  exam_reference: 'Exam tag in text',
  markup_leak: 'Raw markup showing',
  answer_form: 'Unit or answer form missing',
  notation: 'Notation lost',
  stem_data: 'Missing value in the question',
  option_repair: 'Broken option',
  solution_fix: 'Wrong solution',
  solution_missing: 'Missing solution',
  answer_key: 'Wrong answer key',
  type_mismatch: 'Wrong question type',
  identical_options: 'Two identical options',
  diagram: 'Figure missing',
  wrong_question: 'Wrong question',
  unsound: 'Unsound question',
  wrong_chapter: 'Wrong chapter',
  syllabus: 'Out of syllabus',
};

export const GATE_LABEL: Record<string, string> = {
  verdict: 'It is a defect',
  taxonomy: 'Repair type may auto apply',
  guard: 'Edit stays in scope',
  confidence: 'Confidence at least 0.85',
  agreement: 'Independent checks agree',
  subject: 'Subject rule',
  provenance: 'Not driven by a flagged comment',
  option_source: 'Option text has a trusted source',
};

export const FLAG_LABEL: Record<string, string> = {
  injection: 'Tried to give the AI orders',
  gibberish: 'No readable content',
  low_content: 'Very short',
  language_request: 'Language request',
  app_behaviour: 'About the app',
  display_behaviour: 'About display',
};

export const STATUS_LABEL: Record<string, string> = {
  open: 'Waiting for you',
  auto_applied: 'Applied by AI',
  no_change: 'No change needed',
  approved: 'Approved',
  edited: 'Edited and applied',
  rejected: 'Rejected',
  confirmed: 'AI fix confirmed',
  acknowledged: 'Closed',
};

export const TYPE_LABEL: Record<string, string> = {
  scq: 'Single correct',
  mcq: 'Multiple correct',
  integerQuestion: 'Integer answer',
};

export function laneOf(status: string): CaseLane {
  if (status === 'open') return 'needs_review';
  if (status === 'auto_applied') return 'spot_check';
  if (status === 'no_change') return 'no_change';
  return 'done';
}

export function repairLabel(r: string | null | undefined): string {
  if (!r) return '';
  return REPAIR_LABEL[r] ?? r.replace(/_/g, ' ');
}

export function repairDefinition(r: string | null | undefined): string {
  return (r && TAX.repairs[r]?.label) || '';
}

export function allowedFields(r: string | null | undefined): Field[] {
  if (!r) return ['question', 'solution', 'answer', 'questionType'];
  return TAX.repairs[r]?.fields ?? [];
}

export function repairAutoAllowed(r: string | null | undefined): boolean {
  return !!(r && TAX.repairs[r]?.auto);
}

export function verdictLabel(v: string): string {
  return VERDICT_LABEL[v] ?? v.replace(/_/g, ' ');
}

export function sourceLabel(s: string): string {
  return s === 'ios' ? 'iOS' : s === 'android' ? 'Android' : s === 'web' ? 'Web' : s;
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const ms = now - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

export function subjectShort(s: string): string {
  return s === 'Physics' ? 'Phy' : s === 'Chemistry' ? 'Chem' : s === 'Zoology' ? 'Zoo' : s === 'Botany' ? 'Bot' : s;
}
