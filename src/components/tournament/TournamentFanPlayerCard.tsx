import React from 'react';
import { MatchPlayerRow } from '../match/MatchPlayerRow';
import type { PublicTournamentPlayer } from '../../lib/publicTeamTournament';
import { FanTeamLogo } from './TournamentFanFixture';

type Props = {
  player: PublicTournamentPlayer;
  clubName: string;
  clubLogo?: string | null;
  goals?: number;
  rank?: number;
};

export function TournamentFanPlayerCard({ player, clubName, clubLogo, goals, rank }: Props) {
  return <MatchPlayerRow
    player={{
      id: player.name,
      display_name: player.name,
      first_name: player.firstName,
      last_name: player.lastName,
      jersey_number: player.number,
      avatar_url: player.imageUrl,
    }}
    layout="team-roster"
    hideSubline
    trailing={<span className="flex items-center gap-2">
      {goals != null ? <span className="flex flex-col items-end rounded-xl bg-[var(--t-player-badge,rgba(0,0,0,.25))] px-2.5 py-2 text-[var(--t-text,#fff)]"><span className="text-[10px] font-bold uppercase tracking-wide text-[var(--t-muted,#aaa)]">{rank ? `Platz ${rank}` : 'Tore'}</span><span className="text-[17px] font-black tabular-nums">{goals} {goals === 1 ? 'Tor' : 'Tore'}</span></span> : null}
      <FanTeamLogo name={clubName} ownName={clubName} ownLogo={clubLogo} small />
    </span>}
  />;
}
