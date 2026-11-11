import { useState } from 'react';
import { diffWordsWithSpace } from 'diff';
import type { CaseDetail } from '../lib/types';
import { markEdit } from '../lib/markEdit';
import { MathHtml } from './MathHtml';

interface QuestionDiffProps {
  c: CaseDetail;
}

export function QuestionDiff({ c }: QuestionDiffProps) {
  const [tab, setTab] = useState<'before' | 'after' | 'source'>('after');

  const edits = c.edits || [];
  const primaryEdit = edits[0];

  // If there are no edits proposed (e.g. auto: false or no_error)
  if (!primaryEdit) {
    return (
      <div className="bg-surface border border-line rounded-card p-4 mb-4 select-none">
        <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
          <span className="text-xs font-semibold text-tx-muted uppercase tracking-wider font-mono">
            Current Content
          </span>
          <span className="text-xs text-tx-muted">No proposed edit</span>
        </div>

        {c.findings && c.findings.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50/60 border border-amber-600/30 rounded text-xs text-amber-800 space-y-1">
            <div className="font-semibold">Static Findings:</div>
            {c.findings.map((f, idx) => (
              <div key={idx}>* {f}</div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
              Question
            </div>
            <MathHtml html={c.current.question} className="bg-sunken/40 p-3 rounded" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
              Solution
            </div>
            <MathHtml html={c.current.solution} className="bg-sunken/40 p-3 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Answer edit special handling
  if (primaryEdit.field === 'answer') {
    return (
      <div className="bg-surface border border-line rounded-card p-4 mb-4 select-none">
        <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
          <span className="text-xs font-semibold text-tx-muted uppercase tracking-wider font-mono">
            Answer Key Edit
          </span>
          <div className="flex items-center gap-1 bg-sunken p-0.5 rounded-full text-xs">
            <button
              type="button"
              onClick={() => setTab('before')}
              className={`px-3 py-1 rounded-full font-medium ${
                tab === 'before' ? 'bg-surface text-tx shadow-sm' : 'text-tx-3 hover:text-tx'
              }`}
            >
              Before
            </button>
            <button
              type="button"
              onClick={() => setTab('after')}
              className={`px-3 py-1 rounded-full font-medium ${
                tab === 'after' ? 'bg-surface text-tx shadow-sm' : 'text-tx-3 hover:text-tx'
              }`}
            >
              After
            </button>
          </div>
        </div>

        <div className="py-4 flex items-center justify-center gap-4">
          <span className="px-3 py-1.5 rounded-full bg-bad-50 text-red-700 font-mono font-bold line-through text-lg">
            {primaryEdit.find}
          </span>
          <span className="text-tx-muted text-xl font-bold">→</span>
          <span className="px-3 py-1.5 rounded-full bg-ok-50 text-green-700 font-mono font-bold text-lg">
            {primaryEdit.replace}
          </span>
        </div>

        <div className="mt-4 border-t border-line/60 pt-4 space-y-3">
          <div>
            <div className="text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
              Question
            </div>
            <MathHtml html={c.current.question} className="bg-sunken/40 p-3 rounded" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
              Solution
            </div>
            <MathHtml html={c.current.solution} className="bg-sunken/40 p-3 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // HTML field edit (question or solution)
  const targetHtml = primaryEdit.field === 'question' ? c.current.question : c.current.solution;
  const marked = markEdit(targetHtml, primaryEdit);

  // Raw source diff
  const rawBefore = primaryEdit.find;
  const rawAfter = primaryEdit.replace;
  const sourceDiffs = diffWordsWithSpace(rawBefore, rawAfter);

  return (
    <div className="bg-surface border border-line rounded-card p-4 mb-4 select-none">
      <div className="flex items-center justify-between mb-3 border-b border-line pb-2">
        <span className="text-xs font-semibold text-tx-muted uppercase tracking-wider font-mono">
          Proposed Change ({primaryEdit.field})
        </span>

        <div className="flex items-center gap-1 bg-sunken p-0.5 rounded-full text-xs">
          <button
            type="button"
            onClick={() => setTab('before')}
            className={`px-3 py-1 rounded-full font-medium ${
              tab === 'before' ? 'bg-surface text-tx shadow-sm' : 'text-tx-3 hover:text-tx'
            }`}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => setTab('after')}
            className={`px-3 py-1 rounded-full font-medium ${
              tab === 'after' ? 'bg-surface text-tx shadow-sm' : 'text-tx-3 hover:text-tx'
            }`}
          >
            After
          </button>
          <button
            type="button"
            onClick={() => setTab('source')}
            className={`px-3 py-1 rounded-full font-medium ${
              tab === 'source' ? 'bg-surface text-tx shadow-sm' : 'text-tx-3 hover:text-tx'
            }`}
          >
            Source
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {tab === 'before' && (
          <div>
            <div className="text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
              {primaryEdit.field} (original with highlighted target)
            </div>
            <MathHtml
              html={marked ? marked.before : targetHtml}
              className="bg-sunken/40 p-3 rounded"
            />
          </div>
        )}

        {tab === 'after' && (
          <div>
            <div className="text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
              {primaryEdit.field} (repaired)
            </div>
            <MathHtml
              html={marked ? marked.after : targetHtml}
              className="bg-sunken/40 p-3 rounded"
            />
          </div>
        )}

        {tab === 'source' && (
          <div>
            <div className="text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
              Raw String Diff
            </div>
            <div className="bg-sunken p-3 rounded font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {sourceDiffs.map((part, idx) => (
                <span
                  key={idx}
                  className={
                    part.added
                      ? 'bg-ok-50 text-green-700 px-1 py-0.5 rounded font-semibold'
                      : part.removed
                      ? 'bg-bad-50 text-red-700 px-1 py-0.5 rounded line-through'
                      : 'text-tx'
                  }
                >
                  {part.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {primaryEdit.field === 'solution' && (
          <div className="pt-2 border-t border-line/60">
            <div className="text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
              Question
            </div>
            <MathHtml html={c.current.question} className="bg-sunken/20 p-3 rounded text-tx-2" />
          </div>
        )}
      </div>
    </div>
  );
}
