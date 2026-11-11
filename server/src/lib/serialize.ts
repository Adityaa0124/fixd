import { htmlToText } from '@fixd/engine/html';
import type { Case, Question, QuestionVersion, Report } from '@prisma/client';

export type CaseWithReports = Case & { question: Question; reports: Report[] };

export function earliest(dates: Date[]): string | null {
  if (!dates.length) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString();
}

export function summary(
  c: CaseWithReports & { firstVersion?: QuestionVersion },
  blockedReason: string | null
) {
  return {
    id: c.id,
    questionId: c.questionId,
    qid: c.question.qid,
    subject: c.question.subject,
    chapter: c.question.chapter,
    verdict: c.verdict,
    repair: c.repair,
    route: c.route,
    status: c.status,
    confidence: c.confidence,
    urgency: c.urgency,
    students: new Set(c.reports.map((r) => r.studentId)).size,
    reports: c.reports.length,
    firstReportedAt: earliest(c.reports.map((r) => r.reportedAt)),
    preview: c.firstVersion ? htmlToText(c.firstVersion.questionHtml).slice(0, 140) : '',
    flags: [...new Set(c.reports.flatMap((r) => r.flags))],
    approvable: c.status === 'open' && blockedReason === null,
    blockedReason,
  };
}
