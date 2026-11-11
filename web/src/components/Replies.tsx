import clsx from 'clsx';
import { Check, PenLine } from 'lucide-react';
import type { CaseView } from '../lib/adapt';

interface Props {
  c: CaseView;
  replies: Record<string, string>;
  editable: boolean;
  onChange: (reportId: string, text: string) => void;
}

/** The reply exactly as the student will read it. Drafts are editable until the case is acted on. */
export function Replies({ c, replies, editable, onChange }: Props) {
  if (!c.reports.length) return null;
  return (
    <section className="rounded-card border border-line bg-surface" data-tour="replies">
      <header className="border-b border-line px-5 py-3">
        <h3 className="text-sm font-medium text-tx">Reply to {c.reports.length === 1 ? 'the student' : `${c.reports.length} students`}</h3>
      </header>
      <ul className="divide-y divide-line">
        {c.reports.map((r) => {
          const sent = r.replyStatus === 'sent';
          const text = replies[r.id] ?? r.finalReply ?? r.aiReply ?? '';
          const changed = replies[r.id] != null && replies[r.id] !== (r.finalReply ?? r.aiReply);
          const canEdit = editable && !sent;
          return (
            <li key={r.id} className="px-5 py-4">
              <div className="mb-2 flex items-center gap-2 text-2xs text-tx-3">
                <span>To {r.id}</span>
                <span
                  className={clsx(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                    sent ? 'bg-pine-50 text-pine-600' : 'bg-sunken text-tx-2'
                  )}
                >
                  {sent ? <Check size={11} /> : <PenLine size={11} />}
                  {sent ? 'Sent' : changed ? 'Draft, edited by you' : 'Draft, sent when you act'}
                </span>
              </div>
              <div className="flex justify-start">
                {canEdit ? (
                  <label className="w-full max-w-[60ch]">
                    <span className="sr-only">Reply to {r.id}</span>
                    <textarea
                      value={text}
                      maxLength={600}
                      rows={Math.min(6, Math.max(2, Math.ceil(text.length / 70)))}
                      onChange={(e) => onChange(r.id, e.target.value)}
                      className="w-full resize-y rounded-2xl rounded-tl-sm border border-pine-500/30 bg-pine-50 px-3.5 py-2.5 text-[15px] leading-snug text-tx outline-none focus:border-pine-500"
                    />
                    <span className="mt-1 block text-right text-2xs text-tx-3">{text.length} / 600</span>
                  </label>
                ) : (
                  <p className="max-w-[60ch] rounded-2xl rounded-tl-sm bg-pine-50 px-3.5 py-2.5 text-[15px] leading-snug text-tx">{text}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
