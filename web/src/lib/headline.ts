import type { CaseView } from './adapt';
import { answerLetters, diffHtml, formatAnswer } from './diff';
import { TYPE_LABEL, repairLabel } from './labels';

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
export interface Fact {
  text: string;
  tone: Tone;
}

const NON_DEFECT_TITLE: Record<string, string> = {
  no_error: 'The question is correct. The student slipped.',
  already_fixed: 'Already fixed in the live question.',
  display_issue: 'The stored question is fine. This is a display problem.',
  app_issue: 'An app problem, not this question.',
  language_mode: 'Asks for a language this question is not in.',
  not_actionable: 'Nothing usable in the report, and the checks found nothing.',
};

function sameAns(a: string | null, b: unknown, type: string): boolean {
  if (a == null) return false;
  if (type === 'integerQuestion') {
    const x = Number(String(a).trim());
    const y = Number(String(Array.isArray(b) ? b[0] : b).trim());
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x));
  }
  const la = answerLetters(a).sort().join();
  const lb = answerLetters(b).sort().join();
  return la !== '' && la === lb;
}

function short(s: string, n = 46) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

export function headline(c: CaseView): { title: string; facts: Fact[] } {
  const facts: Fact[] = [];
  const before = c.diffBefore;
  const after = c.diffAfter;
  const type = before.questionType;
  const keyChanged = !!after && JSON.stringify(after.answer) !== JSON.stringify(before.answer);
  const typeChanged = !!after && after.questionType !== before.questionType;

  let title: string;
  if (c.verdict !== 'defect') {
    title = NON_DEFECT_TITLE[c.verdict] ?? 'No change needed.';
  } else if (keyChanged) {
    title = `Answer key ${formatAnswer(before.answer)} → ${formatAnswer(after!.answer)}`;
  } else if (typeChanged) {
    title = `${TYPE_LABEL[before.questionType] ?? before.questionType} → ${TYPE_LABEL[after!.questionType] ?? after!.questionType}`;
  } else if (after) {
    const field = after.question !== before.question ? 'question' : 'solution';
    const d = diffHtml(before[field], after[field]);
    const label = repairLabel(c.repair) || 'Fix';
    if (d.kind !== 'same' && d.removedText.length <= 40 && d.addedText.length <= 40 && (d.removedText || d.addedText)) {
      title = d.removedText && d.addedText
        ? `${label}: “${short(d.removedText)}” → “${short(d.addedText)}”`
        : d.removedText
          ? `${label}: remove “${short(d.removedText)}”`
          : `${label}: add “${short(d.addedText)}”`;
    } else {
      title = `${label} in the ${field}`;
    }
  } else if (c.applyError) {
    title = `${repairLabel(c.repair) || 'Defect'}. The proposed edit does not fit the text.`;
  } else {
    title = `${repairLabel(c.repair) || 'Defect'}. Needs your decision.`;
  }

  // Independent evidence, in plain words
  const answers = c.solves.map((s) => s.answer);
  const n = answers.length;
  if (n) {
    if (c.agreement.solvable === false || answers.every((a) => a == null)) {
      facts.push({ text: 'Blind solver could not solve it', tone: 'warn' });
    } else if (keyChanged) {
      const k = answers.filter((a) => sameAns(a, after!.answer, type)).length;
      facts.push({ text: `${k} of ${n} blind solves give ${formatAnswer(after!.answer)}`, tone: k === n ? 'ok' : 'warn' });
    } else {
      const k = answers.filter((a) => sameAns(a, before.answer, type)).length;
      facts.push(
        k === n
          ? { text: `${n} of ${n} blind solves match the key`, tone: c.verdict === 'defect' ? 'neutral' : 'ok' }
          : { text: `${k} of ${n} blind solves match the key`, tone: 'warn' }
      );
    }
  }
  if (keyChanged && c.agreement.solutionMatchesProposed != null) {
    facts.push(
      c.agreement.solutionMatchesProposed
        ? { text: 'Stored solution agrees', tone: 'ok' }
        : { text: 'Stored solution disagrees', tone: 'warn' }
    );
  }
  const right = c.reports.filter((r) => r.studentWasRight).length;
  const total = c.reports.length;
  if (total) {
    facts.push(
      total === 1
        ? right
          ? { text: 'Student was right', tone: 'ok' }
          : { text: 'Student was mistaken', tone: 'neutral' }
        : { text: `${right} of ${total} students right`, tone: right ? 'ok' : 'neutral' }
    );
  }
  facts.push({ text: `${Math.round(c.confidence * 100)}% confident`, tone: c.confidence >= 0.85 ? 'neutral' : 'warn' });
  return { title, facts };
}

/** Why the case sits where it does in the queue, in words. */
export function rankReason(c: CaseView): string {
  const u = c.urgency;
  const parts: string[] = [];
  parts.push(c.verdict === 'defect' && c.repair ? `${repairLabel(c.repair).toLowerCase()} (severity ${u.severity} of 10)` : 'not a defect');
  parts.push(`${u.students} ${u.students === 1 ? 'student' : 'students'} hit it`);
  if (u.ageDays >= 1) parts.push(`open ${Math.round(u.ageDays)} days`);
  if (u.uncertainty > 1.05) parts.push('AI unsure, so a person should look sooner');
  return `Ranked by harm: ${parts.join(', ')}.`;
}
