interface ShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ isOpen, onClose }: ShortcutsDialogProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'J / K', desc: 'Select next / previous case in queue' },
    { key: 'A', desc: 'Approve fix / Confirm spot check / Acknowledge' },
    { key: 'E', desc: 'Open edit dialog to modify proposed change' },
    { key: 'R', desc: 'Reject proposal / Revert auto applied fix' },
    { key: 'U', desc: 'Undo last action on current case' },
    { key: '1 - 4', desc: 'Switch queue lane (1: Needs you, 2: Spot check, 3: No change, 4: Done)' },
    { key: '/', desc: 'Focus search input' },
    { key: 'T', desc: 'Toggle light and dark theme' },
    { key: '?', desc: 'Show this keyboard shortcuts sheet' },
    { key: 'Esc', desc: 'Close dialog or drawer' },
  ];

  return (
    <div className="fixed inset-0 bg-tx/30 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-surface border border-line rounded-card max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
          <h3 className="font-semibold text-base text-tx">Keyboard Shortcuts</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-tx-muted hover:text-tx px-2 py-1 rounded"
          >
            Close (Esc)
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-line/40">
              <span className="text-tx-3">{s.desc}</span>
              <kbd className="font-mono bg-sunken border border-line rounded px-2 py-0.5 text-tx font-bold">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
