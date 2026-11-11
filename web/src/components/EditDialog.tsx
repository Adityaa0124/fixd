import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { applyEdits, countOccurrences, type Edit } from '@fixd/shared';
import type { CaseView } from '../lib/adapt';
import { allowedFields, repairLabel } from '../lib/labels';
import { diffHtml } from '../lib/diff';
import { Modal } from './Modal';
import { Button } from './Button';
import { MathHtml } from './MathHtml';

const answerText = (a: string | string[]) => (Array.isArray(a) ? JSON.stringify(a) : a);

const FIELD_LABEL: Record<Edit['field'], string> = {
  question: 'Question text',
  solution: 'Solution text',
  answer: 'Answer key',
  questionType: 'Question type',
};

/**
 * Faculty correction of the AI's proposal. Starts from the proposed edits, limited to the
 * fields the repair type may touch, and previews the result with the same diff as the case view.
 */
export function EditDialog({ c, open, onClose, onSave }: { c: CaseView; open: boolean; onClose: () => void; onSave: (e: Edit[]) => void }) {
  const fields = useMemo(() => {
    const allowed = allowedFields(c.repair);
    return allowed.length ? allowed : (['question', 'solution', 'answer'] as Edit['field'][]);
  }, [c.repair]);

  const seed = (): Edit[] => {
    const usable = c.edits.filter((e) => fields.includes(e.field));
    if (usable.length) return usable.map((e) => ({ ...e }));
    const f = fields[0]!;
    return [{ field: f, find: f === 'answer' ? answerText(c.current.answer) : f === 'questionType' ? c.current.questionType : '', replace: '' }];
  };
  const [edits, setEdits] = useState<Edit[]>(seed);

  const set = (i: number, patch: Partial<Edit>) =>
    setEdits((xs) =>
      xs.map((e, j) => {
        if (j !== i) return e;
        const next = { ...e, ...patch };
        if (patch.field === 'answer') next.find = answerText(c.current.answer);
        if (patch.field === 'questionType') next.find = c.current.questionType;
        return next;
      })
    );

  const check = useMemo(() => {
    for (const e of edits) {
      if (e.find === e.replace) return { error: 'An edit changes nothing yet.' };
      if ((e.field === 'question' || e.field === 'solution') && e.find) {
        const n = countOccurrences(c.current[e.field], e.find);
        if (n !== 1) return { error: `The text to replace appears ${n} times in the ${e.field}. Copy a longer, unique piece.` };
      }
    }
    try {
      return { after: applyEdits(c.current, edits) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [edits, c.current]);

  const submit = () => {
    if (!('error' in check)) onSave(edits);
  };

  return (
    <Modal
      open={open}
      wide
      title={`Edit fix${c.repair ? `: ${repairLabel(c.repair)}` : ''}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          {'error' in check && <span className="mr-auto text-xs text-bad-600">{check.error}</span>}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={'error' in check} onClick={submit}>
            Apply edit
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-tx-3">
          This repair may change: {fields.map((f) => FIELD_LABEL[f]).join(', ')}. Text fields take the stored HTML; copy the exact piece to replace.
        </p>
        {edits.map((e, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-line p-3">
            <div className="flex items-center gap-2">
              <select
                value={e.field}
                onChange={(ev) => set(i, { field: ev.target.value as Edit['field'] })}
                className="h-8 rounded-full border border-line-strong bg-surface px-3 text-sm text-tx"
                aria-label="Field"
              >
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {FIELD_LABEL[f]}
                  </option>
                ))}
              </select>
              {edits.length > 1 && (
                <button type="button" onClick={() => setEdits((xs) => xs.filter((_, j) => j !== i))} className="ml-auto rounded-full p-1.5 text-tx-3 hover:bg-sunken" aria-label="Remove edit">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            {e.field === 'answer' || e.field === 'questionType' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-tx-3">
                  Now
                  <input readOnly value={e.find} className="mt-1 h-9 w-full rounded-lg border border-line bg-sunken px-3 font-mono text-sm text-tx-2" />
                </label>
                <label className="text-xs text-tx-3">
                  {e.field === 'answer' ? 'New key: a letter, ["A","C"] for multiple, or a number' : 'New type: scq, mcq or integerQuestion'}
                  <input
                    value={e.replace}
                    onChange={(ev) => set(i, { replace: ev.target.value })}
                    className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-3 font-mono text-sm text-tx outline-none focus:border-pine-500"
                  />
                </label>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-tx-3">
                  Replace this stored text
                  <textarea
                    value={e.find}
                    onChange={(ev) => set(i, { find: ev.target.value })}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-line-strong bg-surface p-2 font-mono text-xs text-tx outline-none focus:border-pine-500"
                  />
                </label>
                <label className="text-xs text-tx-3">
                  With
                  <textarea
                    value={e.replace}
                    onChange={(ev) => set(i, { replace: ev.target.value })}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-line-strong bg-surface p-2 font-mono text-xs text-tx outline-none focus:border-pine-500"
                  />
                </label>
              </div>
            )}
          </div>
        ))}
        {edits.length < 5 && (
          <button
            type="button"
            onClick={() => setEdits((xs) => [...xs, { field: fields[0]!, find: fields[0] === 'answer' ? answerText(c.current.answer) : '', replace: '' }])}
            className="flex items-center gap-1.5 text-sm text-pine-600 hover:underline"
          >
            <Plus size={15} /> Add another edit
          </button>
        )}

        {'after' in check && check.after && (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-xs text-tx-3">Preview</p>
            {(['question', 'solution'] as const).map((f) => {
              const d = diffHtml(c.current[f], check.after![f]);
              if (d.kind === 'same') return null;
              return <MathHtml key={f} small html={d.kind === 'inline' ? d.html : d.after} />;
            })}
            {JSON.stringify(c.current.answer) !== JSON.stringify(check.after.answer) && (
              <p className="text-sm">
                Answer key <del className="rounded bg-bad-50 px-1.5 text-bad-600">{answerText(c.current.answer)}</del>{' '}
                <ins className="rounded bg-ok-50 px-1.5 text-ok-600 no-underline">{answerText(check.after.answer)}</ins>
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
