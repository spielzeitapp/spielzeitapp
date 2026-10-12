import React from 'react';

type Award = { emoji: string; label: string; name: string | null; value?: string | null };

/** Full names and aligned results, including on narrow phones. */
export function ChallengeAwardList({ awards, loading = false }: { awards: Award[]; loading?: boolean }) {
  if (loading) return <p className="mt-3 text-xs text-white/55" role="status">Wertungen werden geladen…</p>;
  return <ul className="mt-3 min-w-0 space-y-2">
    {awards.map(award => <li key={award.label} className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] items-start gap-x-2 rounded-xl border border-[rgb(var(--club-border-rgb)/0.22)] bg-black/30 px-3 py-3">
      <span aria-hidden className="row-span-2 text-xl leading-snug">{award.emoji}</span>
      <p className="text-[11px] font-semibold leading-snug text-white/50">{award.label}</p>
      <div className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <p className={'min-w-0 break-words text-sm font-semibold leading-snug ' + (award.name ? 'text-white' : 'text-white/45')}>{award.name ?? 'Noch keine Wertung'}</p>
        {award.name && award.value ? <p className="text-right text-sm font-bold tabular-nums leading-snug text-emerald-300">{award.value}</p> : null}
      </div>
    </li>)}
  </ul>;
}
