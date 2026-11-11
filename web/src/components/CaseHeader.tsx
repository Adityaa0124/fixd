import clsx from 'clsx';
import { Info, MessageSquareQuote, ShieldAlert } from 'lucide-react';
import type { CaseView } from '../lib/adapt';
import { headline, rankReason, type Tone } from '../lib/headline';
import { FLAG_LABEL, STATUS_LABEL, ago, sourceLabel, verdictLabel } from '../lib/labels';

const toneCls: Record<Tone, string> = {
  ok: 'bg-ok-50 text-ok-600',
  warn: 'bg-warn-50 text-warn-600',
  bad: 'bg-bad-50 text-bad-600',
  neutral: 'bg-sunken text-tx-2',
};

/** The five second read: what this is, what the AI wants, why, and what students said. */
export function CaseHeader({ c }: { c: CaseView }) {
  const h = headline(c);
  const firstAt = c.reports.map((r) => r.reportedAt).sort((a, b) => +new Date(a) - +new Date(b))[0];
  return (
    <div className="space-y-5" data-tour="headline">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tx-3">
        <span className="font-medium text-tx-2">{c.subject}</span>
        <span>{c.chapter}</span>
        <span className="font-mono text-2xs">{c.qid ?? c.questionId.slice(-8)}</span>
        <span className="ml-auto flex items-center gap-1.5" title={rankReason(c)}>
          <Info size={13} />
          {`${STATUS_LABEL[c.status] ?? c.status}${c.currentVersion > 1 ? `, now version ${c.currentVersion}` : ''}`}
        </span>
      </div>

      <div>
        <p className={clsx('mb-1.5 text-xs font-medium', c.verdict === 'defect' ? 'text-bad-600' : 'text-pine-600')}>{verdictLabel(c.verdict)}</p>
        <h1 className="font-display text-[26px] leading-[1.2] tracking-[-0.01em] text-tx sm:text-[30px]">{h.title}</h1>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {h.facts.map((f) => (
            <li key={f.text} className={clsx('rounded-full px-2.5 py-1 text-xs font-medium', toneCls[f.tone])}>
              {f.text}
            </li>
          ))}
        </ul>
        {c.evidence && <p className="mt-3 max-w-[72ch] text-sm leading-relaxed text-tx-2">{c.evidence}</p>}
        <p className="mt-2 text-xs text-tx-3">{rankReason(c)}</p>
      </div>

      <div className="space-y-2">
        {c.reports.map((r) => {
          const flagged = r.flags.filter((f) => f === 'injection' || f === 'gibberish');
          return (
            <figure key={r.id} className="flex gap-3">
              <MessageSquareQuote size={17} className="mt-1 shrink-0 text-tx-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <blockquote
                  className={clsx(
                    'inline-block max-w-full rounded-2xl rounded-tl-sm px-3.5 py-2 text-[15px] leading-snug',
                    flagged.length ? 'border border-bad-600/30 bg-bad-50 text-tx' : 'bg-sunken text-tx'
                  )}
                >
                  {r.comment || <em className="text-tx-3">empty comment</em>}
                </blockquote>
                <figcaption className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-tx-3">
                  <span>{r.id}</span>
                  <span>{sourceLabel(r.source)}</span>
                  <span>{ago(r.reportedAt)}</span>
                  {r.lang === 'hinglish' && <span>Hinglish</span>}
                  {r.flags.map((f) => (
                    <span key={f} className={clsx('flex items-center gap-1', (f === 'injection' || f === 'gibberish') && 'font-medium text-bad-600')}>
                      {f === 'injection' && <ShieldAlert size={12} />}
                      {FLAG_LABEL[f] ?? f}
                    </span>
                  ))}
                  {c.reports.length > 1 && (
                    <span className={r.studentWasRight ? 'text-ok-600' : ''}>{r.studentWasRight ? 'right' : 'mistaken'}</span>
                  )}
                </figcaption>
              </div>
            </figure>
          );
        })}
        {firstAt && c.reports.length > 1 && (
          <p className="pl-8 text-2xs text-tx-3">
            {c.reports.length} reports from {new Set(c.reports.map((r) => r.studentId)).size} students, first {ago(firstAt)}
          </p>
        )}
      </div>
    </div>
  );
}
