import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

interface WarmupGateProps {
  children: ReactNode;
}

export function WarmupGate({ children }: WarmupGateProps) {
  const [ready, setReady] = useState(false);
  const [waitedSeconds, setWaitedSeconds] = useState(0);
  const [snapshotMode, setSnapshotMode] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let secondsElapsed = 0;
    let stopped = false;

    const check = async () => {
      try {
        const res = await api.health();
        if (res.ok && !stopped) {
          setReady(true);
          return;
        }
      } catch {
        /* wait and retry */
      }

      secondsElapsed += 3;
      if (!stopped) {
        setWaitedSeconds(secondsElapsed);
        if (secondsElapsed >= 75) {
          setSnapshotMode(true);
          setReady(true);
          return;
        }
        timer = setTimeout(check, 3000);
      }
    };

    check();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg text-tx flex flex-col font-sans">
        <header className="h-14 border-b border-line px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight">fixd</span>
            <span className="w-1.5 h-1.5 rounded-full bg-pine-600 inline-block"></span>
          </div>
          {waitedSeconds >= 4 && (
            <div className="text-xs text-tx-3 animate-pulse">
              Waking the server (free tier, about 30 s)...
            </div>
          )}
        </header>

        <div className="flex-1 flex overflow-hidden">
          <aside className="w-96 border-r border-line p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-3 rounded-card bg-surface border border-line animate-pulse space-y-2">
                <div className="h-4 bg-sunken rounded w-1/3" />
                <div className="h-3 bg-sunken rounded w-3/4" />
                <div className="h-3 bg-sunken rounded w-1/2" />
              </div>
            ))}
          </aside>
          <main className="flex-1 p-8 space-y-6">
            <div className="h-8 bg-surface rounded-card border border-line w-1/2 animate-pulse" />
            <div className="h-40 bg-surface rounded-card border border-line animate-pulse" />
            <div className="h-64 bg-surface rounded-card border border-line animate-pulse" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      {snapshotMode && (
        <div className="bg-amber-50 border-b border-amber-600/20 text-amber-700 px-4 py-2 text-xs font-medium text-center">
          Live server unreachable. Showing the precomputed results, actions disabled.
        </div>
      )}
      {children}
    </>
  );
}
