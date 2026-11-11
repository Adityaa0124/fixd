import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Bot, ChevronDown, User, X } from 'lucide-react';
import type { AuditEntry, Snapshot } from '../lib/types';
import { ago } from '../lib/labels';
import { diffHtml, formatAnswer } from '../lib/diff';
import { MathHtml } from './MathHtml';

const ACTION_LABEL: Record<string, string> = {
  seed: 'Data loaded',
  auto_apply: 'AI applied a fix',
  approve: 'Approved',
  edit: 'Edited and applied',
  reject: 'Rejected',
  confirm: 'Kept AI fix',
  revert: 'Reverted AI fix',
  acknowledge: 'Closed',
  undo: 'Undone',
  demo_reset: 'Demo reset',
};

const isSnap = (x: unknown): x is Snapshot => !!x && typeof x === 'object' && 'question' in (x as object);

function Change({ before, after }: { before: Snapshot; after: Snapshot }) {
  const parts = (['question', 'solution'] as const).map((f) => ({ f, d: diffHtml(before[f], after[f]) })).filter((p) => p.d.kind !== 'same');
  const key = JSON.stringify(before.answer) !== JSON.stringify(after.answer);
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-sunken/60 p-3">
      {key && (
        <p className="text-sm">
          Answer key <del className="rounded bg-bad-50 px-1.5 text-bad-600">{formatAnswer(before.answer)}</del>{' '}
          <ins className="rounded bg-ok-50 px-1.5 text-ok-600 no-underline">{formatAnswer(after.answer)}</ins>
        </p>
      )}
      {parts.map(({ f, d }) => (
        <div key={f}>
          <p className="mb-1 text-2xs text-tx-3">In the {f}</p>
          <MathHtml small html={d.kind === 'inline' ? d.html : d.kind === 'block' ? d.after : ''} />
        </div>
      ))}
      {!key && !parts.length && <p className="text-xs text-tx-3">No content difference.</p>}
    </div>
  );
}

interface Props {
  open: boolean;
  entries: AuditEntry[];
  loading: boolean;
  unavailable: boolean;
  onClose: () => void;
  onOpenCase: (id: string) => void;
}

export function AuditDrawer({ open, entries, loading, unavailable, onClose, onOpenCase }: Props) {
  const [who, setWho] = useState<'all' | 'ai' | 'people'>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const isAi = (e: AuditEntry) => e.actor === 'fixd engine' || e.action === 'auto_apply';
  const list = entries.filter((e) => (who === 'all' ? true : who === 'ai' ? isAi(e) : !isAi(e) && e.actor !== 'system'));
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-label="Audit log" className="fx-drawer relative flex h-full w-full max-w-[460px] flex-col border-l border-line bg-surface shadow-float">
        <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-base font-medium text-tx">Audit log</h2>
          <div className="ml-auto flex rounded-full bg-sunken p-0.5 text-xs">
            {(['all', 'ai', 'people'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setWho(k)}
                className={clsx('rounded-full px-3 py-1', who === k ? 'bg-surface font-medium text-tx shadow-sm' : 'text-tx-3 hover:text-tx')}
              >
                {k === 'all' ? 'All' : k === 'ai' ? 'AI' : 'People'}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-tx-3 hover:bg-sunken" aria-label="Close audit log">
            <X size={16} />
          </button>
        </header>
        <div className="fx-scroll relative flex-1 overflow-y-auto">
          {unavailable && <p className="p-5 text-sm text-tx-3">The audit log lives on the server. Connect to the live server to see it.</p>}
          {loading && <p className="p-5 text-sm text-tx-3">Loading…</p>}
          {!loading && !unavailable && list.length === 0 && <p className="p-5 text-sm text-tx-3">No entries yet.</p>}
          <ol className="divide-y divide-line">
            {list.map((e) => {
              const hasDiff = isSnap(e.before) && isSnap(e.after);
              return (
                <li key={e.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span className={clsx('mt-0.5 rounded-full p-1', isAi(e) ? 'bg-ai-50 text-ai-600' : 'bg-pine-50 text-pine-600')}>
                      {isAi(e) ? <Bot size={13} /> : <User size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-tx">
                        <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
                        {e.qid || e.questionId ? <span className="ml-2 font-mono text-2xs text-tx-3">{e.qid ?? e.questionId?.slice(-8)}</span> : null}
                      </p>
                      <p className="text-xs leading-relaxed text-tx-2">{e.summary}</p>
                      <p className="mt-0.5 flex gap-3 text-2xs text-tx-3">
                        <span>{e.actor}</span>
                        <span>{ago(e.at)}</span>
                        {e.caseId && (
                          <button type="button" className="text-pine-600 hover:underline" onClick={() => onOpenCase(e.caseId!)}>
                            Open case
                          </button>
                        )}
                        {hasDiff && (
                          <button type="button" className="flex items-center gap-0.5 text-pine-600 hover:underline" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                            Before and after <ChevronDown size={12} className={clsx(expanded !== e.id && '-rotate-90')} />
                          </button>
                        )}
                      </p>
                      {hasDiff && expanded === e.id && <Change before={e.before as Snapshot} after={e.after as Snapshot} />}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
}
