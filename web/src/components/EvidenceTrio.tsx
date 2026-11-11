import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import type { CaseView } from '../lib/adapt';
import { answerLetters, formatAnswer } from '../lib/diff';

function same(a: string | null, b: unknown, type: string) {
  if (a == null) return false;
  if (type === 'integerQuestion') return Number(a) === Number(Array.isArray(b) ? b[0] : b);
  return answerLetters(a).sort().join() === answerLetters(b).sort().join() && answerLetters(a).length > 0;
}

/** Stored key vs independent solver vs what students claimed. Disagreement is coloured; agreement stays quiet. */
export function EvidenceTrio({ c }: { c: CaseView }) {
  const [open, setOpen] = useState<number | null>(null);
  const key = c.diffBefore.answer;
  const type = c.diffBefore.questionType;
  const solved = c.solves.filter((s) => s.answer != null);
  const solvesAgree = solved.length > 1 && solved.every((s) => s.answer === solved[0]!.answer);
  const keyDisputed = solved.length > 0 && solved.every((s) => !same(s.answer, key, type)) && solvesAgree;

  return (
    <section className="grid gap-3 md:grid-cols-3" data-tour="evidence">
      <div className={clsx('rounded-card border p-4', keyDisputed ? 'border-warn-600/40 bg-warn-50' : 'border-line bg-surface')}>
        <p className="text-xs text-tx-3">Stored answer key</p>
        <p className="mt-1 font-display text-2xl text-tx">{formatAnswer(key)}</p>
        <p className="mt-1 text-xs text-tx-3">{keyDisputed ? 'Every blind solve disagrees with it' : 'As stored in the bank'}</p>
      </div>

      <div className={clsx('rounded-card border p-4', solved.length > 1 && !solvesAgree ? 'border-warn-600/40 bg-warn-50' : 'border-line bg-surface')}>
        <p className="text-xs text-tx-3">Blind solves, never shown the key</p>
        {c.solves.length === 0 && <p className="mt-1 text-sm text-tx-3">Not run for this case</p>}
        <div className="mt-1 space-y-1.5">
          {c.solves.map((s, i) => (
            <div key={i}>
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                disabled={!s.steps.length}
              >
                <span className="font-display text-2xl text-tx">{s.answer ?? '?'}</span>
                <span className="text-xs text-tx-3">{s.solvable ? `solve ${i + 1}` : `solve ${i + 1}, missing ${s.missing ?? 'data'}`}</span>
                {s.steps.length > 0 && <ChevronDown size={14} className={clsx('ml-auto text-tx-3 transition-transform', open !== i && '-rotate-90')} />}
              </button>
              {open === i && (
                <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-tx-2">
                  {s.steps.map((st, j) => (
                    <li key={j}>{st}</li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-line bg-surface p-4">
        <p className="text-xs text-tx-3">What students claimed</p>
        <ul className="mt-1.5 space-y-1.5">
          {c.reports.map((r) => (
            <li key={r.id} className="text-sm leading-snug text-tx">
              <span className={clsx('mr-1.5 inline-block h-2 w-2 rounded-full align-middle', r.studentWasRight ? 'bg-ok-600' : 'bg-line-strong')} />
              {r.studentClaim || r.comment || 'No specific claim'}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
