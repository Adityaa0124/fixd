import type { RawReport } from '@fixd/shared';

export interface CaseGroup {
  questionId: string;
  reports: RawReport[];         // sorted by reportedAt ascending
  firstReportedAt: string;
}

export function groupReports(reports: RawReport[]): CaseGroup[] {
  const m = new Map<string, RawReport[]>();
  for (const r of reports) m.set(r.questionId, [...(m.get(r.questionId) ?? []), r]);
  return [...m.entries()].map(([questionId, rs]) => {
    const sorted = [...rs].sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
    return { questionId, reports: sorted, firstReportedAt: sorted[0]!.reportedAt };
  });
}
