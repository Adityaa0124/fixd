import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, CircleSlash, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import type { CaseView } from '../lib/adapt';
import { answerLetters, diffHtml, formatAnswer, type HtmlDiff } from '../lib/diff';
import { TYPE_LABEL } from '../lib/labels';
import { MathHtml } from './MathHtml';

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface" data-tour="change">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h3 className="text-sm font-medium text-tx">{title}</h3>
        {aside}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function FieldDiff({ label, d }: { label: string; d: HtmlDiff }) {
  if (d.kind === 'same') return null;
  if (d.kind === 'inline') {
    return (
      <div>
        <p className="mb-2 text-xs text-tx-3">{label}</p>
        <MathHtml html={d.html} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-tx-3">{label}: large change, shown in full</p>
      <div className="rounded-lg border-l-[3px] border-bad-600/60 bg-bad-50/40 px-4 py-3">
        <p className="mb-1 text-2xs font-medium text-bad-600">Before</p>
        <MathHtml html={d.before} small />
      </div>
      <div className="rounded-lg border-l-[3px] border-ok-600/60 bg-ok-50/40 px-4 py-3">
        <p className="mb-1 text-2xs font-medium text-ok-600">After</p>
        <MathHtml html={d.after} small />
      </div>
    </div>
  );
}

export function OptionsList({ c, oldKey, newKey }: { c: CaseView; oldKey: unknown; newKey?: unknown }) {
  if (!c.options.length) return null;
  const was = answerLetters(oldKey);
  const now = newKey === undefined ? was : answerLetters(newKey);
  const changed = newKey !== undefined && was.join() !== now.join();
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {c.options.map((o) => {
        const isWas = was.includes(o.label);
        const isNow = now.includes(o.label);
        return (
          <li
            key={o.label}
            className={clsx(
              'flex items-start gap-3 rounded-lg border px-3 py-2 text-sm',
              changed && isNow && !isWas && 'border-ok-600/40 bg-ok-50',
              changed && isWas && !isNow && 'border-bad-600/40 bg-bad-50',
              (!changed || (isWas && isNow)) && isNow && 'border-pine-500/40 bg-pine-50',
              !isWas && !isNow && 'border-line'
            )}
          >
            <span className="w-4 shrink-0 font-medium text-tx-2">{o.label}</span>
            <span className={clsx('flex-1 font-display text-[15px]', o.blank && 'italic text-bad-600')}>{o.blank ? 'blank' : o.text}</span>
            {changed && isWas && !isNow && <span className="shrink-0 text-2xs font-medium text-bad-600">was keyed</span>}
            {changed && isNow && !isWas && <span className="shrink-0 text-2xs font-medium text-ok-600">new key</span>}
            {(!changed || (isWas && isNow)) && isNow && <span className="shrink-0 text-2xs font-medium text-pine-600">keyed</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Collapsible({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-t border-line pt-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-sm text-tx-2 hover:text-tx" aria-expanded={open}>
        <ChevronDown size={15} className={clsx('transition-transform', !open && '-rotate-90')} />
        {title}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** The change itself: one inline red pen view per field, plus the unchanged rest on demand. */
export function ChangeView({ c }: { c: CaseView }) {
  const before = c.diffBefore;
  const after = c.diffAfter;
  const diffs = useMemo(() => {
    if (!after) return null;
    return {
      question: diffHtml(before.question, after.question),
      solution: diffHtml(before.solution, after.solution),
      key: JSON.stringify(before.answer) !== JSON.stringify(after.answer),
      type: before.questionType !== after.questionType,
    };
  }, [before, after]);

  const anyChange = !!diffs && (diffs.key || diffs.type || diffs.question.kind !== 'same' || diffs.solution.kind !== 'same');
  const title =
    c.lane === 'needs_review' ? 'Proposed change' : c.lane === 'spot_check' ? 'What the AI changed' : anyChange ? 'What changed' : 'Question';

  return (
    <Section
      title={title}
      aside={
        anyChange ? (
          <span className="flex items-center gap-3 text-2xs text-tx-3">
            <span className="rounded bg-bad-50 px-1.5 text-bad-600 line-through">removed</span>
            <span className="rounded bg-ok-50 px-1.5 text-ok-600 underline underline-offset-2">added</span>
          </span>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {c.applyError && (
          <div className="flex gap-3 rounded-lg border border-warn-600/30 bg-warn-50 px-4 py-3 text-sm text-tx">
            <TriangleAlert size={17} className="mt-0.5 shrink-0 text-warn-600" />
            <div className="space-y-2">
              <p>
                The AI&apos;s edit does not match the stored text, so it cannot be applied as written. Use Edit to write the fix.
              </p>
              {c.edits.map((e, i) => (
                <pre key={i} className="fx-scroll overflow-x-auto whitespace-pre-wrap rounded bg-surface p-2 font-mono text-2xs text-tx-2">
                  {e.field}: {e.find} {'\n'}→ {e.replace}
                </pre>
              ))}
            </div>
          </div>
        )}

        {!anyChange && !c.applyError && (
          <p className="flex items-center gap-2 text-sm text-tx-3">
            <CircleSlash size={15} />
            {c.lane === 'needs_review' && c.verdict === 'defect'
              ? 'No edit proposed. This repair needs a person to decide what to change.'
              : 'No content change.'}
          </p>
        )}

        {diffs?.type && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-tx-3">Question type</span>
            <span className="rounded-full bg-bad-50 px-3 py-1 text-bad-600 line-through">{TYPE_LABEL[before.questionType] ?? before.questionType}</span>
            <ArrowRight size={15} className="text-tx-3" />
            <span className="rounded-full bg-ok-50 px-3 py-1 text-ok-600">{TYPE_LABEL[after!.questionType] ?? after!.questionType}</span>
          </div>
        )}

        {diffs?.key && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-tx-3">Answer key</span>
              <span className="rounded-full bg-bad-50 px-3 py-1 font-medium text-bad-600 line-through">{formatAnswer(before.answer)}</span>
              <ArrowRight size={15} className="text-tx-3" />
              <span className="rounded-full bg-ok-50 px-3 py-1 font-medium text-ok-600">{formatAnswer(after!.answer)}</span>
            </div>
            <OptionsList c={c} oldKey={before.answer} newKey={after!.answer} />
          </div>
        )}

        {diffs && <FieldDiff label="In the question" d={diffs.question} />}
        {diffs && <FieldDiff label="In the solution" d={diffs.solution} />}

        {(!diffs || diffs.question.kind === 'same') && (
          <div className={clsx(anyChange && 'border-t border-line pt-4')}>
            {anyChange && <p className="mb-2 text-xs text-tx-3">Question, unchanged</p>}
            <MathHtml html={(after ?? before).question} />
            {!diffs?.key && (
              <div className="mt-3">
                <OptionsList c={c} oldKey={(after ?? before).answer} />
                {c.options.length === 0 && (
                  <p className="text-sm text-tx-2">
                    Answer key <span className="ml-1 rounded-full bg-pine-50 px-2.5 py-0.5 font-medium text-pine-600">{formatAnswer((after ?? before).answer)}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {(!diffs || diffs.solution.kind === 'same') && (
          <Collapsible title="Solution" defaultOpen={c.verdict === 'no_error'}>
            <MathHtml html={(after ?? before).solution || '<p><em>No solution stored.</em></p>'} small />
          </Collapsible>
        )}
      </div>
    </Section>
  );
}
