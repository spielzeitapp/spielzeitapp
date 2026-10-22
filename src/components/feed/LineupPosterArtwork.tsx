import React from 'react';
import type { LineupFeedPlayer } from '../../lib/lineupFeedTypes';
import { lineupFeedDisplayPlayerName, lineupFeedDisplayPositionAbbrev } from '../../lib/lineupFeedTypes';
import { PosterClubName } from './PosterClubName';
import './squadPoster.css';
import './lineupPoster.css';

type Props = {
  left: { name: string; logo: string };
  right: { name: string; logo: string };
  ageGroup: string; formation: string | null;
  players: LineupFeedPlayer[]; bench: LineupFeedPlayer[];
  matchType?: string | null; startsAt?: string | null; location?: string | null;
};

function jerseyNumber(player: LineupFeedPlayer): string {
  const number = player.jersey_number;
  return typeof number === 'number' && Number.isFinite(number) && number > 0
    ? String(Math.trunc(number)) : '–';
}

/** Shared feed/export artwork: original crests, live data, no player-count limit. */
export function LineupPosterArtwork({ left, right, ageGroup, formation, players, bench,
  matchType, startsAt, location }: Props) {
  const date = startsAt ? new Date(startsAt) : null;
  const details = [date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' }).format(date)
    : null, location?.trim()].filter(Boolean).join(' · ');
  return <div className="lineup-poster" data-manager-artwork data-whatsapp-status-poster>
    <div className="lineup-poster-content">
      <header>
        <h3>STARTAUFSTELLUNG</h3>
        {ageGroup && <div className="lineup-poster-age">{ageGroup}</div>}
        {matchType && <p className="lineup-poster-meta">{matchType}</p>}
        <div className="squad-poster-match">
          {[left, right].map((team, i) => <React.Fragment key={i}>
            {i === 1 && <span className="squad-poster-vs">VS</span>}
            <div className="squad-poster-club">
              <img src={team.logo} alt={team.name + ' Logo'} />
              <PosterClubName name={team.name} />
            </div>
          </React.Fragment>)}
        </div>
      </header>
      {formation && <p className="lineup-poster-formation">FORMATION {formation}</p>}
      <ul className="lineup-poster-starters" aria-label="Startaufstellung">
        {players.map((player, i) => <li key={player.player_id + '-' + (player.slot ?? i)}>
          <b>{jerseyNumber(player)}</b>
          <span>{lineupFeedDisplayPlayerName(player) || 'nicht benannt'}</span>
          <small>{lineupFeedDisplayPositionAbbrev(player)}</small>
        </li>)}
      </ul>
      {bench.length > 0 && <section className="lineup-poster-bench">
        <h4>ERSATZBANK</h4>
        <ul>{bench.map((player, i) => <li key={player.player_id + '-' + i}>
          <b>{jerseyNumber(player)}</b><span>{lineupFeedDisplayPlayerName(player)}</span>
        </li>)}</ul>
      </section>}
      {details && <p className="lineup-poster-details">{details}</p>}
      <footer>#GEMEINSAM<span>EINTEAM</span></footer>
    </div>
  </div>;
}
