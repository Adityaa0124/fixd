import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

/**
 * A short guided tour. Each step spotlights an element marked with data-tour="<id>".
 * Steps whose target is not on screen (for example the queue on a phone) are skipped.
 * No dependency: a cut out overlay (one element with a huge box shadow) plus a positioned card.
 */
export interface TourStep {
  target?: string; // data-tour id; omitted = centred card with no spotlight
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to fixd',
    body: 'Students report errors in questions. The AI has already triaged every report and fixed what it could prove. Your job is to check its work and act in one key. This takes about 40 seconds.',
  },
  {
    target: 'lanes',
    title: 'Work lane by lane',
    body: 'Needs you: defects the AI will not change on its own. AI fixed: already live, keep or revert. No change: student mistakes and app issues, replies ready. Unreported: defects nobody reported, found by a sweep. Keys 1 to 5 switch lanes.',
  },
  {
    target: 'queue',
    title: 'Most harmful first',
    body: 'One row per question, however many students reported it. Ordered by severity, students affected and age, so a wrong answer key three students hit sits above a typo. J and K move through it.',
  },
  {
    target: 'headline',
    title: 'Read this first',
    body: 'What is wrong in one line, and the facts behind it: do the two blind solves agree, does the stored solution agree, were the students right. Their own words sit right below.',
  },
  {
    target: 'change',
    title: 'Exactly what changes',
    body: 'Removed text is struck through in red, added text underlined in green. An answer key change highlights the old and new option inside the question itself.',
  },
  {
    target: 'evidence',
    title: 'Why you can trust it',
    body: 'The stored key, two blind solves that never saw the key or the comments, and what the students claimed, side by side. Anything that disagrees is coloured.',
  },
  {
    target: 'replies',
    title: 'What the student sees',
    body: 'Every reporter gets a reply in their own language, Hinglish included. Edit it here if you like; it is sent when you act.',
  },
  {
    target: 'actions',
    title: 'Act in one key',
    body: 'A accepts, E edits the fix, R rejects, U undoes. In AI fixed, A keeps the fix and R reverts it. Every action is versioned, audited and reversible.',
  },
  {
    target: 'reset',
    title: 'Try anything',
    body: 'This is a live demo on the real assignment data. Reset demo puts everything back. Press ? for every shortcut, or replay this tour from the compass button.',
  },
];

const PAD = 8;
const CARD_W = 360;
const GAP = 14;

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(id: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth) return el;
  }
  return null;
}

function visibleRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const top = Math.max(r.top - PAD, 4);
  const bottom = Math.min(r.bottom + PAD, window.innerHeight - 4);
  const left = Math.max(r.left - PAD, 4);
  const right = Math.min(r.right + PAD, window.innerWidth - 4);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(200);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const dir = useRef<1 | -1>(1);

  useEffect(() => { if (open) { setI(0); dir.current = 1; } }, [open]);

  const step = TOUR_STEPS[i]!;
  const last = i === TOUR_STEPS.length - 1;

  const go = useCallback((d: 1 | -1) => {
    dir.current = d;
    setI((n) => Math.min(TOUR_STEPS.length - 1, Math.max(0, n + d)));
  }, []);

  // Bring the target into view (inside its own scroller), skip it if it is not on screen.
  useLayoutEffect(() => {
    if (!open) return;
    if (!step.target) { setRect(null); return; }
    const el = findTarget(step.target);
    if (!el) {
      if ((dir.current === 1 && !last) || (dir.current === -1 && i > 0)) go(dir.current);
      else setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    setRect(visibleRect(el));
  }, [open, i, step.target, last, go]);

  // Follow the target while panes scroll or the window resizes.
  useEffect(() => {
    if (!open || !step.target) return;
    let raf = 0;
    const tick = () => {
      const el = findTarget(step.target!);
      if (el) {
        const r = visibleRect(el);
        setRect((p) => (p && Math.abs(p.top - r.top) < 0.5 && Math.abs(p.left - r.left) < 0.5 && Math.abs(p.height - r.height) < 0.5 && Math.abs(p.width - r.width) < 0.5 ? p : r));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, step.target]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    nextRef.current?.focus({ preventScroll: true });
  }, [i, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); last ? onClose() : go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, last, go, onClose]);

  if (!open) return null;

  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 24);
  let top: number, left: number;
  if (!rect) {
    top = vh / 2 - cardH / 2;
    left = vw / 2 - w / 2;
  } else if (rect.top + rect.height + GAP + cardH < vh - 8) {
    top = rect.top + rect.height + GAP;                              // below
    left = rect.left;
  } else if (rect.top - GAP - cardH > 8) {
    top = rect.top - GAP - cardH;                                    // above
    left = rect.left;
  } else if (rect.left + rect.width + GAP + w < vw - 8) {
    top = rect.top + 12;                                             // right
    left = rect.left + rect.width + GAP;
  } else {
    top = vh - cardH - 16;                                           // tall target: pin bottom right
    left = vw - w - 16;
  }
  top = Math.min(Math.max(top, 12), vh - cardH - 12);
  left = Math.min(Math.max(left, 12), vw - w - 12);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="fx-tour-title">
      {/* Click anywhere outside the card to dismiss. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-[14px] ring-2 ring-pine-500 transition-all duration-200 ease-fx"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 9999px rgb(12 16 14 / 0.55)' }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0" style={{ background: 'rgb(12 16 14 / 0.55)' }} />
      )}
      <div
        ref={cardRef}
        className="absolute rounded-card border border-line bg-surface p-5 text-tx shadow-float transition-all duration-200 ease-fx"
        style={{ top, left, width: w }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-2xs font-medium uppercase tracking-[0.14em] text-pine-700">
            {i + 1} of {TOUR_STEPS.length}
          </span>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-tx-3 hover:bg-sunken hover:text-tx" aria-label="Close tour">
            <X size={15} />
          </button>
        </div>
        <h2 id="fx-tour-title" className="font-display text-[22px] leading-tight text-tx">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-tx-2">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="mr-auto flex gap-1" aria-hidden>
            {TOUR_STEPS.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-4 bg-pine-600' : 'w-1.5 bg-line-strong'}`} />
            ))}
          </div>
          {i === 0 ? (
            <button type="button" onClick={onClose} className="h-9 rounded-full px-3 text-sm text-tx-2 hover:bg-sunken">Skip</button>
          ) : (
            <button type="button" onClick={() => go(-1)} className="flex h-9 items-center gap-1 rounded-full px-3 text-sm text-tx-2 hover:bg-sunken" aria-label="Previous step">
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={() => (last ? onClose() : go(1))}
            className="flex h-9 items-center gap-1.5 rounded-full bg-pine-600 px-4 text-sm font-medium text-on-pine hover:bg-pine-700"
          >
            {i === 0 ? 'Show me' : last ? 'Start reviewing' : 'Next'} {!last && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
