import { forwardRef } from 'react';
import clsx from 'clsx';
import { ShieldAlert, Users } from 'lucide-react';
import type { CaseSummary } from '../lib/types';
import { ago, repairLabel, subjectShort, verdictLabel } from '../lib/labels';

const SEVERE = new Set(['answer_key', 'wrong_question', 'unsound', 'type_mismatch', 'stem_data', 'option_repair', 'identical_options', 'diagram']);

export const QueueRow = forwardRef<HTMLButtonElement, { c: CaseSummary; selected: boolean; onSelect: () => void }>(function QueueRow(
  { c, selected, onSelect },
  ref
) {
  const defect = c.verdict === 'defect';
  const title = defect ? repairLabel(c.repair) || 'Defect' : verdictLabel(c.verdict);
  const dot = defect ? (SEVERE.has(c.repair ?? '') ? 'bg-bad-600' : 'bg-warn-600') : 'bg-line-strong';
  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={clsx(
        'block w-full border-l-[3px] px-4 py-3 text-left transition-colors',
        selected ? 'border-pine-600 bg-pine-50' : 'border-transparent hover:bg-sunken'
      )}
    >
      <div className="flex items-center gap-2">
        <span className={clsx('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />
        <span className="truncate text-sm font-medium text-tx">{title}</span>
        {c.flags.includes('injection') && <ShieldAlert size={13} className="shrink-0 text-bad-600" aria-label="Report tried to give orders" />}
        <span className="ml-auto shrink-0 text-2xs text-tx-3">{ago(c.firstReportedAt)}</span>
      </div>
      <p className="mt-1 line-clamp-2 pl-4 font-display text-[14px] leading-snug text-tx-2">{c.preview}</p>
      <p className="mt-1.5 flex items-center gap-3 pl-4 text-2xs text-tx-3">
        <span>{subjectShort(c.subject)}</span>
        <span className="truncate font-mono">{c.qid ?? c.questionId.slice(-8)}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <Users size={11} />
          {c.students}
        </span>
      </p>
    </button>
  );
});
