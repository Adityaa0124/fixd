import type { CaseDetail } from '../lib/types';

interface CaseHeaderProps {
  c: CaseDetail;
}

function formatAge(dateStr: string | null): string {
  if (!dateStr) return '';
  const days = Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function CaseHeader({ c }: CaseHeaderProps) {
  const ub = c.urgencyBreakdown;
  const breakdownTooltip = ub
    ? `Formula: students(${ub.students}) × severity(${ub.severity}) × age(${ub.ageDays}d) × uncertainty(${ub.uncertainty})`
    : `Score: ${Math.round(c.urgency)}`;

  return (
    <div className="border-b border-line pb-4 mb-4 select-none">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-tx uppercase tracking-wider">
          <span>{c.subject}</span>
          <span className="text-tx-muted">·</span>
          <span>{c.chapter}</span>
          {c.qid && (
            <>
              <span className="text-tx-muted">·</span>
              <span className="font-mono text-tx-2 lowercase">{c.qid}</span>
            </>
          )}
          <span className="text-tx-muted">·</span>
          <span className="text-pine-700 bg-pine-50 px-2 py-0.5 rounded-full font-mono text-[11px] lowercase">
            {c.current.questionType}
          </span>
        </div>

        <div
          className="text-xs font-medium text-tx-3 bg-sunken px-2.5 py-1 rounded-full cursor-help flex items-center gap-1.5"
          title={breakdownTooltip}
        >
          <span>urgency:</span>
          <span className="font-bold text-tx">{Math.round(c.urgency)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-tx-muted">
        <span>{c.students} {c.students === 1 ? 'student report' : 'student reports'}</span>
        <span>·</span>
        <span>first reported {formatAge(c.firstReportedAt)}</span>
        <span>·</span>
        <span>version {c.currentVersion}</span>
      </div>
    </div>
  );
}
