import type { CaseSummary } from '../lib/types';
import { QueueRow } from './QueueRow';

interface QueueProps {
  items: CaseSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

export function Queue({ items, selectedId, onSelect, isLoading }: QueueProps) {
  if (isLoading) {
    return (
      <aside className="w-80 md:w-96 border-r border-line bg-surface flex flex-col shrink-0 overflow-y-auto">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-3 border-b border-line animate-pulse space-y-2">
            <div className="h-4 bg-sunken rounded w-1/3" />
            <div className="h-3 bg-sunken rounded w-3/4" />
            <div className="h-3 bg-sunken rounded w-1/2" />
          </div>
        ))}
      </aside>
    );
  }

  if (items.length === 0) {
    return (
      <aside className="w-80 md:w-96 border-r border-line bg-surface flex flex-col items-center justify-center p-8 text-center shrink-0">
        <h3 className="font-display italic text-2xl text-tx mb-2">Nothing waiting</h3>
        <p className="text-xs text-tx-3 max-w-xs font-sans">
          All reports in this lane have been resolved or reviewed.
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-80 md:w-96 border-r border-line bg-surface flex flex-col shrink-0 overflow-y-auto">
      {items.map((item) => (
        <QueueRow
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </aside>
  );
}

