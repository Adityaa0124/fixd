import type { AuditEntry, CaseDetail, CaseSummary } from './types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export function reviewer(): string {
  try {
    return localStorage.getItem('fixd.reviewer') || 'faculty';
  } catch {
    return 'faculty';
  }
}

export function setReviewer(name: string): void {
  try {
    localStorage.setItem('fixd.reviewer', name);
  } catch {
    /* ignore */
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
  return body as T;
}

export const api = {
  health: () => req<{ ok: boolean; cases: number }>('/api/health'),
  cases: (lane: string, q = '') =>
    req<{ items: CaseSummary[]; counts: Record<string, number> }>(
      `/api/cases?lane=${lane}&q=${encodeURIComponent(q)}`
    ),
  case: (id: string) => req<CaseDetail>(`/api/cases/${id}`),
  act: (id: string, body: Record<string, unknown>) =>
    req<CaseDetail>(`/api/cases/${id}/actions`, {
      method: 'POST',
      body: JSON.stringify({ actor: reviewer(), ...body }),
    }),
  audit: () => req<AuditEntry[]>('/api/audit?limit=200'),
  sweep: () => req<unknown[]>('/api/sweep'),
};
