import { useState } from 'react';
import type { CaseDetail } from '../lib/types';
import { MathHtml } from './MathHtml';

interface EvidenceTrioProps {
  c: CaseDetail;
}

function stringifyAnswer(ans: unknown): string {
  if (ans == null) return '';
  if (typeof ans === 'string') return ans;
  if (Array.isArray(ans)) return ans.join(', ');
  if (typeof ans === 'object') return JSON.stringify(ans);
  return String(ans);
}

export function EvidenceTrio({ c }: EvidenceTrioProps) {
  const [expandSolver, setExpandSolver] = useState(false);

  const storedKey = stringifyAnswer(c.current.answer);
  const matchingOption = c.answerOptions.find(
    (o) => o.label.toUpperCase() === storedKey.toUpperCase()
  );

  const solves = c.solves || [];
  const solveAnswers = solves.map((s) => stringifyAnswer(s.answer));
  const solverMatchesKey =
    solveAnswers.length > 0 &&
    solveAnswers.every((a) => a.toUpperCase() === storedKey.toUpperCase());

  // Distinct student claims
  const claims = [
    ...new Set(
      c.reports
        .map((r) => r.studentClaim || r.comment)
        .filter(Boolean)
        .map((s) => s.trim())
    ),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 select-none">
      {/* 1. Stored Key */}
      <div
        className={`p-3 rounded-card border ${
          solverMatchesKey
            ? 'bg-surface border-line'
            : 'bg-amber-50/40 border-amber-600/30'
        }`}
      >
        <div className="text-[11px] font-semibold text-tx-muted uppercase tracking-wider mb-1 font-mono">
          Stored Key
        </div>
        <div className="text-base font-bold text-tx font-mono flex items-center gap-2">
          <span>{storedKey || 'None'}</span>
        </div>
        {matchingOption && (
          <div className="text-xs text-tx-2 mt-1.5 font-sans line-clamp-2">
            <MathHtml html={matchingOption.text} />
          </div>
        )}
      </div>

      {/* 2. Blind Solver */}
      <div
        className={`p-3 rounded-card border ${
          solverMatchesKey
            ? 'bg-surface border-line'
            : 'bg-amber-50/40 border-amber-600/30'
        }`}
      >
        <div className="flex items-center justify-between text-[11px] font-semibold text-tx-muted uppercase tracking-wider mb-1 font-mono">
          <span>Blind Solves ({solves.length})</span>
          {solves.length > 0 && (
            <button
              type="button"
              onClick={() => setExpandSolver(!expandSolver)}
              className="text-[10px] text-pine-600 hover:underline lowercase font-sans"
            >
              {expandSolver ? 'collapse' : 'steps'}
            </button>
          )}
        </div>
        <div className="text-base font-bold text-tx font-mono flex items-center gap-2">
          {solveAnswers.length > 0 ? solveAnswers.join(' · ') : 'No solver run'}
        </div>
        {expandSolver && solves.length > 0 && (
          <div className="mt-2 text-xs text-tx-2 space-y-2 border-t border-line/60 pt-2 font-mono">
            {solves.map((s, idx) => (
              <div key={idx} className="bg-sunken p-2 rounded text-[11px]">
                <div className="font-semibold text-tx-3 mb-1">Solve {idx + 1}: {stringifyAnswer(s.answer)}</div>
                <div className="text-tx-muted whitespace-pre-wrap line-clamp-4">{s.reasoning || s.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Students Said */}
      <div className="p-3 rounded-card border bg-surface border-line">
        <div className="text-[11px] font-semibold text-tx-muted uppercase tracking-wider mb-1 font-mono">
          Students Claimed ({claims.length})
        </div>
        <div className="space-y-1 mt-1 text-xs text-tx font-sans">
          {claims.slice(0, 3).map((claim, idx) => (
            <div key={idx} className="line-clamp-2 italic text-tx-2">
              "{claim}"
            </div>
          ))}
          {claims.length === 0 && (
            <div className="text-tx-muted italic">No specific claim text</div>
          )}
        </div>
      </div>
    </div>
  );
}

