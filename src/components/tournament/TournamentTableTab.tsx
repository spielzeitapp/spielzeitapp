import React from 'react';
import { ListOrdered } from 'lucide-react';
import {
  tournamentStandingsSourceHint,
  type TournamentStandingsBundle,
} from '../../lib/tournamentGroupStandings';
import { CenterEmptyState } from '../center/CenterEmptyState';
import { TC_CARD, TC_CARD_INNER } from './tournamentCenterStyles';
import { TournamentStandingsGroupList } from './TournamentStandingsGroupList';

type Props = {
  bundle: TournamentStandingsBundle;
  loading?: boolean;
};

export function TournamentTableTab({ bundle, loading = false }: Props) {
  const sourceHint = tournamentStandingsSourceHint(bundle.source);
  const hasStandings = bundle.groups.length > 0;

  if (loading && !hasStandings) {
    return (
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className="text-[14px] text-white/55">Gruppentabelle wird geladen…</p>
        </div>
      </section>
    );
  }

  if (!hasStandings) {
    return (
      <CenterEmptyState
        icon={ListOrdered}
        title="Keine Tabelle verfügbar"
        description="Sobald Gruppenergebnisse vorliegen oder der Turnierplan importiert ist, erscheint hier die Tabelle."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sourceHint ? (
        <p className="px-0.5 text-[11px] leading-snug text-white/45">{sourceHint}</p>
      ) : null}
      {bundle.groups.map((group) => (
        <section key={group.groupLabel} className={TC_CARD}>
          <div className={TC_CARD_INNER}>
            <TournamentStandingsGroupList standings={group} />
          </div>
        </section>
      ))}
    </div>
  );
}
