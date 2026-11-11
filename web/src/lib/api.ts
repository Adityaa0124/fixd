import type { AuditEntry, CaseDetailRaw, CaseSummary, CaseLane, SnapshotFile, Stats, SweepFindingRaw } from './types';

/**
 * Live API base. In production it must come from VITE_API_URL; without it the console
 * runs on the bundled snapshot only. Dev falls back to the local server.
 */
export const API_BASE: string | null =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
  (import.meta.env.DEV ? 'http://localhost:4000' : null);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function reviewer(): string {
  try {
    return localStorage.getItem('fixd.reviewer') || 'faculty';
  } catch {
    return 'faculty';
  }
}

export function setReviewer(name: string): void {
  try {
    localStorage.setItem('fixd.reviewer', name.trim().slice(0, 60) || 'faculty');
  } catch {
    /* storage blocked: keep default */
  }
}

async function req<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  if (!API_BASE) throw new ApiError(0, 'No live server configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 15000);
  try {
    const r = await fetch(API_BASE + path, {
      ...init,
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(r.status, (body as { error?: string }).error ?? `Server answered ${r.status}`);
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ApiError(0, 'The server took too long to answer');
    throw new ApiError(0, 'Could not reach the server');
  } finally {
    clearTimeout(timer);
  }
}

const LANES: CaseLane[] = ['needs_review', 'spot_check', 'no_change', 'done'];

export const api = {
  health: () => req<{ ok: boolean; cases: number }>('/api/health', { timeoutMs: 6000 }),
  /** Every case across all lanes, so lane switching and search are instant. */
  allCases: async () => {
    const lanes = await Promise.all(LANES.map((l) => req<{ items: CaseSummary[] }>(`/api/cases?lane=${l}`)));
    return lanes.flatMap((l) => l.items);
  },
  case: (id: string) => req<CaseDetailRaw>(`/api/cases/${encodeURIComponent(id)}`),
  act: (id: string, body: Record<string, unknown>) =>
    req<CaseDetailRaw>(`/api/cases/${encodeURIComponent(id)}/actions`, {
      method: 'POST',
      body: JSON.stringify({ actor: reviewer(), ...body }),
      timeoutMs: 30000,
    }),
  audit: () => req<AuditEntry[]>('/api/audit?limit=200'),
  stats: () => req<Stats>('/api/stats'),
  sweep: () => req<SweepFindingRaw[]>('/api/sweep'),
  reset: () => req<{ seeded: unknown }>('/api/demo/reset', { method: 'POST', body: '{}', timeoutMs: 60000 }),
};

let snapshotPromise: Promise<SnapshotFile> | null = null;
export function loadSnapshot(): Promise<SnapshotFile> {
  snapshotPromise ??= fetch('/snapshot.json').then((r) => {
    if (!r.ok) throw new Error('snapshot missing');
    return r.json() as Promise<SnapshotFile>;
  });
  return snapshotPromise;
}
