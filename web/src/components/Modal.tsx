import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Submit on Cmd/Ctrl+Enter (and Enter outside textareas). */
  onSubmit?: () => void;
}

/** Accessible dialog: focus moves in and is trapped, Esc and backdrop close, Enter submits. */
export function Modal({ open, title, onClose, children, footer, wide, onSubmit }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], textarea, input, select, button:not([data-close])');
      first?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Enter' && onSubmit) {
        const inTextarea = (e.target as HTMLElement).tagName === 'TEXTAREA';
        if (!inTextarea || e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onSubmit();
        }
        return;
      }
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
          (el) => !el.hasAttribute('disabled')
        );
        if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      lastFocus.current?.focus?.();
    };
  }, [open, onClose, onSubmit]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'fx-toast relative flex max-h-[92dvh] w-full flex-col rounded-t-card border border-line bg-surface shadow-float sm:rounded-card',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 className="text-base font-medium text-tx">{title}</h2>
          <button data-close type="button" onClick={onClose} className="rounded-full p-1.5 text-tx-3 hover:bg-sunken hover:text-tx" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="fx-scroll relative overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
