import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface Props {
  open: boolean;
  title: string;
  confirmLabel: string;
  picks: string[];
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/** Reject and revert both need a reason for the audit log. Quick picks keep it to one click. */
export function ReasonDialog({ open, title, confirmLabel, picks, danger, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const submit = () => {
    if (reason.trim()) onConfirm(reason.trim());
  };
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={!reason.trim()} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {picks.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              className={`rounded-full border px-3 py-1 text-xs ${reason === p ? 'border-pine-500 bg-pine-50 text-pine-600' : 'border-line-strong text-tx-2 hover:bg-sunken'}`}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-tx-3">Reason, kept in the audit log</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            data-autofocus
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-tx outline-none focus:border-pine-500"
          />
        </label>
        <p className="text-2xs text-tx-3">Enter with Cmd or Ctrl to confirm.</p>
      </div>
    </Modal>
  );
}
