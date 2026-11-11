import { useEffect, useState } from 'react';
import { API_BASE, api } from './api';

export type Conn = 'connecting' | 'live' | 'offline' | 'static';

/**
 * Polls /api/health. The console renders the bundled snapshot immediately and flips to
 * live data the moment the server answers. Wall clock based, so a hanging request cannot stall it.
 */
export function useConnection(): Conn {
  const [conn, setConn] = useState<Conn>(API_BASE ? 'connecting' : 'static');
  useEffect(() => {
    if (!API_BASE) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const tick = async () => {
      try {
        const h = await api.health();
        if (!stop && h.ok) {
          setConn('live');
          return;
        }
      } catch {
        /* still waking */
      }
      if (stop) return;
      const waited = Date.now() - started;
      if (waited > 70_000) setConn('offline');
      timer = setTimeout(tick, waited > 70_000 ? 15_000 : 3_000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);
  return conn;
}
