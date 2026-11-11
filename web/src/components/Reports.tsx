import type { CaseDetail } from '../lib/types';

interface ReportsProps {
  c: CaseDetail;
  replies: Record<string, string>;
  onReplyChange: (reportId: string, text: string) => void;
}

function formatAge(dateStr: string): string {
  const days = Math.round((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function flagColor(flag: string): string {
  if (flag === 'injection') return 'bg-bad-50 text-red-700 font-bold';
  if (flag === 'gibberish') return 'bg-sunken text-tx-3';
  if (flag === 'language_request') return 'bg-ai-50 text-violet-700';
  return 'bg-sunken text-tx-3';
}

export function Reports({ c, replies, onReplyChange }: ReportsProps) {
  const reports = c.reports || [];

  return (
    <div className="bg-surface border border-line rounded-card p-4 mb-4 select-none">
      <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
        <span className="text-xs font-semibold text-tx-muted uppercase tracking-wider font-mono">
          Student Reports ({reports.length})
        </span>
      </div>

      <div className="space-y-4">
        {reports.map((r) => {
          const currentReply = replies[r.id] ?? (r.finalReply || r.aiReply || '');
          const charCount = currentReply.length;

          return (
            <div
              key={r.id}
              className="p-3 rounded border border-line bg-sunken/30 text-xs font-sans space-y-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap text-tx-muted">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-tx">{r.id}</span>
                  <span>·</span>
                  <span>{r.source}</span>
                  <span>·</span>
                  <span>{formatAge(r.reportedAt)}</span>
                  {r.lang && r.lang !== 'en' && (
                    <span className="text-[10px] bg-sunken text-tx-3 px-1.5 py-0.5 rounded uppercase font-mono">
                      {r.lang}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {r.flags.map((flag) => (
                    <span
                      key={flag}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${flagColor(flag)}`}
                    >
                      {flag}
                    </span>
                  ))}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sunken text-tx-3 font-medium">
                    {r.verdict}
                  </span>
                </div>
              </div>

              <blockquote className="border-l-2 border-line-strong pl-3 py-1 text-tx font-medium italic">
                "{r.comment}"
              </blockquote>

              {r.studentClaim && (
                <div className="text-[11px] text-tx-3">
                  <span className="font-semibold text-tx-2">Claim: </span>
                  <span>{r.studentClaim}</span>
                  <span className="ml-1 text-tx-muted">
                    ({r.studentWasRight ? 'accurate' : 'inaccurate'})
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-line/60">
                <div className="flex items-center justify-between text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
                  <span>Student Reply</span>
                  <span
                    className={
                      charCount > 600
                        ? 'text-red-600 font-bold'
                        : 'text-tx-muted font-normal'
                    }
                  >
                    {charCount} / 600
                  </span>
                </div>
                <textarea
                  value={currentReply}
                  onChange={(e) => onReplyChange(r.id, e.target.value)}
                  placeholder="Draft reply to student..."
                  rows={2}
                  maxLength={600}
                  className="w-full bg-surface border border-line rounded p-2 text-xs text-tx focus:outline-none focus:ring-1 focus:ring-pine-500 font-sans leading-relaxed"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
