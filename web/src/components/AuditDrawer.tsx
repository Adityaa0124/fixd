import { useState } from 'react';
import type { AuditEntry } from '../lib/types';

interface AuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: AuditEntry[];
  isLoading: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AuditDrawer({ isOpen, onClose, entries, isLoading }: AuditDrawerProps) {
  const [filter, setFilter] = useState<'all' | 'ai' | 'faculty'>('all');

  if (!isOpen) return null;

  const filtered = entries.filter((e) => {
    if (filter === 'ai') return e.actor.includes('engine') || e.actor.includes('fixd');
    if (filter === 'faculty') return !e.actor.includes('engine') && !e.actor.includes('fixd') && e.actor !== 'system';
    return true;
  });

  return (
    <div className="fixed inset-0 bg-tx/20 backdrop-blur-xs flex justify-end z-50 select-none">
      <div className="w-[420px] max-w-full bg-surface border-l border-line h-full flex flex-col shadow-2xl">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-tx">Audit Trail</h3>
            <span className="text-xs text-tx-muted font-mono">({filtered.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-tx-muted hover:text-tx px-2 py-1 rounded"
          >
            Close (Esc)
          </button>
        </div>

        <div className="px-4 py-2 border-b border-line bg-sunken/40 flex items-center gap-1 text-xs">
          {(['all', 'ai', 'faculty'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full font-medium capitalize ${
                filter === f ? 'bg-surface text-tx shadow-xs font-semibold' : 'text-tx-3 hover:text-tx'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
          {isLoading ? (
            <div className="text-xs text-tx-muted text-center py-8">Loading audit trail...</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-tx-muted text-center py-8">No audit events recorded</div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className="p-3 rounded-card bg-sunken/40 border border-line text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-1 text-[11px] text-tx-muted">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-tx">{item.actor}</span>
                    <span>·</span>
                    <span className="font-mono text-pine-700 bg-pine-50 px-1.5 py-0.2 rounded text-[10px]">
                      {item.action}
                    </span>
                  </div>
                  <span title={new Date(item.at).toLocaleString()} className="font-mono">
                    {formatRelativeTime(item.at)}
                  </span>
                </div>

                <div className="text-tx font-medium leading-relaxed">{item.summary}</div>

                {item.questionId && (
                  <div className="text-[10px] text-tx-muted font-mono">
                    question: {item.questionId}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

