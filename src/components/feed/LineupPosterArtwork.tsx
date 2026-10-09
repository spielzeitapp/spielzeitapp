import React from 'react';
import type { LineupFeedPlayer } from '../../lib/lineupFeedTypes';
import { lineupFeedDisplayPlayerName } from '../../lib/lineupFeedTypes';
import { U11_FORMATIONS, isU11FormationId } from '../../lib/matchFormations';
import { LeibchenJersey } from '../match/LeibchenJersey';
import './squadPoster.css';
import './lineupPoster.css';

const SLOT_ALIAS: Record<string, string> = { TW:'GK', LV:'LB', RV:'RB', IV:'CM', ZM:'CM', LA:'LW', LF:'LW', LM:'LW', RA:'RW', RF:'RW', RM:'RW' };

/** Explicit stored field slots take priority. Legacy generic labels fill only unused slots. */
export function buildPosterLineup(formation: string | null, players: LineupFeedPlayer[]) {
  if (!isU11FormationId(formation)) return null;
  const layout = U11_FORMATIONS[formation];
  const assigned = new Map<string, LineupFeedPlayer>();
  const remaining: LineupFeedPlayer[] = [];
  for (const player of players) {
    const raw = (player.slot || '').trim().toUpperCase();
    const slot = SLOT_ALIAS[raw] || raw;
    if (layout.some(s => s.slot === slot) && !assigned.has(slot)) assigned.set(slot, player);
    else remaining.push(player);
  }
  for (const slot of layout) if (!assigned.has(slot.slot) && remaining.length) assigned.set(slot.slot, remaining.shift()!);
  return layout.map(slot => ({ ...slot, player: assigned.get(slot.slot) })).filter(s => s.player);
}

type Props = {
  left: { name: string; logo: string }; right: { name: string; logo: string };
  ageGroup: string; formation: string | null; players: LineupFeedPlayer[]; bench: LineupFeedPlayer[];
};

export function LineupPosterArtwork({ left, right, ageGroup, formation, players, bench }: Props) {
  const lineup = buildPosterLineup(formation, players);
  const [photoFailed, setPhotoFailed] = React.useState(false);
  return <div className="lineup-poster" data-whatsapp-status-poster>
    {!photoFailed && <img className="lineup-poster-player" src="/feed/demo-matchday-player-01.webp" alt="" aria-hidden onError={() => setPhotoFailed(true)} />}
    <div className="lineup-poster-content">
      <header>
        <h3>AUFSTELLUNG</h3>
        {ageGroup && <div className="squad-poster-age">{ageGroup}</div>}
        <div className="squad-poster-match">
          {[left, right].map((team, i) => <React.Fragment key={i}>
            {i === 1 && <span className="squad-poster-vs">VS</span>}
            <div className="squad-poster-club"><img src={team.logo} alt={`${team.name} Logo`} /><span>{team.name}</span></div>
          </React.Fragment>)}
        </div>
      </header>
      <div className="lineup-poster-tactics">
        <h4>{formation ? `SYSTEM ${formation}` : 'STARTAUFSTELLUNG'}</h4>
        {lineup ? <div className="lineup-poster-pitch" aria-label={`Startaufstellung im System ${formation}`}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <g fill="none" stroke="#ef002a" strokeWidth=".45">
              <path d="M8 1H92L99 99H1Z M5 50H95 M29 1L27 19H73L71 1 M38 1V8H62V1 M25 99L27 80H73L75 99 M38 99V92H62V99" />
              <ellipse cx="50" cy="50" rx="11" ry="9" /><circle cx="50" cy="50" r=".6" />
            </g>
          </svg>
          {lineup.map(({ slot, label, x, y, player }) => <div key={slot} className="lineup-poster-marker" data-slot={slot} style={{ left:`${Math.max(19, Math.min(81, x))}%`, top:`${y}%` }}>
            <LeibchenJersey lastName={lineupFeedDisplayPlayerName(player!) || ''} number={player!.jersey_number} position={slot === 'GK' ? 'TW' : label} variant={slot === 'GK' ? 'goalkeeper' : 'field'} showBackPrint={false} pitchStyleBack className="lineup-poster-shirt" />
            <span>{lineupFeedDisplayPlayerName(player!) || 'nicht benannt'}</span>
          </div>)}
        </div> : <ul className="lineup-poster-fallback">{players.map(p => <li key={p.player_id}>{p.jersey_number ?? '–'} · {lineupFeedDisplayPlayerName(p)}</li>)}</ul>}
        {bench.length > 0 && <section className="lineup-poster-bench"><h4>ERSATZBANK</h4><ul>{bench.map(p => <li key={p.player_id}><b>{p.jersey_number ?? '–'}</b> {lineupFeedDisplayPlayerName(p)}</li>)}</ul></section>}
      </div>
      <footer>#GEMEINSAM<span>EINTEAM</span></footer>
    </div>
  </div>;
}
