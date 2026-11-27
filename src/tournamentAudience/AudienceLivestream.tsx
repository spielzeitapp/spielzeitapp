import React, {useState} from 'react';
import {Play} from 'lucide-react';
import type {PublicTeamTournamentPageDto} from '../lib/publicTeamTournament';
import {tournamentLivestreamEmbedUrl, tournamentLivestreamUrl} from '../../server/lib/tournamentLivestream.js';

export function AudienceLivestream({page}: {page: PublicTeamTournamentPageDto}) {
  const [opened, setOpened] = useState<string | null>(null);
  const stream = tournamentLivestreamUrl(page.livestreamUrl);
  const recording = page.livestreamIsRecording ?? page.tournamentStatus === 'finished';
  const parts = recording && page.recordingParts?.length
    ? page.recordingParts.map(url => tournamentLivestreamUrl(url)).filter((url): url is string => Boolean(url))
    : stream ? [stream] : [];
  if (!parts.length) return null;

  const selected = opened && parts.includes(opened) ? opened : null;
  const embed = tournamentLivestreamEmbedUrl(selected);
  return (
    <section className="audience-card audience-stream" aria-label={recording ? 'Turnieraufzeichnung' : 'Livestream'}>
      <h2>{recording ? 'Turnieraufzeichnung' : 'Livestream'}</h2>
      <div className="audience-stream-links">
        {parts.map((url, index) => (
          <a key={url} className="audience-secondary" href={url} target="_blank" rel="noopener noreferrer"
            onClick={event => {
              if (!tournamentLivestreamEmbedUrl(url) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              setOpened(url);
            }}>
            <Play size={18} aria-hidden/>
            {parts.length > 1 ? `Teil ${index + 1} ansehen` : recording ? 'Aufzeichnung ansehen' : 'Livestream ansehen'}
          </a>
        ))}
      </div>
      {embed ? <>
        <iframe className="audience-stream-player" src={embed} title={recording ? 'Turnieraufzeichnung' : 'Livestream'}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
        <div className="audience-stream-links">
          <a className="audience-secondary" href={selected!} target="_blank" rel="noopener noreferrer">Beim Anbieter öffnen ↗</a>
          <button type="button" className="audience-secondary" onClick={() => setOpened(null)}>Player schließen</button>
        </div>
      </> : null}
    </section>
  );
}
