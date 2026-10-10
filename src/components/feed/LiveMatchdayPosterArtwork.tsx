import React from 'react';
import './matchdayPoster.css';
import { Clock, MapPin, Trophy } from 'lucide-react';

const PLACEHOLDER =
  (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/logos/placeholder-shield-a.png';

/** Legacy-Exports für weitere Poster; die neue Spieltag-Grafik selbst nutzt kein Stadionbild mehr. */
export const MATCHDAY_POSTER_BG_ASSET = 'feed/matchday-stadium-smoke-bg.png';
export const MATCHDAY_POSTER_BG_FALLBACK = 'intro/welcome-hero.png';

function posterAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

export const MATCHDAY_POSTER_BG_URL = posterAssetUrl(MATCHDAY_POSTER_BG_ASSET);
export const MATCHDAY_POSTER_BG_FALLBACK_URL = posterAssetUrl(MATCHDAY_POSTER_BG_FALLBACK);

function PosterLogo({ src, alt }: { src: string; alt: string }) {
  const [imgSrc, setImgSrc] = React.useState(src || PLACEHOLDER);

  React.useEffect(() => {
    setImgSrc(src || PLACEHOLDER);
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className="h-[clamp(2.9rem,14vw,4.35rem)] w-[clamp(2.9rem,14vw,4.35rem)] shrink-0 object-contain sm:h-[5.15rem] sm:w-[5.15rem]"
      style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.72))' }}
      loading="lazy"
      onError={() => {
        if (!imgSrc.endsWith('/logos/placeholder-shield-a.png')) setImgSrc(PLACEHOLDER);
      }}
    />
  );
}

function PosterPlayerLayer({ playerImageUrl }: { playerImageUrl: string }) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [playerImageUrl]);

  if (failed) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]" aria-hidden>
      <div className="sz-club-feed-primary-glow absolute bottom-[-6%] right-[-18%] h-[74%] w-[72%] rounded-full blur-3xl" />
      <img
        src={playerImageUrl}
        alt=""
        className="absolute bottom-[9%] right-[-7%] h-[87%] w-[66%] object-contain object-bottom object-right"
        style={{ filter: 'drop-shadow(-12px 8px 24px rgba(0,0,0,0.9))' }}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function GraphicBackground() {
  return (
    <div className="sz-club-feed-poster-background pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] bg-[#050505]" aria-hidden>
      <img src={posterAssetUrl('feed/matchday-clean-background.jpg')} alt="" className="sz-matchday-reference-background absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_42%,transparent_42%,rgba(0,0,0,0.58)_100%)]" />
    </div>
  );
}

function splitCompetitionLabel(label: string | null): { ageGroup: string | null; competition: string | null } {
  if (!label) return { ageGroup: null, competition: null };
  const parts = label.split('·').map((part) => part.trim()).filter(Boolean);
  const ageGroup = parts.find((part) => /^U\d+/i.test(part)) ?? null;
  const competition = parts.filter((part) => part !== ageGroup).join(' · ') || null;
  return { ageGroup, competition };
}

function TeamMark({ name, logoUrl }: { name: string; logoUrl: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <PosterLogo src={logoUrl} alt={name} />
      <p className="mt-1 min-h-[2.25rem] w-full break-words text-center text-[clamp(0.56rem,2.5vw,0.86rem)] font-black uppercase leading-[1.08] tracking-[-0.01em] text-white">
        {name}
      </p>
    </div>
  );
}

export type MatchdayPosterArtworkProps = {
  statusLabel: string;
  title: string;
  homeTeamName: string;
  awayTeamName: string;
  homeLogoUrl: string;
  awayLogoUrl: string;
  kickoffTime: string;
  matchDate?: string | null;
  meetingTime?: string | null;
  location?: string | null;
  competitionLabel?: string | null;
  isHomeGame?: boolean;
  hashtag?: string;
  playerImageUrl?: string | null;
  heroOverride?: { main: string; suffix?: string | null; livePulse?: boolean };
  showAnpfiffLabel?: boolean;
  statusBadge?: string | null;
  compact?: boolean;
};

export const LiveMatchdayPosterArtwork = React.forwardRef<HTMLDivElement, MatchdayPosterArtworkProps>(
  function MatchdayPosterArtwork(
    {
      statusLabel,
      title,
      homeTeamName,
      awayTeamName,
      homeLogoUrl,
      awayLogoUrl,
      kickoffTime,
      matchDate = null,
      meetingTime = null,
      location = null,
      competitionLabel = null,
      isHomeGame,
      hashtag = '#GEMEINSAMEINTEAM',
      playerImageUrl = null,
      heroOverride,
      statusBadge = null,
    },
    ref,
  ) {
    const playerUrl = playerImageUrl?.trim() || null;
    const kickoff = kickoffTime.replace(/\s*uhr\s*$/i, '').trim() || '—';
    const venueLine = isHomeGame === true ? 'HEIMSPIEL' : isHomeGame === false ? 'AUSWÄRTSSPIEL' : null;
    const { ageGroup, competition } = splitCompetitionLabel(competitionLabel);
    const heroSuffix = heroOverride ? heroOverride.suffix : 'UHR';
    const cleanHashtag = hashtag.replace(/^#/, '');
    const teamSuffix = cleanHashtag.toUpperCase().endsWith('EINTEAM') ? 'EINTEAM' : '';
    const teamPrefix = teamSuffix ? cleanHashtag.slice(0, -teamSuffix.length) : cleanHashtag;

    // Centered matchday layout when no portrait has been selected. Container
    // units keep the feed and exported image identical at every screen width.
    if (!playerUrl) {
      const team = (name: string, logo: string) => (
        <div className="flex min-w-0 flex-1 flex-col items-center gap-[2cqw]">
          <div className="flex h-[28cqw] w-[28cqw] items-center justify-center">
            <img src={logo || PLACEHOLDER} alt={name} className="h-full w-full object-contain"
              onError={(e) => { if (!e.currentTarget.src.endsWith('/logos/placeholder-shield-a.png')) e.currentTarget.src = PLACEHOLDER; }} />
          </div>
          <p className="sz-matchday-display w-full break-words text-center text-[4.1cqw] font-extrabold uppercase leading-[1.12] tracking-tight">{name}</p>
        </div>
      );
      return (
        <div ref={ref} className="relative aspect-[4/5] w-full overflow-hidden rounded-[inherit] bg-black text-white" style={{ containerType: 'inline-size' }}>
          <GraphicBackground />
          <div className="relative z-[2] flex h-full flex-col items-center px-[6%] pb-[5%] pt-[6%] text-center">
            <header className="w-full">
              <div className="flex items-center justify-center gap-[2cqw]">
                <span className="sz-club-feed-accent-line h-[2px] min-w-[5cqw] flex-1" />
                <p className="text-[2.45cqw] font-bold uppercase leading-tight tracking-[0.15em]">
                  {competition || 'SPIELTAG'}
                </p>
                <span className="sz-club-feed-accent-line h-[2px] min-w-[5cqw] flex-1" />
              </div>
              <h2 className="sz-matchday-display mt-[3cqw] text-[21cqw] uppercase leading-none tracking-[-0.025em]">{title}</h2>
              {ageGroup ? (
                <div className="mt-[1.5cqw] flex items-center justify-center gap-[3cqw]">
                  <span className="sz-club-feed-accent-line h-[2px] w-[22%]" />
                  <span className="sz-matchday-display sz-club-feed-accent-text text-[9cqw] leading-none">{ageGroup}</span>
                  <span className="sz-club-feed-accent-line h-[2px] w-[22%]" />
                </div>
              ) : <div className="sz-club-feed-accent-line mx-auto mt-[2cqw] h-[3px] w-[88%]" />}
            </header>
            <div className="mt-[3cqw] flex w-full items-start gap-[3cqw]">
              {team(homeTeamName, homeLogoUrl)}
              <span className="sz-club-feed-accent-text mt-[9cqw] text-[6cqw] font-black italic leading-none">VS</span>
              {team(awayTeamName, awayLogoUrl)}
            </div>
            <div className="mt-[3cqw] w-full space-y-[2cqw]">
              <p className="sz-matchday-display text-[10cqw] font-black uppercase leading-none tracking-tight">
                {heroOverride?.main ?? kickoff}{heroSuffix ? <span className="ml-[2cqw] text-[0.65em]">{heroSuffix}</span> : null}
              </p>
              <div className="sz-club-feed-accent-line mx-auto h-[2px] w-[74%]" />
              {matchDate ? <p className="sz-matchday-display text-[3.7cqw] font-bold uppercase tracking-[0.12em]">{matchDate}</p> : null}
              {location && location !== '—' ? <p className="sz-matchday-display break-words text-[3cqw] font-bold uppercase leading-tight tracking-[0.1em]">{location}</p> : null}
              {meetingTime ? <p className="text-[2.4cqw] font-semibold uppercase tracking-wider text-white/75">Treffpunkt {meetingTime}</p> : null}
              {statusBadge ? <p className="sz-club-feed-accent-text text-[2.6cqw] font-bold uppercase">{statusBadge}</p> : null}
            </div>
            <footer className="mt-auto w-full pt-[3cqw]">
              <p className="sz-matchday-display text-[5cqw] font-black italic uppercase leading-tight tracking-tight">
                <span>#{teamPrefix}</span><span className="sz-club-feed-accent-text">{teamSuffix}</span>
              </p>
            </footer>
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className="relative aspect-[4/5] w-full overflow-hidden rounded-[inherit] bg-black text-white" style={{ containerType: 'inline-size' }}>
        <GraphicBackground />
        <PosterPlayerLayer playerImageUrl={playerUrl} />
        <div className="relative z-[2] flex h-full flex-col px-[6%] pb-[16%] pt-[6%]">
          <header className="w-[60%]">
            <p className="text-[2cqw] font-bold uppercase tracking-[0.18em]">{competition || statusLabel}</p>
            <h2 className="sz-matchday-display mt-[2cqw] text-[13cqw] uppercase leading-none tracking-[-0.025em]">{title}</h2>
            {ageGroup ? <div className="mt-[1.5cqw] flex items-center gap-[2cqw]">
              <span className="sz-club-feed-accent-line h-[2px] flex-1" />
              <span className="sz-matchday-display sz-club-feed-accent-text text-[7.5cqw] leading-none">{ageGroup}</span>
              <span className="sz-club-feed-accent-line h-[2px] flex-1" />
            </div> : null}
          </header>
          <div className="mt-[4cqw] flex w-[60%] items-start gap-[1cqw]">
            {[{ name: homeTeamName, logo: homeLogoUrl }, { name: awayTeamName, logo: awayLogoUrl }].map((team, i) => <React.Fragment key={i}>
              {i === 1 ? <span className="sz-matchday-display sz-club-feed-accent-text mt-[6cqw] text-[5cqw] italic">VS</span> : null}
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <img src={team.logo || PLACEHOLDER} alt={team.name} className="h-[18cqw] w-[18cqw] object-contain" onError={e => { if (!e.currentTarget.src.endsWith('/logos/placeholder-shield-a.png')) e.currentTarget.src = PLACEHOLDER; }} />
                <p className="sz-matchday-display mt-[1.5cqw] w-full text-center text-[2.9cqw] uppercase leading-[1.2]">{team.name}</p>
              </div>
            </React.Fragment>)}
          </div>
          <div className="mt-auto w-[52%] space-y-[2cqw] pt-[4cqw]">
            {venueLine ? <p className="sz-club-feed-accent-text text-[2cqw] font-bold tracking-[0.1em]">{venueLine}</p> : null}
            <p className="sz-matchday-display text-[7cqw] uppercase leading-none">
              {heroOverride?.main ?? kickoff}{heroSuffix ? <span className="ml-[1cqw] text-[0.6em]">{heroSuffix}</span> : null}
            </p>
            <div className="sz-club-feed-accent-line h-[2px] w-full" />
            {matchDate ? <p className="sz-matchday-display text-[4cqw] uppercase leading-tight">{matchDate}</p> : null}
            {location && location !== '—' ? <p className="sz-matchday-display text-[3cqw] uppercase leading-[1.2]">{location}</p> : null}
            {meetingTime ? <p className="text-[2cqw] font-semibold leading-tight">Treffpunkt {meetingTime}</p> : null}
            {statusBadge ? <p className="sz-club-feed-accent-text text-[2cqw] font-bold">{statusBadge}</p> : null}
          </div>
        </div>
        <footer className="absolute inset-x-[5%] bottom-[5%] z-[3]">
          <p className="sz-matchday-display text-center text-[5cqw] italic uppercase leading-none">
            <span>#{teamPrefix}</span><span className="sz-club-feed-accent-text">{teamSuffix}</span>
          </p>
        </footer>
      </div>
    );
  },
);

LiveMatchdayPosterArtwork.displayName = 'MatchdayPosterArtwork';
