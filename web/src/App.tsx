import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import type { Edit } from '@fixd/shared';
import type { CaseDetailRaw, CaseSummary, Lane, SweepFindingRaw } from './lib/types';
import { api, loadSnapshot } from './lib/api';
import { adaptCase } from './lib/adapt';
import { laneOf } from './lib/labels';
import { useConnection } from './lib/useConnection';
import { useHotkeys } from './hooks/useHotkeys';
import { TopBar } from './components/TopBar';
import { Queue } from './components/Queue';
import { ConnectionBanner } from './components/ConnectionBanner';
import { CaseHeader } from './components/CaseHeader';
import { ChangeView } from './components/ChangeView';
import { EvidenceTrio } from './components/EvidenceTrio';
import { Replies } from './components/Replies';
import { AlsoNoticed } from './components/AlsoNoticed';
import { RoutingDetails } from './components/RoutingDetails';
import { ActionBar } from './components/ActionBar';
import { EditDialog } from './components/EditDialog';
import { ReasonDialog } from './components/ReasonDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { AuditDrawer } from './components/AuditDrawer';
import { SweepPanel } from './components/SweepPanel';
import { Modal } from './components/Modal';
import { Button } from './components/Button';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, useToast } from './components/Toasts';
import { Tour } from './components/Tour';

const TOUR_KEY = 'fixd.tour.seen.v1';
const tourSeen = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; } };
const markTourSeen = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* private mode: show again next time */ } };

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false, retry: 1 } },
});

const LANE_KEYS: Lane[] = ['needs_review', 'spot_check', 'no_change', 'done', 'sweep'];
const UNDOABLE = (t: string) => !['auto_apply', 'undo', 'rerun'].includes(t);

function sortLane(lane: Lane, xs: CaseSummary[]) {
  return [...xs].sort(
    lane === 'no_change'
      ? (a, b) => new Date(a.firstReportedAt ?? 0).getTime() - new Date(b.firstReportedAt ?? 0).getTime()
      : (a, b) => b.urgency - a.urgency
  );
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('fixd.theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('fixd.theme', theme);
    } catch {
      /* storage blocked */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))] as const;
}

type Dialog = null | 'edit' | 'reject' | 'revert' | 'help' | 'reset';

function Console() {
  const qc = useQueryClient();
  const toast = useToast();
  const conn = useConnection();
  const live = conn === 'live';
  const mode = live ? 'live' : 'snap';
  const [theme, toggleTheme] = useTheme();

  const [lane, setLane] = useState<Lane>('needs_review');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [lastAction, setLastAction] = useState<{ caseId: string; actionId?: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const snapshot = useQuery({ queryKey: ['snapshot'], queryFn: loadSnapshot, staleTime: Infinity });

  // Live data replaces the snapshot when it arrives; until then the snapshot is shown, read only.
  const cases = useQuery({
    queryKey: ['cases', mode],
    queryFn: async () => (live ? api.allCases() : (await loadSnapshot()).items),
    placeholderData: (prev) => prev ?? snapshot.data?.items,
  });

  const sweep = useQuery<SweepFindingRaw[]>({
    queryKey: ['sweep', mode],
    queryFn: async () => {
      if (live) {
        try {
          return await api.sweep();
        } catch {
          /* fall through to the bundled copy */
        }
      }
      return (await loadSnapshot()).sweep ?? [];
    },
  });

  const all = cases.data ?? [];
  const q = search.trim().toLowerCase();
  const items = useMemo(
    () =>
      sortLane(
        lane,
        all.filter(
          (c) =>
            laneOf(c.status) === lane &&
            (!q || [c.qid, c.questionId, c.chapter, c.subject, c.verdict, c.repair, c.preview].some((x) => String(x ?? '').toLowerCase().includes(q)))
        )
      ),
    [all, lane, q]
  );
  const counts = useMemo(() => {
    const out: Partial<Record<Lane, number>> = {};
    for (const c of all) out[laneOf(c.status)] = (out[laneOf(c.status)] ?? 0) + 1;
    out.sweep = (sweep.data ?? []).filter((f) => f.status !== 'rejected').length;
    return out;
  }, [all, sweep.data]);

  // Keep a valid selection in the current lane
  useEffect(() => {
    if (lane === 'sweep') return;
    if (!items.length) setSelectedId(null);
    else if (!selectedId || !items.some((i) => i.id === selectedId)) setSelectedId(items[0]!.id);
  }, [items, selectedId, lane]);

  const detail = useQuery({
    queryKey: ['case', mode, selectedId],
    enabled: !!selectedId && lane !== 'sweep',
    queryFn: async (): Promise<CaseDetailRaw> => {
      if (live) return api.case(selectedId!);
      const s = await loadSnapshot();
      const d = s.details[selectedId!];
      if (!d) throw new Error('Case not in the saved results');
      return d;
    },
    placeholderData: () => (selectedId ? snapshot.data?.details[selectedId] : undefined),
  });
  const placeholder = cases.isPlaceholderData || detail.isPlaceholderData;
  const view = useMemo(() => (detail.data && detail.data.id === selectedId ? adaptCase(detail.data) : null), [detail.data, selectedId]);

  useEffect(() => setReplies({}), [selectedId]);

  const audit = useQuery({ queryKey: ['audit'], queryFn: api.audit, enabled: auditOpen && live });

  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.act(id, body),
  });
  const pending = mutation.isPending;

  const act = useCallback(
    (id: string, body: Record<string, unknown>, done: string, advance = true) => {
      const idx = items.findIndex((i) => i.id === id);
      const next = items[idx + 1]?.id ?? items[idx - 1]?.id ?? null;
      mutation.mutate(
        { id, body },
        {
          onSuccess: (res) => {
            qc.setQueryData(['case', 'live', res.id], res);
            // Patch the queue right away (dropping any stale refetch in flight); the refetch confirms it
            void qc.cancelQueries({ queryKey: ['cases'] });
            qc.setQueryData<CaseSummary[]>(['cases', 'live'], (xs) =>
              xs?.map((x) => (x.id === res.id ? { ...x, status: res.status, approvable: res.approvable, blockedReason: res.blockedReason } : x))
            );
            qc.invalidateQueries({ queryKey: ['cases'] });
            qc.invalidateQueries({ queryKey: ['audit'] });
            const isUndo = body.type === 'undo';
            setLastAction(isUndo ? null : { caseId: res.id, actionId: res.lastActionId });
            toast.push({
              tone: 'ok',
              text: done,
              action: isUndo ? undefined : { label: 'Undo', run: () => act(res.id, { type: 'undo', actionId: res.lastActionId }, 'Undone. The case is back where it was.', false) },
            });
            if (isUndo) {
              setLane(laneOf(res.status));
              setSelectedId(res.id);
            } else if (advance && next) setSelectedId(next);
          },
          onError: (e) => toast.push({ tone: 'bad', text: (e as Error).message }),
        }
      );
    },
    [items, mutation, qc, toast]
  );

  const sendReplies = () => Object.fromEntries(Object.entries(replies).filter(([, t]) => t.trim().length > 0));
  const studentsTxt = (n: number) => (n === 1 ? '1 student' : `${n} students`);

  const cur = live && !pending && !placeholder ? view : null;
  const doApprove = () => {
    if (!cur || cur.lane !== 'needs_review' || !cur.approvable) return;
    act(cur.id, { type: 'approve', replies: sendReplies() }, cur.edits.length ? `Approved. Fix is live and the reply went to ${studentsTxt(cur.reports.length)}.` : `Diagnosis accepted. Reply sent to ${studentsTxt(cur.reports.length)}.`);
  };
  const doConfirm = () => cur && cur.lane === 'spot_check' && act(cur.id, { type: 'confirm', replies: sendReplies() }, 'AI fix kept.');
  const doAck = () => cur && cur.lane === 'no_change' && act(cur.id, { type: 'acknowledge', replies: sendReplies() }, `Closed. Reply sent to ${studentsTxt(cur.reports.length)}.`);
  const doUndo = () => {
    if (!live || pending) return;
    if (lastAction) act(lastAction.caseId, { type: 'undo', actionId: lastAction.actionId }, 'Undone. The case is back where it was.', false);
    else if (view && view.actions.some((a) => !a.undone && UNDOABLE(a.type))) act(view.id, { type: 'undo' }, 'Undone. The case is back where it was.', false);
  };
  const canUndo = !!view && (lastAction?.caseId === view.id || view.actions.some((a) => !a.undone && UNDOABLE(a.type)));

  const move = (d: number) => {
    const i = items.findIndex((x) => x.id === selectedId);
    const n = items[Math.min(items.length - 1, Math.max(0, i + d))];
    if (n) setSelectedId(n.id);
  };

  const anyModal = dialog !== null || auditOpen || tourOpen;

  // The tour reads best on a case the AI already fixed (old and new key highlighted), so it starts there.
  const startTour = useCallback(() => {
    setDialog(null);
    setAuditOpen(false);
    setQueueOpen(false);
    setSearch('');
    if ((counts.spot_check ?? 0) > 0) setLane('spot_check');
    setTourOpen(true);
  }, [counts.spot_check]);
  const closeTour = useCallback(() => { setTourOpen(false); markTourSeen(); }, []);
  const autoTourDone = useRef(false);
  useEffect(() => {
    if (autoTourDone.current || !view) return;
    autoTourDone.current = true;
    if (!tourSeen()) startTour();
  }, [view, startTour]);
  useHotkeys(
    {
      j: () => move(1),
      k: () => move(-1),
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      a: () => (view?.lane === 'needs_review' ? doApprove() : view?.lane === 'spot_check' ? doConfirm() : doAck()),
      e: () => cur?.lane === 'needs_review' && setDialog('edit'),
      r: () => (cur?.lane === 'needs_review' ? setDialog('reject') : cur?.lane === 'spot_check' ? setDialog('revert') : null),
      u: doUndo,
      l: () => setAuditOpen(true),
      '/': () => searchRef.current?.focus(),
      '?': () => setDialog('help'),
      ...Object.fromEntries(LANE_KEYS.map((l, i) => [String(i + 1), () => setLane(l)])),
    },
    !anyModal
  );

  const doReset = async () => {
    setDialog(null);
    try {
      await api.reset();
      setLastAction(null);
      setSelectedId(null);
      await qc.invalidateQueries();
      // Reseeding can finish a moment after the response on a cold database: confirm once more
      setTimeout(() => void qc.invalidateQueries({ queryKey: ['cases'] }), 4000);
      toast.push({ tone: 'ok', text: 'Demo reset. Every case is back to the engine output.' });
    } catch (e) {
      toast.push({ tone: 'bad', text: (e as Error).message });
    }
  };

  const openCase = (id: string) => {
    const s = all.find((c) => c.id === id);
    if (s) setLane(laneOf(s.status));
    setSelectedId(id);
    setAuditOpen(false);
  };

  const editable = live && !!view && view.lane !== 'done';

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-bg font-sans text-tx">
      <TopBar
        ref={searchRef}
        lane={lane}
        counts={counts}
        onLane={(l) => {
          setLane(l);
          setQueueOpen(false);
        }}
        search={search}
        onSearch={setSearch}
        theme={theme}
        onTheme={toggleTheme}
        onAudit={() => setAuditOpen(true)}
        onHelp={() => setDialog('help')}
        onReset={live ? () => setDialog('reset') : null}
        onMenu={() => setQueueOpen(true)}
        onTour={startTour}
      />
      <ConnectionBanner conn={conn} generatedAt={snapshot.data?.generatedAt} />

      {lane === 'sweep' ? (
        <SweepPanel findings={sweep.data ?? []} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <Queue
            lane={lane}
            items={items}
            selectedId={selectedId}
            loading={cases.isLoading}
            error={cases.error ? (cases.error as Error).message : null}
            open={queueOpen}
            onClose={() => setQueueOpen(false)}
            onSelect={(id) => {
              setSelectedId(id);
              setQueueOpen(false);
            }}
          />
          <main className="flex min-w-0 flex-1 flex-col">
            {/* relative: absolutely positioned children (sr-only labels) stay inside this scroller */}
            <div className="fx-scroll relative min-h-0 flex-1 overflow-y-auto" data-scroller="case">
              <ErrorBoundary resetKey={selectedId ?? ''}>
                {view ? (
                  <article className="mx-auto max-w-[860px] space-y-5 px-4 py-6 sm:px-6 sm:py-8">
                    <CaseHeader c={view} />
                    <ChangeView c={view} />
                    <EvidenceTrio c={view} />
                    <Replies c={view} replies={replies} editable={editable} onChange={(id, t) => setReplies((r) => ({ ...r, [id]: t }))} />
                    <AlsoNoticed c={view} />
                    <RoutingDetails c={view} />
                  </article>
                ) : selectedId && detail.isError ? (
                  <p className="p-8 text-sm text-bad-600">Could not load this case: {(detail.error as Error).message}</p>
                ) : selectedId ? (
                  <div className="mx-auto max-w-[860px] space-y-4 px-6 py-8">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-sunken" />
                    <div className="h-9 w-3/4 animate-pulse rounded bg-sunken" />
                    <div className="h-48 animate-pulse rounded-card bg-sunken" />
                  </div>
                ) : (
                  !cases.isLoading && (
                    <div className="flex h-full items-center justify-center p-10 text-center">
                      <div>
                        <Inbox className="mx-auto mb-3 text-tx-3" size={22} />
                        <p className="font-display text-2xl text-tx">Nothing waiting here</p>
                        <p className="mt-1 text-sm text-tx-3">Every case in this lane is handled. Try another lane with 1 to 5.</p>
                      </div>
                    </div>
                  )
                )}
              </ErrorBoundary>
            </div>
            {view && (
              <ActionBar
                c={view}
                readOnly={!live || placeholder}
                pending={pending}
                canUndo={live && canUndo}
                onApprove={doApprove}
                onEdit={() => setDialog('edit')}
                onReject={() => setDialog('reject')}
                onConfirm={doConfirm}
                onRevert={() => setDialog('revert')}
                onAcknowledge={doAck}
                onUndo={doUndo}
              />
            )}
          </main>
        </div>
      )}

      {view && dialog === 'edit' && (
        <EditDialog
          key={view.id}
          c={view}
          open
          onClose={() => setDialog(null)}
          onSave={(edits: Edit[]) => {
            setDialog(null);
            act(view.id, { type: 'edit', edits, replies: sendReplies() }, `Your edit is live. Reply sent to ${studentsTxt(view.reports.length)}.`);
          }}
        />
      )}
      {view && (
        <ReasonDialog
          key={`reject-${view.id}-${dialog === 'reject'}`}
          open={dialog === 'reject'}
          title="Reject the AI proposal"
          confirmLabel="Reject"
          picks={['The edit is wrong', 'Needs a different fix', 'The question is fine', 'Student was mistaken']}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => {
            setDialog(null);
            act(view.id, { type: 'reject', reason, replies: sendReplies() }, 'Rejected. Nothing in the question changed.');
          }}
        />
      )}
      {view && (
        <ReasonDialog
          key={`revert-${view.id}-${dialog === 'revert'}`}
          open={dialog === 'revert'}
          danger
          title="Revert the AI fix"
          confirmLabel="Revert"
          picks={['The fix is wrong', 'Changed more than needed', 'Original was correct']}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => {
            setDialog(null);
            act(view.id, { type: 'revert', reason, replies: sendReplies() }, 'Reverted. The previous version is live again.');
          }}
        />
      )}
      <ShortcutsDialog open={dialog === 'help'} onClose={() => setDialog(null)} onTour={startTour} />
      <Tour open={tourOpen} onClose={closeTour} />
      <Modal
        open={dialog === 'reset'}
        title="Reset the demo"
        onClose={() => setDialog(null)}
        onSubmit={doReset}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doReset}>
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-sm text-tx-2">
          Every approval, edit, reply and version made in this demo is wiped, and all cases return to the engine output. The reset itself is recorded in the audit log.
        </p>
      </Modal>
      <AuditDrawer
        open={auditOpen}
        entries={audit.data ?? []}
        loading={audit.isLoading && live}
        unavailable={!live}
        onClose={() => setAuditOpen(false)}
        onOpenCase={openCase}
      />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Console />
      </ToastProvider>
    </QueryClientProvider>
  );
}
