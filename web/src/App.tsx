import { useState, useEffect, useMemo } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { Lane, Edit, SweepFinding } from './lib/types';
import { api } from './lib/api';
import { useHotkeys } from './hooks/useHotkeys';
import { WarmupGate } from './components/WarmupGate';
import { TopBar } from './components/TopBar';
import { Queue } from './components/Queue';
import { CaseHeader } from './components/CaseHeader';
import { VerdictCard } from './components/VerdictCard';
import { EvidenceTrio } from './components/EvidenceTrio';
import { QuestionDiff } from './components/QuestionDiff';
import { AlsoNoticed } from './components/AlsoNoticed';
import { Reports } from './components/Reports';
import { ActionBar } from './components/ActionBar';
import { EditDialog } from './components/EditDialog';
import { RejectDialog } from './components/RejectDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { AuditDrawer } from './components/AuditDrawer';
import { SweepPanel } from './components/SweepPanel';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

function Console() {
  const qc = useQueryClient();
  const [lane, setLane] = useState<Lane>('needs_review');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});

  // Theme
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
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const isModalOpen = editOpen || rejectOpen || revertOpen || shortcutsOpen || auditOpen;

  // Queue query
  const { data: casesData, isLoading: queueLoading } = useQuery({
    queryKey: ['cases', lane, search],
    queryFn: () => api.cases(lane, search),
  });

  const items = casesData?.items || [];
  const counts = casesData?.counts || {};

  // Sweep findings query
  const { data: sweepFindings = [] } = useQuery<SweepFinding[]>({
    queryKey: ['sweep'],
    queryFn: async () => {
      try {
        return (await api.sweep()) as SweepFinding[];
      } catch {
        const res = await fetch('/sweep.json');
        return (await res.json()) as SweepFinding[];
      }
    },
  });

  const allCounts = {
    ...counts,
    sweep: sweepFindings.filter((f) => f.guardOk).length,
  };

  // Sync selectedId with items
  useEffect(() => {
    if (items.length > 0) {
      if (!selectedId || !items.some((i) => i.id === selectedId)) {
        setSelectedId(items[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [items, selectedId]);

  // Case detail query
  const { data: caseDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['case', selectedId],
    queryFn: () => api.case(selectedId!),
    enabled: !!selectedId,
  });

  // Reset local replies on case switch
  useEffect(() => {
    setReplies({});
  }, [selectedId]);

  // Audit query
  const { data: auditEntries = [], isLoading: auditLoading } = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.audit(),
    enabled: auditOpen,
  });

  // Action mutation
  const actionMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (!selectedId) throw new Error('No case selected');
      return api.act(selectedId, body);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['case', updated.id], updated);
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['audit'] });

      // Auto advance to next case in current lane
      const currentIndex = items.findIndex((i) => i.id === updated.id);
      if (currentIndex >= 0 && currentIndex < items.length - 1) {
        setSelectedId(items[currentIndex + 1].id);
      } else if (items.length > 1) {
        setSelectedId(items[0].id);
      }
    },
  });

  const handleApprove = () => {
    actionMutation.mutate({ type: 'approve', replies });
  };

  const handleSaveEdit = (edits: Edit[]) => {
    actionMutation.mutate({ type: 'edit', edits, replies });
  };

  const handleRejectConfirm = (reason: string) => {
    actionMutation.mutate({ type: 'reject', reason, replies });
  };

  const handleConfirm = () => {
    actionMutation.mutate({ type: 'confirm' });
  };

  const handleRevertConfirm = (reason: string) => {
    actionMutation.mutate({ type: 'revert', reason });
  };

  const handleAcknowledge = () => {
    actionMutation.mutate({ type: 'acknowledge' });
  };

  const handleUndo = () => {
    actionMutation.mutate({ type: 'undo' });
  };

  // Keyboard navigation
  const currentIndex = items.findIndex((i) => i.id === selectedId);

  const hotkeys = useMemo(
    () => ({
      j: () => {
        if (currentIndex < items.length - 1) setSelectedId(items[currentIndex + 1].id);
      },
      k: () => {
        if (currentIndex > 0) setSelectedId(items[currentIndex - 1].id);
      },
      a: () => {
        if (lane === 'needs_review') handleApprove();
        else if (lane === 'spot_check') handleConfirm();
        else if (lane === 'no_change') handleAcknowledge();
      },
      e: () => {
        if (lane === 'needs_review' && caseDetail) setEditOpen(true);
      },
      r: () => {
        if (lane === 'needs_review' && caseDetail) setRejectOpen(true);
        else if (lane === 'spot_check' && caseDetail) setRevertOpen(true);
      },
      u: () => handleUndo(),
      '1': () => setLane('needs_review'),
      '2': () => setLane('spot_check'),
      '3': () => setLane('no_change'),
      '4': () => setLane('done'),
      t: () => toggleTheme(),
      '?': () => setShortcutsOpen(true),
      escape: () => {
        setEditOpen(false);
        setRejectOpen(false);
        setRevertOpen(false);
        setShortcutsOpen(false);
        setAuditOpen(false);
      },
    }),
    [currentIndex, items, lane, caseDetail]
  );

  useHotkeys(hotkeys, !isModalOpen);

  return (
    <div className="min-h-screen bg-bg text-tx flex flex-col font-sans">
      <TopBar
        lane={lane}
        counts={allCounts}
        onSelectLane={setLane}
        search={search}
        onSearchChange={setSearch}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAudit={() => setAuditOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {lane === 'sweep' ? (
        <SweepPanel findings={sweepFindings} />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <Queue
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isLoading={queueLoading}
          />

          <main className="flex-1 overflow-y-auto flex flex-col justify-between">
            <div className="p-6 max-w-5xl w-full mx-auto">
              {detailLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-6 bg-sunken rounded w-1/3" />
                  <div className="h-32 bg-sunken rounded-card" />
                  <div className="h-48 bg-sunken rounded-card" />
                </div>
              ) : caseDetail ? (
                <>
                  <CaseHeader c={caseDetail} />
                  <VerdictCard c={caseDetail} />
                  <EvidenceTrio c={caseDetail} />
                  <QuestionDiff c={caseDetail} />
                  <AlsoNoticed c={caseDetail} />
                  <Reports
                    c={caseDetail}
                    replies={replies}
                    onReplyChange={(rid, text) =>
                      setReplies((prev) => ({ ...prev, [rid]: text }))
                    }
                  />
                </>
              ) : (
                <div className="py-24 text-center">
                  <h3 className="font-display italic text-3xl text-tx mb-2">No case selected</h3>
                  <p className="text-xs text-tx-3">Pick a case from the queue to review.</p>
                </div>
              )}
            </div>

            {caseDetail && (
              <ActionBar
                lane={lane}
                c={caseDetail}
                isPending={actionMutation.isPending}
                onApprove={handleApprove}
                onOpenEdit={() => setEditOpen(true)}
                onOpenReject={() => setRejectOpen(true)}
                onConfirm={handleConfirm}
                onOpenRevert={() => setRevertOpen(true)}
                onAcknowledge={handleAcknowledge}
                onUndo={handleUndo}
              />
            )}
          </main>
        </div>
      )}

      {caseDetail && (
        <>
          <EditDialog
            c={caseDetail}
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onSave={handleSaveEdit}
          />
          <RejectDialog
            isOpen={rejectOpen}
            onClose={() => setRejectOpen(false)}
            onConfirm={handleRejectConfirm}
          />
          <RejectDialog
            isOpen={revertOpen}
            onClose={() => setRevertOpen(false)}
            onConfirm={handleRevertConfirm}
          />
        </>
      )}

      <ShortcutsDialog isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <AuditDrawer
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        entries={auditEntries}
        isLoading={auditLoading}
      />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WarmupGate>
        <Console />
      </WarmupGate>
    </QueryClientProvider>
  );
}
