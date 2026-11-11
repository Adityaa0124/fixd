import type { CaseSummary } from '../lib/types';

interface QueueRowProps {
  item: CaseSummary;
  selected: boolean;
  onSelect: () => void;
}

function formatAge(dateStr: string | null): string {
  if (!dateStr) return '';
  const days = Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function verdictLabel(v: string): string {
  if (v === 'defect') return 'defect';
  if (v === 'no_error') return 'student mistake';
  if (v === 'display') return 'display';
  if (v === 'app_bug') return 'app bug';
  if (v === 'language') return 'language';
  if (v === 'already_fixed') return 'already fixed';
  if (v === 'no_content') return 'no content';
  return v;
}

export function QueueRow({ item, selected, onSelect }: QueueRowProps) {
  const urgencyBars = Math.min(5, Math.max(1, Math.round(item.urgency / 20)));

  return (
    <div
      onClick={onSelect}
      className={`p-3 border-b border-line cursor-pointer transition-colors text-xs select-none ${
        selected
          ? 'bg-pine-50/70 border-l-2 border-l-pine-600 pl-[10px]'
          : 'hover:bg-sunken'
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              item.verdict === 'defect'
                ? 'bg-bad-50 text-red-700'
                : item.verdict === 'no_error'
                ? 'bg-sunken text-tx-3'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {verdictLabel(item.verdict)}
          </span>
          {item.repair && (
            <span className="text-[11px] font-medium text-tx-2">
              {item.repair}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5" title={`Urgency score: ${Math.round(item.urgency)}`}>
          {[...Array(5)].map((_, i) => (
            <span
              key={i}
              className={`w-1 h-2 rounded-[1px] ${
                i < urgencyBars ? 'bg-pine-600' : 'bg-line-strong'
              }`}
            />
          ))}
        </div>
      </div>

      <p className="text-tx-3 line-clamp-1 mb-1.5 font-sans">
        {item.preview || 'No question preview'}
      </p>

      <div className="flex items-center justify-between text-[11px] text-tx-muted">
        <div className="flex items-center gap-1.5">
          <span>{item.students} {item.students === 1 ? 'student' : 'students'}</span>
          <span>·</span>
          <span>{formatAge(item.firstReportedAt)}</span>
        </div>
        {item.flags.length > 0 && (
          <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-medium">
            {item.flags[0]}
          </span>
        )}
      </div>
    </div>
  );
}
