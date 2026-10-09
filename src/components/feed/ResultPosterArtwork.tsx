import React from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import type { ResultFeedPayload } from '../../lib/resultFeedTypes';
import { getClubLogo } from '../../lib/teamLogos';
import './resultPoster.css';

type Props = {
  payload: ResultFeedPayload;
  ageGroup: string | null;
  competition: string;
  periods: string | null;
  date: string | null;
  venue: string | null;
  scorers: { playerName: string; detail: string }[];
};

const asset = (path: string) => `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}/${path}`;

function ClubMark({ name, src }: { name: string; src: string }) {
  const fallback = getClubLogo(name);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  return <div className="result-poster-club">
    <img src={failed ? fallback : src || fallback} alt={`${name} Logo`} onError={() => setFailed(true)} />
    <span>{name}</span>
  </div>;
}

/** Daten und Logos bleiben dynamisch; Motive sind ausschließlich vorhandene Demoassets. */
export const ResultPosterArtwork = React.forwardRef<HTMLDivElement, Props>(function ResultPosterArtwork(
  { payload: p, ageGroup, competition, periods, date, venue, scorers }, ref,
) {
  const ownScore = p.is_home ? p.home_score : p.away_score;
  const opponentScore = p.is_home ? p.away_score : p.home_score;
  const state = ownScore > opponentScore ? 'win' : ownScore < opponentScore ? 'loss' : 'draw';
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const photo = state === 'win' ? 'feed/demo-u12-team-moment.webp'
    : state === 'draw' ? 'feed/demo-matchday-player-01.webp' : null;
  React.useEffect(() => setPhotoFailed(false), [photo]);
  const hasPlayer = state === 'draw' && !photoFailed;
  return <div ref={ref} className={`result-poster result-poster--${state}${hasPlayer ? ' result-poster--player' : ''}`} data-result-state={state}>
    {photo && !photoFailed ? <img className="result-poster-motif" src={asset(photo)} alt="" aria-hidden onError={() => setPhotoFailed(true)} /> : null}
    <div className="result-poster-content">
      <header>
        <h2>ENDSTAND</h2>
        {ageGroup ? <div className="result-poster-age">{ageGroup}</div> : null}
        <p className="result-poster-competition">{competition}</p>
      </header>
      <div className="result-poster-match">
        <ClubMark name={p.home_team_name} src={p.home_logo_url} />
        <div className="result-poster-score">
          <strong>{p.home_score}:{p.away_score}</strong>
          {periods ? <p className="result-poster-periods">{periods}</p> : null}
          <p className="result-poster-status">{state === 'win' ? (p.is_home ? 'HEIMSIEG' : 'AUSWÄRTSSIEG') : state === 'draw' ? 'UNENTSCHIEDEN' : 'SPIEL BEENDET'}</p>
        </div>
        <ClubMark name={p.away_team_name} src={p.away_logo_url} />
      </div>
      {scorers.length ? <section className="result-poster-scorers">
        <h3>{scorers.length === 1 ? 'UNSER TORSCHÜTZE' : 'UNSERE TORSCHÜTZEN'}</h3>
        <ul>{scorers.map(scorer => <li key={scorer.playerName.toLocaleLowerCase('de-AT')}>
          <span>{scorer.playerName}</span><span>{scorer.detail}</span>
        </li>)}</ul>
      </section> : null}
      {date || venue ? <div className="result-poster-details">
        {date ? <p><CalendarDays aria-hidden /><span>{date}</span></p> : null}
        {venue ? <p><MapPin aria-hidden /><span>{venue}</span></p> : null}
      </div> : null}
      <footer>#GEMEINSAM<span>EINTEAM</span></footer>
    </div>
  </div>;
});
