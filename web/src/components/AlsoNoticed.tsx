import { useState } from 'react';
import type { CaseDetail } from '../lib/types';

interface AlsoNoticedProps {
  c: CaseDetail;
}

export function AlsoNoticed({ c }: AlsoNoticedProps) {
  const [open, setOpen] = useState(false);
  const issues = c.otherIssues || [];

  if (issues.length === 0) return null;

  return (
    <div className="bg-surface border border-line rounded-card p-4 mb-4 select-none">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-tx uppercase tracking-wider font-mono">
            Also Noticed ({issues.length})
          </span>
          <span className="text-[11px] text-tx-muted font-sans">
            Unreported issues detected during triage
          </span>
        </div>
        <span className="text-xs text-tx-muted">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-line/60 pt-3 text-xs">
          {issues.map((issue, idx) => (
            <div key={idx} className="p-2.5 rounded bg-sunken/40 border border-line flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase font-semibold text-pine-700 bg-pine-50 px-1.5 py-0.5 rounded">
                  {issue.field}
                </span>
                <span className="text-tx font-medium">{issue.claim}</span>
              </div>
              {issue.edit && (
                <div className="text-[11px] font-mono text-tx-muted mt-1 bg-surface p-1.5 rounded border border-line/40">
                  find: "{issue.edit.find}" → replace: "{issue.edit.replace}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
