import { forwardRef } from 'react';
import clsx from 'clsx';
import { Compass, History, Keyboard, Menu, Moon, RotateCcw, Search, Sun } from 'lucide-react';
import type { Lane } from '../lib/types';
import { LANE_HINT, LANE_LABEL } from '../lib/labels';

const LANES: Lane[] = ['needs_review', 'spot_check', 'no_change', 'done', 'sweep'];

interface Props {
  lane: Lane;
  counts: Partial<Record<Lane, number>>;
  onLane: (l: Lane) => void;
  search: string;
  onSearch: (s: string) => void;
  theme: 'light' | 'dark';
  onTheme: () => void;
  onAudit: () => void;
  onHelp: () => void;
  onReset: (() => void) | null;
  onMenu: () => void;
  onTour: () => void;
}

export const TopBar = forwardRef<HTMLInputElement, Props>(function TopBar(p, searchRef) {
  return (
    <header className="z-20 shrink-0 border-b border-line bg-surface">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <button type="button" onClick={p.onMenu} className="rounded-full p-2 text-tx-2 hover:bg-sunken lg:hidden" aria-label="Show queue">
          <Menu size={18} />
        </button>
        <span className="flex items-baseline gap-1 pr-2 text-[21px] font-bold tracking-[-0.03em] text-tx">
          fixd<span className="h-1.5 w-1.5 rounded-full bg-pine-600" />
        </span>
        <nav className="fx-scroll hidden min-w-0 items-center gap-1 overflow-x-auto md:flex" aria-label="Lanes" data-tour="lanes">
          {LANES.map((l, i) => (
            <button
              key={l}
              type="button"
              title={`${LANE_HINT[l]} (${i + 1})`}
              onClick={() => p.onLane(l)}
              aria-current={p.lane === l ? 'page' : undefined}
              className={clsx(
                'flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm transition-colors',
                p.lane === l ? 'bg-tx text-bg' : 'text-tx-2 hover:bg-sunken hover:text-tx'
              )}
            >
              {LANE_LABEL[l]}
              <span className={clsx('min-w-[1.25rem] rounded-full px-1.5 text-center text-xs tabular-nums', p.lane === l ? 'bg-bg/20' : 'bg-sunken text-tx-3')}>
                {p.counts[l] ?? 0}
              </span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <label className="relative hidden sm:block">
            <span className="sr-only">Search cases</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx-3" />
            <input
              ref={searchRef}
              value={p.search}
              onChange={(e) => p.onSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (e.currentTarget as HTMLInputElement).blur()}
              placeholder="Search  /"
              className="h-8 w-44 rounded-full border border-line bg-sunken pl-8 pr-3 text-sm text-tx outline-none placeholder:text-tx-3 focus:border-pine-500 focus:bg-surface xl:w-56"
            />
          </label>
          <button type="button" onClick={p.onTour} className="flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-tx-2 hover:bg-sunken hover:text-tx" title="Take the 40 second tour">
            <Compass size={15} />
            <span className="hidden xl:inline">Tour</span>
          </button>
          {p.onReset && (
            <button type="button" onClick={p.onReset} data-tour="reset" className="flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-tx-2 hover:bg-sunken hover:text-tx" title="Restore the demo to its starting state">
              <RotateCcw size={14} />
              <span className="hidden xl:inline">Reset demo</span>
            </button>
          )}
          <button type="button" onClick={p.onAudit} className="flex h-8 items-center gap-1.5 rounded-full px-3 text-sm text-tx-2 hover:bg-sunken hover:text-tx" title="Audit log (L)">
            <History size={15} />
            <span className="hidden xl:inline">Audit log</span>
          </button>
          <button type="button" onClick={p.onHelp} className="rounded-full p-2 text-tx-2 hover:bg-sunken hover:text-tx" aria-label="Keyboard shortcuts" title="Keyboard (?)">
            <Keyboard size={16} />
          </button>
          <button type="button" onClick={p.onTheme} className="rounded-full p-2 text-tx-2 hover:bg-sunken hover:text-tx" aria-label={p.theme === 'light' ? 'Dark theme' : 'Light theme'}>
            {p.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>
      <nav className="fx-scroll flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Lanes">
        {LANES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => p.onLane(l)}
            className={clsx('flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm', p.lane === l ? 'bg-tx text-bg' : 'bg-sunken text-tx-2')}
          >
            {LANE_LABEL[l]} <span className="text-xs opacity-70">{p.counts[l] ?? 0}</span>
          </button>
        ))}
      </nav>
    </header>
  );
});
