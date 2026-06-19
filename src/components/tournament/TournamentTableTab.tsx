import React from 'react';
import { ListOrdered } from 'lucide-react';
import {
  formatTournamentGroupRankDisplay,
  type TournamentGroupStandings,
} from '../../lib/tournamentGroupStandings';
import { formatTournamentGoalDifference } from '../../lib/tournamentPlan';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

type Props = {
  standings: TournamentGroupStandings | null;
  loading?: boolean;
};

export function TournamentTableTab({ standings, loading = false }: Props) {
  if (loading) {
    return (
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className="text-[14px] text-white/55">Gruppentabelle wird geladen…</p>
        </div>
      </section>
    );
  }

  if (!standings || standings.rows.length === 0) {
    return (
      <section className={TC_CARD}>
        <div className={`${TC_CARD_INNER} flex flex-col items-center py-4 text-center`}>
          <ListOrdered className="mb-2 h-8 w-8 text-white/25" strokeWidth={1.75} aria-hidden />
          <p className="text-[15px] font-semibold text-white/85">Keine Tabelle verfügbar</p>
          <p className="mt-1.5 max-w-[16rem] text-[13px] leading-snug text-white/45">
            Importiere den offiziellen Turnierplan oder trage Gruppenergebnisse ein, um die
            Gruppentabelle zu sehen.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={TC_CARD}>
      <div className={TC_CARD_INNER}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className={TC_SECTION_LABEL}>Gruppe {standings.groupLabel}</p>
          {standings.ourRank != null ? (
            <p className="text-[12px] font-medium text-white/65">
              {formatTournamentGroupRankDisplay(standings.ourRank, standings.teamCount)}
            </p>
          ) : null}
        </div>
        <ul className="flex flex-col gap-1.5">
          {standings.rows.map((row) => (
            <li
              key={row.teamName}
              className={`rounded-xl border px-3 py-2.5 ${
                row.isOurTeam
                  ? 'border-[rgba(255,71,71,0.28)] bg-[rgba(255,71,71,0.06)]'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-white">
                    {row.rank}. {row.teamName}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-white/50">
                    {row.played} Sp. · {row.wins}-{row.draws}-{row.losses}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-bold tabular-nums text-white">{row.points} Pkt.</p>
                  <p className="text-[11px] tabular-nums text-white/55">
                    {row.goalsFor}:{row.goalsAgainst} (
                    {formatTournamentGoalDifference(row.goalDifference)})
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
