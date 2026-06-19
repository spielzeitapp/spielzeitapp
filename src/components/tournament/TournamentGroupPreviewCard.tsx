import React, { useState } from 'react';
import { ListOrdered } from 'lucide-react';
import {
  formatTournamentGroupRankDisplay,
  type TournamentGroupStandings,
} from '../../lib/tournamentGroupStandings';
import { formatTournamentGoalDifference } from '../../lib/tournamentPlan';
import { AppButton } from '../ui/AppButton';
import { TournamentGroupStandingsSheet } from './TournamentGroupStandingsSheet';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

type Props = {
  standings: TournamentGroupStandings | null;
  loading?: boolean;
};

export function TournamentGroupPreviewCard({ standings, loading = false }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!loading && !standings) return null;

  const ourRow = standings?.rows.find((row) => row.isOurTeam) ?? null;

  return (
    <>
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className={`${TC_SECTION_LABEL} flex items-center gap-1.5`}>
            <ListOrdered className="h-3.5 w-3.5 text-red-400/85" strokeWidth={2} aria-hidden />
            Gruppenstand
          </p>

          {loading ? (
            <p className="mt-2 text-[14px] text-white/55">Gruppentabelle wird berechnet…</p>
          ) : standings && standings.ourRank != null ? (
            <div className="mt-2.5 flex flex-col gap-2.5">
              <p className="text-[17px] font-semibold leading-snug text-white">
                {formatTournamentGroupRankDisplay(standings.ourRank, standings.teamCount)}
              </p>
              {ourRow ? (
                <p className="text-[13px] tabular-nums text-white/70">
                  {ourRow.points} Punkte · {ourRow.goalsFor}:{ourRow.goalsAgainst} (
                  {formatTournamentGoalDifference(ourRow.goalDifference)})
                </p>
              ) : null}
              <AppButton
                variant="secondary"
                onClick={() => setSheetOpen(true)}
                className="w-full sm:w-auto"
              >
                Tabelle anzeigen
              </AppButton>
            </div>
          ) : (
            <p className="mt-2 text-[14px] text-white/55">Gruppenplatz noch nicht verfügbar.</p>
          )}
        </div>
      </section>

      <TournamentGroupStandingsSheet
        isOpen={sheetOpen}
        standings={standings}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
