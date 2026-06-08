import React, { useState } from 'react';
import { ListOrdered } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { AppButton } from '../ui/AppButton';
import {
  formatTournamentGroupRankDisplay,
  type TournamentGroupStandings,
} from '../../lib/tournamentGroupStandings';
import { TournamentGroupStandingsSheet } from './TournamentGroupStandingsSheet';

type Props = {
  standings: TournamentGroupStandings | null;
  loading?: boolean;
};

export const TournamentGroupStandingCard: React.FC<Props> = ({ standings, loading = false }) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!loading && !standings) return null;

  const ourRow = standings?.rows.find((row) => row.isOurTeam) ?? null;

  return (
    <>
      <Card className="relative border border-purple-500/20 bg-purple-950/15">
        <CardTitle className="!mb-0 flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
          Gruppenplatz
        </CardTitle>

        {loading ? (
          <p className="mt-3 text-[14px] text-white/65">Gruppentabelle wird berechnet…</p>
        ) : standings && standings.ourRank != null ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-[18px] font-semibold leading-snug text-white">
              {formatTournamentGroupRankDisplay(standings.ourRank, standings.teamCount)}
            </p>
            {ourRow ? (
              <p className="text-[14px] tabular-nums text-white/75">
                {ourRow.points} Punkte · {ourRow.goalsFor}:{ourRow.goalsAgainst}
              </p>
            ) : null}
            <AppButton variant="secondary" onClick={() => setSheetOpen(true)} className="w-full sm:w-auto">
              Tabelle anzeigen
            </AppButton>
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-white/65">Gruppenplatz noch nicht verfügbar.</p>
        )}
      </Card>

      <TournamentGroupStandingsSheet
        isOpen={sheetOpen}
        standings={standings}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
};
