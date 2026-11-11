import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Inbox } from 'lucide-react';
import type { CaseSummary, Lane } from '../lib/types';
import { LANE_HINT } from '../lib/labels';
import { QueueRow } from './QueueRow';

interface Props {
  lane: Lane;
  items: CaseSummary[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  open: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function Queue({ lane, items, selectedId, loading, error, open, onSelect, onClose }: Props) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (selectedId) refs.current.get(selectedId)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/35 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={clsx(
          'fx-scroll z-30 flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface',
          'fixed inset-y-0 left-0 transition-transform duration-200 ease-fx lg:relative lg:translate-x-0',
          open ? 'translate-x-0 shadow-float' : '-translate-x-full'
        )}
        aria-label="Queue"
        data-tour="queue"
      >
        <p className="border-b border-line px-4 py-2.5 text-xs leading-relaxed text-tx-3">{LANE_HINT[lane]}</p>
        {loading && (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-sunken" />
            ))}
          </div>
        )}
        {error && !loading && <p className="p-4 text-sm text-bad-600">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <div className="px-6 py-14 text-center">
            <Inbox className="mx-auto mb-2 text-tx-3" size={20} />
            <p className="text-sm text-tx-2">Nothing here.</p>
          </div>
        )}
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={c.id}>
              <QueueRow
                ref={(el) => {
                  if (el) refs.current.set(c.id, el);
                  else refs.current.delete(c.id);
                }}
                c={c}
                selected={c.id === selectedId}
                onSelect={() => onSelect(c.id)}
              />
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
