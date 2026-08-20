import React from 'react';
import { ListOrdered } from 'lucide-react';
import {
  formatTournamentGroupRankDisplay,
  tournamentStandingsSourceHint,
  type TournamentStandingsBundle,
} from '../../lib/tournamentGroupStandings';
import { formatTournamentGoalDifference } from '../../lib/tournamentPlan';
import { AppButton } from '../ui/AppButton';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';
import { TournamentStandingsGroupList } from './TournamentStandingsGroupList';

const PREVIEW_ROW_LIMIT = 4;

type Props = {
  bundle: TournamentStandingsBundle;
  loading?: boolean;
  onShowFullTable?: () => void;
};

export function TournamentGroupPreviewCard({ bundle, loading = false, onShowFullTable }: Props) {
  const primary = bundle.primaryGroup;
  const sourceHint = tournamentStandingsSourceHint(bundle.source);

  if (!loading && !primary) return null;

  const ourRow = primary?.rows.find((row) => row.isOurTeam) ?? null;
  const hasMoreRows = (primary?.rows.length ?? 0) > PREVIEW_ROW_LIMIT;

  return (
    <section className={TC_CARD}>
      <div className={TC_CARD_INNER}>
        <p className={`${TC_SECTION_LABEL} flex items-center gap-1.5`}>
          <ListOrdered className="h-3.5 w-3.5 text-red-400/85" strokeWidth={2} aria-hidden />
          Gruppentabelle
        </p>

        {loading && !primary ? (
          <p className="mt-2 text-[14px] text-white/55">Gruppentabelle wird geladen…</p>
        ) : primary ? (
          <div className="mt-2.5 flex flex-col gap-2.5">
            {primary.ourRank != null ? (
              <p className="text-[16px] font-semibold leading-snug text-white">
                {formatTournamentGroupRankDisplay(primary.ourRank, primary.teamCount)}
              </p>
            ) : null}
            {ourRow ? (
              <p className="text-[12px] tabular-nums text-white/65">
                {ourRow.points} Punkte · {ourRow.goalsFor}:{ourRow.goalsAgainst} (
                {formatTournamentGoalDifference(ourRow.goalDifference)})
              </p>
            ) : null}
            {sourceHint ? (
              <p className="text-[10px] leading-snug text-white/35">{sourceHint}</p>
            ) : null}
            <TournamentStandingsGroupList
              standings={primary}
              compact
              maxRows={PREVIEW_ROW_LIMIT}
            />
            {onShowFullTable ? (
              <AppButton variant="secondary" onClick={onShowFullTable} className="w-full sm:w-auto">
                {hasMoreRows || bundle.groups.length > 1
                  ? 'Komplette Tabelle anzeigen'
                  : 'Tabelle anzeigen'}
              </AppButton>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[14px] text-white/55">Gruppentabelle noch nicht verfügbar.</p>
        )}
      </div>
    </section>
  );
}
