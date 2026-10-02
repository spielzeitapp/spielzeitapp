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

export const MatchdayPosterArtwork = React.forwardRef<HTMLDivElement, MatchdayPosterArtworkProps>(
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
        {playerUrl ? <PosterPlayerLayer playerImageUrl={playerUrl} /> : null}

        <div className="relative z-[2] flex h-full flex-col px-[6%] pb-[4.5%] pt-[4.5%]">
          <header className="shrink-0">
            <p className="mb-1 text-[clamp(0.38rem,1.9vw,0.55rem)] font-bold uppercase tracking-[0.36em] text-white/64">
              {statusLabel}
            </p>
            <h2
              className="sz-matchday-display whitespace-nowrap text-[14cqw] uppercase leading-none tracking-[-0.025em] text-white"
              style={{ textShadow: '0 6px 24px rgba(0,0,0,0.82)' }}
            >
              {title}
            </h2>
            <div className="mt-2 flex w-[50%] items-center gap-3">
              <div className="sz-club-feed-accent-line h-[3px] flex-1" />
              {ageGroup ? (
                <span className="sz-matchday-display sz-club-feed-accent-text text-[8cqw] uppercase leading-none tracking-[-0.025em]">
                  {ageGroup}
                </span>
              ) : null}
              <div className="sz-club-feed-accent-line h-[3px] flex-1" />
            </div>
          </header>

          <div className="mt-[4%] flex w-[62%] shrink-0 items-start gap-1 px-1 py-1">
            <TeamMark name={homeTeamName} logoUrl={homeLogoUrl} />
            <div className="flex w-8 shrink-0 flex-col items-center pt-3 sm:w-11 sm:pt-5">
              <div className="sz-club-feed-accent-line h-8 w-[2px] rotate-[28deg]" />
              <span className="sz-club-feed-accent-text my-0.5 text-[clamp(1.3rem,6.5vw,1.9rem)] font-black uppercase leading-none">VS</span>
              <div className="sz-club-feed-accent-line h-8 w-[2px] rotate-[28deg]" />
            </div>
            <TeamMark name={awayTeamName} logoUrl={awayLogoUrl} />
          </div>

          <div className="mt-auto mb-[15%] w-[52%] space-y-[2cqw]">
            {competition ? (
              <div className="flex items-center gap-1.5 text-[clamp(0.46rem,2.2vw,0.62rem)] font-bold uppercase tracking-[0.11em] text-white/64">
                <Trophy className="sz-club-feed-accent-text h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                <span className="line-clamp-2 leading-tight">{competition}</span>
              </div>
            ) : null}
            {venueLine ? <p className="sz-club-feed-accent-text text-[clamp(0.52rem,2.5vw,0.7rem)] font-black tracking-[0.15em]">{venueLine}</p> : null}
            {matchDate ? (
              <div className="sz-club-feed-accent-border border-y-2 py-1.5">
                <p className="sz-matchday-display text-[4.8cqw] tabular-nums uppercase leading-none">{matchDate}</p>
              </div>
            ) : null}
            <div className={matchDate ? '' : 'sz-club-feed-accent-border border-y-2 py-1.5'}>
              <p className="sz-matchday-display flex items-baseline gap-1 text-[6cqw] tabular-nums uppercase leading-none">
                {heroOverride?.main ?? kickoff}
                {heroSuffix ? (
                  <span className="text-[0.42em] tracking-[0.04em] text-white/76">{heroSuffix}</span>
                ) : null}
              </p>
            </div>
            {location && location !== '—' ? (
              <div>
                <div className="sz-club-feed-accent-text mb-0.5 flex items-center gap-1 text-[clamp(0.45rem,2.1vw,0.6rem)] font-black uppercase tracking-[0.16em]">
                  <MapPin className="h-3 w-3" strokeWidth={2.5} aria-hidden /> ORT
                </div>
                <p className="sz-matchday-display text-[3.3cqw] uppercase leading-[1.15] text-white">{location}</p>
              </div>
            ) : null}
            {meetingTime ? (
              <div className="flex items-center gap-1 text-[clamp(0.45rem,2.1vw,0.6rem)] font-bold uppercase tracking-[0.11em] text-white/62">
                <Clock className="sz-club-feed-accent-text h-3 w-3" strokeWidth={2.5} aria-hidden /> Treffpunkt {meetingTime}
              </div>
            ) : null}
            {statusBadge ? <p className="sz-club-feed-accent-text font-black uppercase tracking-[0.16em]">{statusBadge}</p> : null}
          </div>

          <footer className="absolute inset-x-[4%] bottom-[3.2%] z-[3]">
            <p
              className="sz-matchday-display whitespace-nowrap text-center text-[5cqw] italic uppercase leading-none tracking-[-0.025em]"
              style={{ textShadow: '0 4px 14px rgba(0,0,0,0.95)' }}
            >
              <span className="text-white">#{teamPrefix}</span><span className="sz-club-feed-accent-text">{teamSuffix}</span>
            </p>
            <div className="sz-club-feed-accent-fade mt-1.5 h-[3px] w-full" />
          </footer>
        </div>
      </div>
    );
  },
);

MatchdayPosterArtwork.displayName = 'MatchdayPosterArtwork';
