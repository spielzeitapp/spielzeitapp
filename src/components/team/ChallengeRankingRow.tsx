import React from 'react';
type Props = { rank: number; name: string; value: string; detail?: string };
/** Shared challenge ranking presentation; rank comes from the existing scoring rules. */
export function ChallengeRankingRow({ rank, name, value, detail }: Props) {
 const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
 const medalLabel = rank === 1 ? 'Gold' : rank === 2 ? 'Silber' : 'Bronze';
 return <li className="flex items-start justify-between gap-3 rounded-2xl border border-[rgb(var(--club-border-rgb)/0.22)] bg-black/30 px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
  <div className="flex min-w-0 flex-1 items-start gap-3">
   {medal ? <span className="shrink-0 text-2xl leading-none" role="img" aria-label={'Platz ' + rank + ' · ' + medalLabel}>{medal}</span> : <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-white/45">{rank}.</span>}
   <div className="min-w-0"><p className="break-words text-[15px] font-bold leading-snug text-white sm:text-base">{name}</p>{detail ? <p className="mt-1 text-xs leading-snug text-white/50">{detail}</p> : null}</div>
  </div>
  <span className={'shrink-0 text-right text-lg font-extrabold leading-tight tabular-nums sm:text-xl ' + (medal ? 'text-emerald-300' : 'text-white/85')}>{value}</span>
 </li>;
}
