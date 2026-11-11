import { Sparkles } from 'lucide-react';
import type { CaseView } from '../lib/adapt';
import { repairLabel } from '../lib/labels';
import { htmlText } from '../lib/diff';

/** Defects the AI saw on this question that no student mentioned. Suggestions only. */
export function AlsoNoticed({ c }: { c: CaseView }) {
  if (!c.otherIssues.length) return null;
  return (
    <section className="rounded-card border border-line bg-surface px-5 py-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-tx">
        <Sparkles size={15} className="text-ai-600" />
        Also noticed on this question
      </h3>
      <ul className="space-y-2.5 text-sm">
        {c.otherIssues.map((o, i) => (
          <li key={i}>
            <p className="text-tx">
              <span className="font-medium">{repairLabel(o.repair) || 'Issue'}</span>
              {o.field && <span className="text-tx-3"> in the {o.field}</span>}
              {o.note && <span className="text-tx-2">. {o.note}</span>}
            </p>
            {(o.find || o.replace) && (
              <p className="mt-0.5 font-display text-[15px]">
                <del className="rounded bg-bad-50 px-1 text-bad-600">{htmlText(o.find) || o.find}</del>{' '}
                <ins className="rounded bg-ok-50 px-1 text-ok-600 no-underline">{htmlText(o.replace) || '(removed)'}</ins>
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-tx-3">Not part of this decision. Listed so it can be fixed in a separate pass.</p>
    </section>
  );
}
