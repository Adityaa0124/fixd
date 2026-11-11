import type { CaseDetail } from '../lib/types';

interface VerdictCardProps {
  c: CaseDetail;
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

export function VerdictCard({ c }: VerdictCardProps) {
  const gatesEntries = Object.entries(c.gates || {});

  return (
    <div className="bg-surface border border-line rounded-card p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
              c.verdict === 'defect'
                ? 'bg-bad-50 text-red-700'
                : c.verdict === 'no_error'
                ? 'bg-sunken text-tx-3'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {verdictLabel(c.verdict)}
          </span>
          {c.repair && (
            <span className="text-sm font-semibold text-tx">
              {c.repair}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-tx-3 font-mono">
          <span>confidence:</span>
          <span className="font-semibold text-tx">{(c.confidence * 100).toFixed(0)}%</span>
          <div className="w-16 h-2 bg-sunken rounded-full overflow-hidden inline-flex">
            <div
              className="bg-pine-600 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, c.confidence * 100))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="text-[15px] font-sans text-tx mb-3 font-medium leading-relaxed">
        {c.evidence || 'No evidence statement available.'}
      </div>

      {gatesEntries.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-line/60">
          <span className="text-[11px] text-tx-muted uppercase font-mono mr-1">gates:</span>
          {gatesEntries.map(([key, gate]) => (
            <span
              key={key}
              title={gate.detail || (gate.pass ? 'Passed' : 'Failed')}
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono cursor-help flex items-center gap-1 ${
                gate.pass
                  ? 'bg-ok-50 text-green-700 border border-green-600/20'
                  : 'bg-amber-50 text-amber-700 border border-amber-600/30 font-semibold'
              }`}
            >
              <span>{gate.pass ? '✓' : '✗'}</span>
              <span>{key}</span>
            </span>
          ))}
        </div>
      )}

      {c.guardErrors && c.guardErrors.length > 0 && (
        <div className="mt-3 p-2 bg-amber-50/80 border border-amber-600/30 rounded text-xs text-amber-800 space-y-1">
          <div className="font-semibold">Guard Warnings:</div>
          {c.guardErrors.map((err, idx) => (
            <div key={idx}>* {err}</div>
          ))}
        </div>
      )}
    </div>
  );
}

