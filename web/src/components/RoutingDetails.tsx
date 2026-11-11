import { useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, X } from 'lucide-react';
import type { CaseView } from '../lib/adapt';
import { repairDefinition, repairLabel } from '../lib/labels';

/** Why the AI routed it this way. Collapsed by default: useful when trust is in doubt, noise otherwise. */
export function RoutingDetails({ c }: { c: CaseView }) {
  const failing = c.gates.filter((g) => !g.pass);
  const [open, setOpen] = useState(false);
  const routeText =
    c.route === 'auto_apply' ? 'Applied automatically' : c.route === 'faculty_review' ? 'Sent to a person' : 'No change needed';
  return (
    <section className="rounded-card border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left"
        aria-expanded={open}
      >
        <ChevronDown size={15} className={clsx('text-tx-3 transition-transform', !open && '-rotate-90')} />
        <span className="text-sm font-medium text-tx">Why it was routed here</span>
        <span className="text-xs text-tx-3">
          {routeText}
          {failing.length > 0 && `, ${failing.length} safety ${failing.length === 1 ? 'check' : 'checks'} not met`}
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-line px-5 py-4 text-sm">
          {c.repair && (
            <p className="text-tx-2">
              <span className="font-medium text-tx">{repairLabel(c.repair)}.</span> {repairDefinition(c.repair)}
            </p>
          )}
          {c.gates.length > 0 && (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {c.gates.map((g) => (
                <li key={g.name} className="flex items-start gap-2">
                  {g.pass ? <Check size={15} className="mt-0.5 shrink-0 text-ok-600" /> : <X size={15} className="mt-0.5 shrink-0 text-bad-600" />}
                  <span>
                    <span className="text-tx">{g.label}</span>
                    {g.detail && <span className="block text-xs text-tx-3">{g.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {c.guardErrors.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-tx-3">Scope guard</p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-tx-2">
                {c.guardErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {c.editsRejected.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-tx-3">Edits the guard refused (never applied)</p>
              {c.editsRejected.map((e, i) => (
                <pre key={i} className="fx-scroll mb-1 overflow-x-auto whitespace-pre-wrap rounded bg-sunken p-2 font-mono text-2xs text-tx-2">
                  {e.field}: {e.find}
                  {'\n'}→ {e.replace}
                </pre>
              ))}
            </div>
          )}
          {c.findings.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-tx-3">Automatic text checks</p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-tx-2">
                {c.findings.map((f, i) => (
                  <li key={i}>
                    {f.field && <span className="text-tx-3">{f.field}: </span>}
                    {f.detail}
                    {!f.certain && <span className="text-tx-3"> (heuristic)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
