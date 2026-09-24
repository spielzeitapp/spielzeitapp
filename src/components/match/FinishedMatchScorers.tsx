import React from 'react';

export type FinishedMatchScorer = { name: string; minute?: string | null };

/** Compact result-card summary; keep every recorded minute when a player scores more than once. */
export const FinishedMatchScorers: React.FC<{
  scorers: FinishedMatchScorer[];
  ownGoals: number;
}> = ({ scorers, ownGoals }) => {
  if (ownGoals <= 0 && scorers.length === 0) return null;

  const grouped = new Map<string, string[]>();
  for (const scorer of scorers) {
    const name = scorer.name.trim() || 'Ohne Torschütze';
    const minutes = grouped.get(name) ?? [];
    if (scorer.minute) minutes.push(scorer.minute);
    grouped.set(name, minutes);
  }

  return (
    <div className="mt-3 border-t border-white/10 px-1 pt-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-200/85">Unsere Torschützen</p>
      {grouped.size > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] leading-snug text-white/90">
          {[...grouped].map(([name, minutes]) => (
            <span key={name}>
              <span className="font-semibold">{name}</span>
              {minutes.length > 0 ? <span className="text-white/55"> · {minutes.join(', ')}</span> : null}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-white/55">Torschützen noch nicht erfasst.</p>
      )}
    </div>
  );
};
