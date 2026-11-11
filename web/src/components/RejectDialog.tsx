import { useState } from 'react';

interface RejectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectDialog({ isOpen, onClose, onConfirm }: RejectDialogProps) {
  const [selectedReason, setSelectedReason] = useState('AI verdict is incorrect');
  const [details, setDetails] = useState('');

  if (!isOpen) return null;

  const reasons = [
    'AI verdict is incorrect',
    'Edit or repair is incorrect',
    'Issue is trivial or not worth changing',
    'Other reason',
  ];

  const handleSave = () => {
    const fullReason = details.trim() ? `${selectedReason}: ${details.trim()}` : selectedReason;
    onConfirm(fullReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-tx/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-surface border border-line rounded-card max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
          <h3 className="font-semibold text-base text-tx">Reject Proposal</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-tx-muted hover:text-tx px-2 py-1 rounded"
          >
            Cancel (Esc)
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-tx-3 uppercase font-mono">
              Primary Reason
            </label>
            {reasons.map((r) => (
              <label
                key={r}
                className="flex items-center gap-2.5 text-xs text-tx cursor-pointer p-1.5 rounded hover:bg-sunken"
              >
                <input
                  type="radio"
                  name="reject-reason"
                  checked={selectedReason === r}
                  onChange={() => setSelectedReason(r)}
                  className="accent-pine-600"
                />
                <span>{r}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-tx-3 uppercase font-mono mb-1">
              Additional Details (optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Why was this proposal rejected?"
              rows={3}
              className="w-full bg-sunken border border-line rounded p-2 text-xs text-tx focus:outline-none focus:ring-1 focus:ring-pine-500 font-sans"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-line mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-line text-xs font-medium text-tx-3 hover:bg-sunken"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-full bg-bad-50 text-red-700 hover:bg-red-100 text-xs font-semibold shadow-sm transition-colors"
          >
            Reject Proposal
          </button>
        </div>
      </div>
    </div>
  );
}
