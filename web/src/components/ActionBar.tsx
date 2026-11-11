import type { Lane, CaseDetail } from '../lib/types';

interface ActionBarProps {
  lane: Lane;
  c: CaseDetail;
  isPending: boolean;
  onApprove: () => void;
  onOpenEdit: () => void;
  onOpenReject: () => void;
  onConfirm: () => void;
  onOpenRevert: () => void;
  onAcknowledge: () => void;
  onUndo: () => void;
}

export function ActionBar({
  lane,
  c,
  isPending,
  onApprove,
  onOpenEdit,
  onOpenReject,
  onConfirm,
  onOpenRevert,
  onAcknowledge,
  onUndo,
}: ActionBarProps) {
  const isDone = lane === 'done';

  return (
    <div className="sticky bottom-0 bg-surface/95 backdrop-blur-xs border-t border-line px-6 py-3 flex items-center justify-between gap-4 z-20 select-none shadow-md">
      <div className="flex items-center gap-2">
        {lane === 'needs_review' && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={onApprove}
              className="h-10 px-5 rounded-full bg-pine-600 hover:bg-pine-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
              title="Approve proposed fix (a)"
            >
              <span>Approve</span>
              <kbd className="bg-pine-700/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                A
              </kbd>
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={onOpenEdit}
              className="h-10 px-4 rounded-full border border-line bg-sunken hover:bg-line-strong text-tx font-semibold text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Edit proposed change (e)"
            >
              <span>Edit</span>
              <kbd className="bg-surface text-tx-muted text-[10px] px-1.5 py-0.5 rounded font-mono border border-line">
                E
              </kbd>
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={onOpenReject}
              className="h-10 px-4 rounded-full border border-line text-red-700 hover:bg-bad-50 font-semibold text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Reject proposal (r)"
            >
              <span>Reject</span>
              <kbd className="bg-bad-50 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-mono border border-red-200">
                R
              </kbd>
            </button>
          </>
        )}

        {lane === 'spot_check' && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={onConfirm}
              className="h-10 px-5 rounded-full bg-pine-600 hover:bg-pine-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
              title="Confirm auto applied change is correct (a)"
            >
              <span>Confirm</span>
              <kbd className="bg-pine-700/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                A
              </kbd>
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={onOpenRevert}
              className="h-10 px-4 rounded-full border border-line text-red-700 hover:bg-bad-50 font-semibold text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Revert auto applied change (r)"
            >
              <span>Revert</span>
              <kbd className="bg-bad-50 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-mono border border-red-200">
                R
              </kbd>
            </button>
          </>
        )}

        {lane === 'no_change' && (
          <button
            type="button"
            disabled={isPending}
            onClick={onAcknowledge}
            className="h-10 px-5 rounded-full bg-pine-600 hover:bg-pine-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
            title="Acknowledge no change verdict (a)"
          >
            <span>Acknowledge</span>
            <kbd className="bg-pine-700/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
              A
            </kbd>
          </button>
        )}

        {isDone && (
          <div className="text-xs text-tx-muted font-medium py-2">
            Status: <span className="font-semibold text-tx">{c.status}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending || c.actions?.length === 0}
          onClick={onUndo}
          className="h-9 px-3.5 rounded-full border border-line hover:bg-sunken text-tx-3 hover:text-tx text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-40"
          title="Undo last action on this case (u)"
        >
          <span>Undo</span>
          <kbd className="bg-sunken text-tx-muted text-[10px] px-1 py-0.2 rounded font-mono border border-line">
            U
          </kbd>
        </button>
      </div>
    </div>
  );
}

