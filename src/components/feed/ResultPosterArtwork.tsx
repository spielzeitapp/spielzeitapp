import { ClubLogo } from '../branding/ClubLogo';
import { scheduleClubName } from '../../lib/scheduleClubIdentity';
import { isUscRohrbachResult } from '../../lib/resultFeedPresentation';
import { useMatchClubBranding } from '../../hooks/useMatchClubBranding';
import React from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import type { ResultFeedPayload } from '../../lib/resultFeedTypes';
import { getClubLogo } from '../../lib/teamLogos';
import { displayLogoUrl } from '../../lib/logoPreparation';
import './resultPoster.css';
import { PosterClubName } from './PosterClubName';

type Props = {
  payload: ResultFeedPayload;
  ageGroup: string | null;
  seasonLabel?: string | null;
  competition: string;
  periods: string | null;
  date: string | null;
  venue: string | null;
  scorers: { playerName: string; detail: string }[];
};

function ClubMark({ name, src, fullName=false }: { name: string; src: string; fullName?:boolean }) {
  const fallback = getClubLogo(name);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  return <div className={`result-poster-club ${isUscRohrbachResult(name) ? "result-poster-club--wide" : ""}`}>
    <ClubLogo removeDarkBackground src={displayLogoUrl(failed ? fallback : src || fallback)} alt={`${scheduleClubName(name)} Logo`} onError={() => setFailed(true)} />
    <>{fullName ? <span className="result-poster-full-name">{scheduleClubName(name).replace(/\s*-\s*/g,'-')}</span> : <PosterClubName name={scheduleClubName(name)} wrap />}</>
  </div>;
}

/** Ergebnisgrafik mit dynamischen Daten und Vereinslogos. */
export const ResultPosterArtwork = React.forwardRef<HTMLDivElement, Props>(function ResultPosterArtwork(
  { payload: p, ageGroup, competition, periods, date, venue, scorers, seasonLabel }, ref,
) {
  const matchClub=useMatchClubBranding(p.team_season_id);
  const usc = isUscRohrbachResult(p.our_team_name);
  const scoreText = `${p.home_score}:${p.away_score}`;
  const ownScore = p.is_home ? p.home_score : p.away_score;
  const opponentScore = p.is_home ? p.away_score : p.home_score;
  const state = ownScore > opponentScore ? 'win' : ownScore < opponentScore ? 'loss' : 'draw';
  return <div ref={ref} style={matchClub.style} data-manager-artwork className={`result-poster result-poster--${state} ${usc ? 'result-poster--usc' : ''}`} data-result-state={state}>
    <div className="result-poster-content">
      {usc ? <header className="usc-result-heading">
        <div><strong>SPIELERGEBNIS</strong><span>{competition}</span></div>
        <p>{[date, p.is_home ? 'Heimspiel' : 'Auswärts'].filter(Boolean).join(' · ')}</p>
      </header> : <header>
        <h2>ENDSTAND</h2>
        {ageGroup ? <div className="result-poster-age">{ageGroup}</div> : null}
        <p className="result-poster-competition">{competition}</p>
      </header>}
      <div className="result-poster-match">
        <ClubMark fullName={usc} name={p.home_team_name} src={p.is_home ? matchClub.brand?.logo_url || p.home_logo_url : p.home_logo_url} />
        <div className="result-poster-score">
          {usc ? <span className="usc-result-score-label">ENDSTAND</span> : null}
          <strong style={{ fontSize: `${Math.min(usc ? 17 : 20, (usc ? 54 : 64) / scoreText.length)}cqw` }}>{scoreText}</strong>
        </div>
        <ClubMark fullName={usc} name={p.away_team_name} src={!p.is_home ? matchClub.brand?.logo_url || p.away_logo_url : p.away_logo_url} />
      </div>
      <div className="result-poster-summary">
        {periods ? <p className="result-poster-periods">{periods}</p> : null}
        <p className="result-poster-status">{state === 'win' ? (p.is_home ? 'HEIMSIEG' : 'AUSWÄRTSSIEG') : state === 'draw' ? 'UNENTSCHIEDEN' : 'SPIEL BEENDET'}</p>
      </div>
      {scorers.length ? <section className="result-poster-scorers">
        <h3>{scorers.length === 1 ? 'UNSER TORSCHÜTZE' : 'UNSERE TORSCHÜTZEN'}</h3>
        <ul>{scorers.map(scorer => <li key={scorer.playerName.toLocaleLowerCase('de-AT')}>
          <span>{scorer.playerName}</span><span>{scorer.detail}</span>
        </li>)}</ul>
      </section> : null}
      {date || venue ? <div className="result-poster-details">
        {date && !usc ? <p><CalendarDays aria-hidden /><span>{date}</span></p> : null}
        {venue ? <p><MapPin aria-hidden /><span>{venue}</span></p> : null}
      </div> : null}
      <footer>{usc ? '#GEMEINSAMSTARK' : <>#GEMEINSAM<span>EINTEAM</span></>}</footer>
    </div>
  </div>;
});
