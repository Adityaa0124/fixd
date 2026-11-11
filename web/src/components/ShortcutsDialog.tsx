import { Modal } from './Modal';

const KEYS: Array<[string, string]> = [
  ['J  K', 'Next and previous case'],
  ['A', 'Approve, keep fix, or close'],
  ['E', 'Edit the proposed fix'],
  ['R', 'Reject, or revert an AI fix'],
  ['U', 'Undo your last action'],
  ['1 to 5', 'Switch lane'],
  ['/', 'Search'],
  ['L', 'Audit log'],
  ['?', 'This list'],
  ['Esc', 'Close any dialog'],
];

export function ShortcutsDialog({ open, onClose, onTour }: { open: boolean; onClose: () => void; onTour?: () => void }) {
  return (
    <Modal open={open} title="Keyboard" onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {KEYS.map(([k, v]) => (
          <div key={k} className="contents">
            <dt>
              <kbd className="rounded border border-line-strong bg-sunken px-2 py-0.5 font-sans text-xs text-tx">{k}</kbd>
            </dt>
            <dd className="text-tx-2">{v}</dd>
          </div>
        ))}
      </dl>
      {onTour && (
        <button type="button" onClick={onTour} className="mt-4 text-sm font-medium text-pine-700 underline underline-offset-4 hover:text-pine-600">
          Replay the 40 second tour
        </button>
      )}
    </Modal>
  );
}
