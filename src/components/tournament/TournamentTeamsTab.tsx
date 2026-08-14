import React from 'react';
import { ParticipantLogoChip } from '../live/ParticipantLogoChip';
import { splitTeamDisplayName } from './tournamentCenterUtils';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';
import type { TournamentParticipant } from '../../lib/tournamentPlan';
import { groupParticipantsByLabel } from '../../lib/tournamentPlan';

type Props = {
  participants: TournamentParticipant[];
  loading?: boolean;
};

export function TournamentTeamsTab({ participants, loading = false }: Props) {
  const groups = groupParticipantsByLabel(participants);

  if (loading) {
    return (
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className="text-[14px] text-white/55">Lade Teams…</p>
        </div>
      </section>
    );
  }

  if (participants.length === 0) {
    return (
      <section className={TC_CARD}>
        <div className={`${TC_CARD_INNER} text-center`}>
          <p className={TC_SECTION_LABEL}>Teams</p>
          <p className="mt-3 text-[14px] text-white/55">Noch keine Teilnehmer hinterlegt.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ label, items }) => (
        <section key={label ?? '_none'} className={TC_CARD}>
          <div className={TC_CARD_INNER}>
            {label ? (
              <p className={`${TC_SECTION_LABEL} mb-3`}>Gruppe {label}</p>
            ) : (
              <p className={`${TC_SECTION_LABEL} mb-3`}>Teilnehmer</p>
            )}
            <ul className="grid grid-cols-3 gap-x-1.5 gap-y-3.5 sm:grid-cols-4">
              {items.map((p) => {
                const { ageGroup } = splitTeamDisplayName(p.team_name);
                return (
                  <li key={p.id} className="flex flex-col items-center">
                    <ParticipantLogoChip teamName={p.team_name} carousel />
                    {ageGroup ? (
                      <span className="mt-0.5 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white/55">
                        {ageGroup}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
