import { useState } from 'react';
import type { SweepFinding } from '../lib/types';

interface SweepPanelProps {
  findings: SweepFinding[];
}

export function SweepPanel({ findings }: SweepPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = findings[selectedIndex];

  if (findings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <h3 className="font-display italic text-2xl text-tx mb-2">No sweep findings</h3>
          <p className="text-xs text-tx-3">Run the sweep pipeline to discover unreported defects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sweep queue */}
      <aside className="w-80 md:w-96 border-r border-line bg-surface flex flex-col shrink-0 overflow-y-auto">
        {findings.map((f, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedIndex(idx)}
            className={`p-3 border-b border-line cursor-pointer text-xs select-none transition-colors ${
              idx === selectedIndex
                ? 'bg-pine-50/70 border-l-2 border-l-pine-600 pl-[10px]'
                : 'hover:bg-sunken'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="font-mono font-bold text-tx">
                {f.qid || f.questionId.slice(-6)}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                  f.status === 'confirmed'
                    ? 'bg-ok-50 text-green-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {f.status}
              </span>
            </div>

            <div className="text-[11px] font-medium text-tx-2 mb-1 flex items-center gap-1.5">
              <span>{f.repair || 'no repair'}</span>
              <span>·</span>
              <span className="text-tx-muted">{f.source}</span>
            </div>

            <p className="text-tx-3 line-clamp-1 font-sans">{f.note}</p>
          </div>
        ))}
      </aside>

      {/* Sweep detail */}
      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto">
        {selected && (
          <div className="space-y-4">
            <div className="border-b border-line pb-4">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <div className="text-xs font-semibold text-tx uppercase tracking-wider">
                  <span>{selected.subject}</span>
                  <span className="text-tx-muted mx-1">·</span>
                  <span>{selected.chapter}</span>
                  <span className="text-tx-muted mx-1">·</span>
                  <span className="font-mono">{selected.qid || selected.questionId}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      selected.status === 'confirmed'
                        ? 'bg-ok-50 text-green-700 border border-green-600/30'
                        : 'bg-amber-50 text-amber-700 border border-amber-600/30'
                    }`}
                  >
                    {selected.status}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-mono ${
                      selected.guardOk
                        ? 'bg-ok-50 text-green-700'
                        : 'bg-bad-50 text-red-700'
                    }`}
                  >
                    {selected.guardOk ? '✓ Guard Passed' : '✗ Guard Failed'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-tx-muted font-sans mt-2">
                Unreported defect discovered via {selected.source}
              </div>
            </div>

            <div className="bg-surface border border-line rounded-card p-4">
              <div className="text-xs font-semibold text-tx-muted uppercase tracking-wider font-mono mb-2">
                Evidence & Finding Note
              </div>
              <div className="text-sm font-medium text-tx leading-relaxed">
                {selected.note}
              </div>
            </div>

            {selected.edit && (
              <div className="bg-surface border border-line rounded-card p-4">
                <div className="text-xs font-semibold text-tx-muted uppercase tracking-wider font-mono mb-3">
                  Proposed Edit ({selected.edit.field})
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-tx-muted uppercase block text-[10px] mb-1">
                      Find Exact String:
                    </span>
                    <div className="bg-bad-50 text-red-700 p-2.5 rounded border border-red-200 whitespace-pre-wrap">
                      {selected.edit.find || '(empty)'}
                    </div>
                  </div>

                  <div>
                    <span className="text-tx-muted uppercase block text-[10px] mb-1">
                      Replacement:
                    </span>
                    <div className="bg-ok-50 text-green-700 p-2.5 rounded border border-green-200 whitespace-pre-wrap">
                      {selected.edit.replace || '(deleted)'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-sunken/60 rounded-card border border-line text-xs text-tx-3 italic">
              Note: This finding is part of the bonus bank sweep. No student reported this question.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
