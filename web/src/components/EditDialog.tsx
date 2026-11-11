import { useState, useMemo } from 'react';
import { countOccurrences, applyEdit, type Edit, type Snapshot } from '@fixd/shared';
import type { CaseDetail } from '../lib/types';
import { markEdit } from '../lib/markEdit';
import { MathHtml } from './MathHtml';

interface EditDialogProps {
  c: CaseDetail;
  isOpen: boolean;
  onClose: () => void;
  onSave: (edits: Edit[]) => void;
}

export function EditDialog({ c, isOpen, onClose, onSave }: EditDialogProps) {
  const existingEdit = c.edits?.[0];
  const [field, setField] = useState<Edit['field']>(existingEdit?.field || 'solution');
  const [find, setFind] = useState(existingEdit?.find || '');
  const [replace, setReplace] = useState(existingEdit?.replace || '');

  // Validation
  const validation = useMemo(() => {
    if (!find && field !== 'answer') {
      return { ok: false, error: 'Find string cannot be empty' };
    }
    const currentHtml = c.current[field as keyof Snapshot];
    if (typeof currentHtml === 'string' && (field === 'question' || field === 'solution')) {
      const count = countOccurrences(currentHtml, find);
      if (count === 0) return { ok: false, error: 'Find string was not found in ' + field };
      if (count > 1) return { ok: false, error: `Find string occurs ${count} times; must be unique` };
    }
    try {
      const candidate: Edit = { field, find, replace };
      applyEdit(c.current, candidate);
      return { ok: true, error: null };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Cannot apply edit cleanly' };
    }
  }, [c.current, field, find, replace]);

  if (!isOpen) return null;

  const previewEdit: Edit = { field, find, replace };
  const currentText = c.current[field as keyof Snapshot];
  const marked =
    typeof currentText === 'string' && (field === 'question' || field === 'solution')
      ? markEdit(currentText, previewEdit)
      : null;

  const handleSave = () => {
    if (!validation.ok) return;
    onSave([previewEdit]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-tx/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-surface border border-line rounded-card max-w-2xl w-full p-6 shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
          <h3 className="font-semibold text-base text-tx">Edit Proposed Change</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-tx-muted hover:text-tx px-2 py-1 rounded"
          >
            Cancel (Esc)
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div>
            <label className="block text-xs font-semibold text-tx-3 uppercase font-mono mb-1">
              Target Field
            </label>
            <select
              value={field}
              onChange={(e) => setField(e.target.value as Edit['field'])}
              className="w-full bg-sunken border border-line rounded p-2 text-xs text-tx font-mono focus:outline-none focus:ring-1 focus:ring-pine-500"
            >
              <option value="question">question</option>
              <option value="solution">solution</option>
              <option value="answer">answer</option>
              <option value="questionType">questionType</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-tx-3 uppercase font-mono mb-1">
              Find Exact Substring
            </label>
            <input
              type="text"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Exact target text in original field"
              className="w-full bg-sunken border border-line rounded p-2 text-xs text-tx font-mono focus:outline-none focus:ring-1 focus:ring-pine-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-tx-3 uppercase font-mono mb-1">
              Replacement
            </label>
            <input
              type="text"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              placeholder="Replacement text"
              className="w-full bg-sunken border border-line rounded p-2 text-xs text-tx font-mono focus:outline-none focus:ring-1 focus:ring-pine-500"
            />
          </div>

          {validation.error && (
            <div className="p-2.5 rounded bg-bad-50 text-red-700 text-xs font-medium">
              * {validation.error}
            </div>
          )}

          {marked && (
            <div>
              <div className="text-[11px] font-semibold text-tx-muted uppercase font-mono mb-1">
                Live Preview
              </div>
              <div className="bg-sunken/40 p-3 rounded border border-line max-h-48 overflow-y-auto text-xs">
                <MathHtml html={marked.after} />
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-line mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-line text-xs font-medium text-tx-3 hover:bg-sunken"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!validation.ok}
            onClick={handleSave}
            className="px-5 py-2 rounded-full bg-pine-600 text-white text-xs font-semibold shadow-sm hover:bg-pine-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
}

