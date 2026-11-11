import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import type { SweepFindingRaw } from '../lib/types';
import { repairLabel } from '../lib/labels';
import { htmlText } from '../lib/diff';

const SOURCE_LABEL: Record<string, string> = {
  static: 'Found by text checks',
  triage_other_issue: 'Noticed while checking a report',
  sweep_triage: 'Found by the sweep',
  key_check: 'Answer key check',
};

/** Defects nobody reported. Read only suggestions: they flow into the same review once confirmed. */
export function SweepPanel({ findings }: { findings: SweepFindingRaw[] }) {
  const list = useMemo(
    () =>
      findings
        .filter((f) => f.status !== 'rejected')
        .sort((a, b) => Number(b.guardOk ?? 0) - Number(a.guardOk ?? 0) || (b.confidence ?? 0) - (a.confidence ?? 0)),
    [findings]
  );
  const [sel, setSel] = useState(0);
  const f = list[sel];
  if (!list.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <div>
          <Search className="mx-auto mb-3 text-tx-3" size={22} />
          <p className="font-display text-2xl text-tx">No unreported defects</p>
          <p className="mt-1 text-sm text-tx-3">The sweep found nothing beyond what students already reported.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <ul className="fx-scroll relative max-h-[40dvh] shrink-0 overflow-y-auto border-b border-line lg:max-h-none lg:w-[360px] lg:border-b-0 lg:border-r">
        {list.map((x, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setSel(i)}
              className={clsx('block w-full border-l-2 px-4 py-3 text-left', i === sel ? 'border-pine-600 bg-pine-50' : 'border-transparent hover:bg-sunken')}
            >
              <p className="text-sm font-medium text-tx">{repairLabel(x.repair) || 'Possible defect'}</p>
              <p className="mt-0.5 text-xs text-tx-3">
                {x.subject} <span className="font-mono">{x.qid ?? x.questionId?.slice(-8)}</span>
              </p>
            </button>
          </li>
        ))}
      </ul>
      {f && (
        <div className="fx-scroll relative min-w-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[760px] space-y-4">
            <p className="text-xs text-tx-3">
              {f.subject} <span className="ml-2">{f.chapter}</span> <span className="ml-2 font-mono">{f.qid ?? f.questionId}</span>
            </p>
            <h1 className="font-display text-[28px] leading-tight text-tx">{repairLabel(f.repair) || 'Possible defect'}</h1>
            <p className="flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-sunken px-2.5 py-1 text-tx-2">{SOURCE_LABEL[f.source ?? ''] ?? 'Sweep'}</span>
              <span className={clsx('rounded-full px-2.5 py-1', f.guardOk ? 'bg-ok-50 text-ok-600' : 'bg-warn-50 text-warn-600')}>
                {f.guardOk ? 'Edit passes the scope guard' : 'Edit needs a person to write it'}
              </span>
              {f.status === 'confirmed' && <span className="rounded-full bg-pine-50 px-2.5 py-1 text-pine-600">Confirmed</span>}
            </p>
            {f.note && <p className="max-w-[72ch] text-sm leading-relaxed text-tx-2">{f.note}</p>}
            {f.edit && (
              <div className="rounded-card border border-line bg-surface p-4">
                <p className="mb-2 text-xs text-tx-3">Suggested edit in the {f.edit.field}</p>
                <p className="font-display text-[16px] leading-relaxed">
                  <del className="rounded bg-bad-50 px-1 text-bad-600">{htmlText(f.edit.find) || f.edit.find}</del>{' '}
                  <ins className="rounded bg-ok-50 px-1 text-ok-600 no-underline">{htmlText(f.edit.replace) || '(removed)'}</ins>
                </p>
              </div>
            )}
            {!!f.guardErrors?.length && (
              <ul className="list-disc pl-5 text-xs text-tx-3">
                {f.guardErrors.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-tx-3">Suggestions only. Nothing here changes the question bank until a faculty member files and approves it.</p>
          </div>
        </div>
      )}
    </div>
  );
}
