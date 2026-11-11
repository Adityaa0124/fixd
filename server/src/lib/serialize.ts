import { htmlToText } from '@fixd/engine/html';
import type { Case, Question, QuestionVersion, Report } from '@prisma/client';

export function summary(c: Case & { question: Question; reports: Report[]; firstVersion?: QuestionVersion }) {
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
    firstReportedAt: c.reports.map((r) => r.reportedAt).sort()[0] ?? null,
    preview: c.firstVersion ? htmlToText(c.firstVersion.questionHtml).slice(0, 140) : '',
    flags: [...new Set(c.reports.flatMap((r) => r.flags))],
  };
}
