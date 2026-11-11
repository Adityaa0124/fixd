import { Check, Loader2, PencilLine, RotateCcw, Undo2, X, Lock } from 'lucide-react';
import type { CaseView } from '../lib/adapt';
import { Button } from './Button';

interface Props {
  c: CaseView;
  readOnly: boolean;
  pending: boolean;
  canUndo: boolean;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onConfirm: () => void;
  onRevert: () => void;
  onAcknowledge: () => void;
  onUndo: () => void;
}

/** Pinned to the bottom of the case: one decision, one key. */
export function ActionBar(p: Props) {
  const { c, readOnly, pending } = p;
  const off = readOnly || pending;
  let note: string | null = null;
  if (readOnly) note = 'Read only. Actions need the live server.';
  else if (c.lane === 'needs_review' && !c.approvable) note = c.blockedReason ?? 'This proposal cannot be approved as is. Edit or reject it.';
  else if (c.lane === 'spot_check') note = 'Already live for students. Keep it, or revert to the previous version.';

  return (
    <div className="sticky bottom-0 z-10 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-6" data-tour="actions">
      <div className="mx-auto flex max-w-[860px] flex-wrap items-center gap-2">
        {c.lane === 'needs_review' && (
          <>
            <Button variant="primary" kbd="A" icon={<Check size={16} />} disabled={off || !c.approvable} onClick={p.onApprove}>
              {c.edits.length ? 'Approve fix' : 'Accept diagnosis'}
            </Button>
            <Button kbd="E" icon={<PencilLine size={15} />} disabled={off} onClick={p.onEdit}>
              Edit
            </Button>
            <Button kbd="R" icon={<X size={15} />} disabled={off} onClick={p.onReject}>
              Reject
            </Button>
          </>
        )}
        {c.lane === 'spot_check' && (
          <>
            <Button variant="primary" kbd="A" icon={<Check size={16} />} disabled={off} onClick={p.onConfirm}>
              Keep fix
            </Button>
            <Button variant="danger" kbd="R" icon={<RotateCcw size={15} />} disabled={off} onClick={p.onRevert}>
              Revert
            </Button>
          </>
        )}
        {c.lane === 'no_change' && (
          <Button variant="primary" kbd="A" icon={<Check size={16} />} disabled={off} onClick={p.onAcknowledge}>
            Send reply and close
          </Button>
        )}
        {pending && (
          <span className="flex items-center gap-1.5 text-xs text-tx-3">
            <Loader2 size={13} className="animate-spin" />
            Saving
          </span>
        )}
        {!pending && note && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-tx-3">
            {readOnly && <Lock size={13} />}
            {note}
          </span>
        )}
        <span className="ml-auto" />
        {p.canUndo && (
          <Button variant="ghost" kbd="U" icon={<Undo2 size={15} />} disabled={off} onClick={p.onUndo}>
            Undo last action
          </Button>
        )}
      </div>
    </div>
  );
}
