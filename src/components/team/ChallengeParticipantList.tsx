import React, { useState } from 'react';
import { ChallengeRankingRow } from './ChallengeRankingRow';
import { PremiumTab, PremiumTabTrack } from '../../ui';

export type ParticipantRanking = { id: string; label: string; rows: { id: string; rank: number; name: string; value: string; detail?: string }[] };
export type ChallengeParticipant = { id: string; name: string; detail: string };

export function ChallengeParticipantList({ rankings, participants }: { rankings: ParticipantRanking[]; participants: ChallengeParticipant[] }) {
  const [selected, setSelected] = useState(rankings[0]?.id ?? '');
  const ranking = rankings.find(row => row.id === selected) ?? rankings[0];
  if (!ranking) return null;
  const rankedIds = new Set(ranking.rows.map(row => row.id));
  const unranked = participants.filter(row => !rankedIds.has(row.id));
  return <section className="mt-4 min-w-0 border-t border-white/10 pt-4" aria-label="Gesamte Spielerliste">
    <h4 className="text-sm font-bold text-white">Gesamte Spielerliste · {participants.length}</h4>
    <PremiumTabTrack className="mt-3" aria-label="Challenge-Wertung">
      {rankings.map(row => <PremiumTab key={row.id} active={ranking.id === row.id} onClick={() => setSelected(row.id)}>{row.label}</PremiumTab>)}
    </PremiumTabTrack>
    {ranking.rows.length ? <ol className="mt-3 space-y-2">{ranking.rows.map(row => <ChallengeRankingRow key={row.id} rank={row.rank} name={row.name} value={row.value} detail={row.detail} />)}</ol> : <p className="mt-3 text-xs text-white/50">Noch keine Wertung in dieser Kategorie.</p>}
    {unranked.length ? <>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-white/45">Ohne Wertung · {unranked.length}</p>
      <ul className="mt-2 space-y-2">{unranked.map(row => <li key={row.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
        <p className="break-words text-sm font-semibold text-white/75">{row.name}</p>
        <p className="mt-1 text-[11px] leading-snug text-white/45">{row.detail}</p>
      </li>)}</ul>
    </> : null}
    {!participants.length ? <p className="mt-3 text-xs text-white/50">Noch keine Spieler vorhanden.</p> : null}
  </section>;
}
