import React, { useState } from 'react';
import type { SquadFeedPlayer } from '../../lib/squadFeedTypes';
import { FeedClubName } from './FeedClubName';
import './squadPoster.css';

type Props = {
  left: { name: string; logo: string };
  right: { name: string; logo: string };
  ageGroup: string;
  players: SquadFeedPlayer[];
  startsAt?: string | null;
  location?: string | null;
  teamPhotoUrl?: string | null;
};

/** The same responsive artwork is used in the feed and WhatsApp image export. */
export function SquadPosterArtwork({ left, right, ageGroup, players, startsAt, location, teamPhotoUrl }: Props) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const date = startsAt ? new Date(startsAt) : null;
  const validDate = date && Number.isFinite(date.getTime());
  const details = [validDate ? new Intl.DateTimeFormat('de-AT', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna',
  }).format(date) : null, validDate ? `${new Intl.DateTimeFormat('de-AT', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna',
  }).format(date)} Uhr` : null, location?.trim()].filter(Boolean).join(' · ');
  const showPhoto = teamPhotoUrl && failedPhoto !== teamPhotoUrl;
  return (
    <div className="squad-poster" data-whatsapp-status-poster>
      <div className="squad-poster-content">
        <h3 className="squad-poster-title">Unser Kader</h3>
        {ageGroup && <div className="squad-poster-age"><span>{ageGroup}</span></div>}
        <div className="squad-poster-match">
          {[left, right].map((team, index) => (
            <React.Fragment key={index}>
              {index === 1 && <span className="squad-poster-vs">VS</span>}
              <div className="squad-poster-club">
                <img src={team.logo} alt={`${team.name} Logo`} />
                <FeedClubName fullName={team.name} variant="posterArtwork" />
              </div>
            </React.Fragment>
          ))}
        </div>
        {details && <p className="squad-poster-details">{details}</p>}
        <h4 className="squad-poster-count">{players.length} Spieler im Kader</h4>
        <ul className="squad-poster-players">
          {players.map(player => <li key={player.player_id}>
            <span className="squad-poster-number">{player.jersey_number ?? '–'}</span>
            <span>{player.name}</span>
          </li>)}
        </ul>
      </div>
      {showPhoto && <img className="squad-poster-photo" src={teamPhotoUrl} alt="Unsere Mannschaft" onError={() => setFailedPhoto(teamPhotoUrl)} />}
      <div className="squad-poster-tag">#GEMEINSAM<span>EINTEAM</span></div>
    </div>
  );
}
