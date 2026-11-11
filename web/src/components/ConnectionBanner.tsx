import { CloudOff, Loader2 } from 'lucide-react';
import type { Conn } from '../lib/useConnection';

/** Honest status line: the console never pretends saved results are live. */
export function ConnectionBanner({ conn, generatedAt }: { conn: Conn; generatedAt?: string }) {
  if (conn === 'live') return null;
  const when = generatedAt ? new Date(generatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-b border-warn-600/20 bg-warn-50 px-4 py-1.5 text-center text-xs text-tx-2">
      {conn === 'connecting' ? <Loader2 size={13} className="animate-spin text-warn-600" /> : <CloudOff size={13} className="text-warn-600" />}
      {conn === 'connecting' && <span>Showing saved engine results while the live server wakes up (free tier, up to a minute). Actions unlock when it is ready.</span>}
      {conn === 'offline' && <span>Live server unreachable. Showing saved engine results{when ? ` from ${when}` : ''}, read only. Retrying in the background.</span>}
      {conn === 'static' && <span>Read only demo: saved engine results{when ? ` from ${when}` : ''}. No live server is configured for this build.</span>}
    </div>
  );
}
