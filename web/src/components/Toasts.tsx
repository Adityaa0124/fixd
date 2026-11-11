import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

export interface Toast {
  id: number;
  tone: 'ok' | 'bad';
  text: string;
  action?: { label: string; run: () => void };
}

const Ctx = createContext<{ push: (t: Omit<Toast, 'id'>) => void }>({ push: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const n = useRef(0);
  const drop = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++n.current;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      setTimeout(() => drop(id), t.tone === 'bad' ? 9000 : 7000);
    },
    [drop]
  );
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex w-[min(92vw,520px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'fx-toast pointer-events-auto flex items-start gap-3 rounded-card border px-4 py-3 text-sm shadow-float',
              t.tone === 'ok' ? 'border-line bg-surface text-tx' : 'border-bad-600/30 bg-bad-50 text-bad-600'
            )}
          >
            {t.tone === 'ok' ? <CheckCircle2 size={17} className="mt-px shrink-0 text-pine-600" /> : <AlertTriangle size={17} className="mt-px shrink-0" />}
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="shrink-0 rounded-full px-2 font-medium text-pine-600 hover:bg-pine-50"
                onClick={() => {
                  t.action!.run();
                  drop(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => drop(t.id)} className="shrink-0 text-tx-3 hover:text-tx" aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
