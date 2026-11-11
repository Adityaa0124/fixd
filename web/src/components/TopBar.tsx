import { useState, useRef, useEffect } from 'react';
import type { Lane } from '../lib/types';
import { reviewer, setReviewer } from '../lib/api';

interface TopBarProps {
  lane: Lane;
  counts: Record<string, number>;
  onSelectLane: (lane: Lane) => void;
  search: string;
  onSearchChange: (q: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenAudit: () => void;
  onOpenShortcuts: () => void;
}

export function TopBar({
  lane,
  counts,
  onSelectLane,
  search,
  onSearchChange,
  theme,
  onToggleTheme,
  onOpenAudit,
  onOpenShortcuts,
}: TopBarProps) {
  const [editingReviewer, setEditingReviewer] = useState(false);
  const [currentReviewer, setCurrentReviewer] = useState(reviewer());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleSlash = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        const target = e.target as HTMLElement;
        if (!target.closest('input, textarea')) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleSlash);
    return () => window.removeEventListener('keydown', handleSlash);
  }, []);

  const handleReviewerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReviewer(currentReviewer.trim() || 'faculty');
    setEditingReviewer(false);
  };

  const lanes: Array<{ key: Lane; label: string }> = [
    { key: 'needs_review', label: 'Needs you' },
    { key: 'spot_check', label: 'Spot check' },
    { key: 'no_change', label: 'No change' },
    { key: 'done', label: 'Done' },
    { key: 'sweep', label: 'Sweep' },
  ];

  return (
    <header className="h-14 border-b border-line bg-surface px-4 flex items-center justify-between gap-4 select-none shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5 font-sans font-bold text-xl tracking-tight text-ink">
          <span>fixd</span>
          <span className="w-1.5 h-1.5 rounded-full bg-pine-600 inline-block mb-1" />
        </div>

        <nav className="flex items-center gap-1">
          {lanes.map((l) => {
            const count = counts[l.key] ?? 0;
            const active = lane === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => onSelectLane(l.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-pine-50 text-pine-700 font-semibold'
                    : 'text-tx-3 hover:bg-sunken hover:text-tx'
                }`}
              >
                <span>{l.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-pine-100 text-pine-700' : 'bg-sunken text-tx-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search (/)"
            className="w-44 focus:w-60 transition-all text-xs bg-sunken border border-line rounded-full px-3 py-1.5 text-tx placeholder:text-tx-muted focus:outline-none focus:ring-1 focus:ring-pine-500"
          />
        </div>

        {editingReviewer ? (
          <form onSubmit={handleReviewerSubmit} className="flex items-center gap-1">
            <input
              type="text"
              value={currentReviewer}
              onChange={(e) => setCurrentReviewer(e.target.value)}
              className="text-xs bg-sunken border border-line rounded px-2 py-1 text-tx w-24 focus:outline-none focus:ring-1 focus:ring-pine-500"
              autoFocus
              onBlur={() => setEditingReviewer(false)}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditingReviewer(true)}
            className="text-xs text-tx-3 px-2 py-1 rounded hover:bg-sunken flex items-center gap-1"
            title="Click to edit reviewer identity"
          >
            <span>actor:</span>
            <span className="font-medium text-tx">{currentReviewer}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          className="p-1.5 rounded-full hover:bg-sunken text-tx-3 hover:text-tx transition-colors"
          title="Toggle light and dark theme (t)"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <button
          type="button"
          onClick={onOpenAudit}
          className="text-xs font-medium px-2.5 py-1 rounded-full border border-line hover:bg-sunken text-tx-2 transition-colors"
        >
          Audit
        </button>

        <button
          type="button"
          onClick={onOpenShortcuts}
          className="text-xs font-medium w-6 h-6 rounded-full border border-line hover:bg-sunken text-tx-3 hover:text-tx flex items-center justify-center transition-colors"
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
      </div>
    </header>
  );
}
