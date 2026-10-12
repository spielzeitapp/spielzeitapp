import React from 'react';
type Props = { rank: number; name: string; value: string; detail?: string };
/** Shared challenge ranking presentation; rank comes from the existing scoring rules. */
export function ChallengeRankingRow({ rank, name, value, detail }: Props) {
 const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
 const medalLabel = rank === 1 ? 'Gold' : rank === 2 ? 'Silber' : 'Bronze';
 return <li className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 rounded-xl border border-[rgb(var(--club-border-rgb)/0.22)] bg-black/30 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
   {medal ? <span className="shrink-0 text-2xl leading-none" role="img" aria-label={'Platz ' + rank + ' · ' + medalLabel}>{medal}</span> : <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-white/45">{rank}.</span>}
   <p className="min-w-0 break-words text-[15px] font-semibold leading-snug text-white">{name}</p>
  <span className={'text-right text-lg font-bold leading-tight tabular-nums ' + (medal ? 'text-emerald-300' : 'text-white/85')}>{value}</span>
  {detail ? <p className="col-span-2 col-start-2 min-w-0 text-[11px] leading-snug text-white/50">{detail}</p> : null}
 </li>;
}
