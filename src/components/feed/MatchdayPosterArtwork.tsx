import React from 'react';
import { Clock, MapPin, Trophy } from 'lucide-react';
import './squadPoster.css';

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
      className="matchday-poster-logo shrink-0 object-contain"
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
        className="matchday-poster-player absolute object-contain object-bottom object-right"
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
      <div className="sz-club-feed-poster-lines absolute inset-0" />
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
      <p className="mt-1 min-h-[2em] w-full break-words text-center text-[clamp(0.5rem,2.5cqw,0.86rem)] font-black uppercase leading-[1.08] tracking-[-0.01em] text-white">
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

    return (
      <div ref={ref} className="matchday-poster relative aspect-[4/5] w-full overflow-hidden rounded-[inherit] bg-black text-white [container-type:inline-size]">
        <GraphicBackground />
        {playerUrl ? <PosterPlayerLayer playerImageUrl={playerUrl} /> : null}

        <div className="relative z-[2] flex h-full flex-col px-[6%] pb-[4%] pt-[4.5%]">
          <header className="shrink-0">
            <p className="mb-1 text-[clamp(0.38rem,1.7cqw,0.55rem)] font-bold uppercase tracking-[0.25em] text-white/80">
              {statusLabel}
            </p>
            <h2
              className="whitespace-nowrap text-[clamp(2rem,14cqw,5rem)] font-black uppercase leading-[0.9] tracking-[-0.055em] text-white"
              style={{ fontFamily: "'Squad Anton', Impact, sans-serif", fontWeight: 400, textShadow: '0 6px 24px rgba(0,0,0,0.82)' }}
            >
              {title}
            </h2>
            <div className="mt-[2%] flex w-[52%] items-center gap-2">
              <div className="sz-club-feed-accent-line h-[3px] flex-1" />
              {ageGroup ? (
                <span className="sz-club-feed-accent-text text-[clamp(1.2rem,6cqw,2.25rem)] font-black uppercase leading-none tracking-[-0.04em]">
                  {ageGroup}
                </span>
              ) : null}
              <div className="sz-club-feed-accent-line h-[3px] flex-1" />
            </div>
          </header>

          <div className="mt-[4%] flex w-[59%] shrink-0 items-start gap-1 py-1">
            <TeamMark name={homeTeamName} logoUrl={homeLogoUrl} />
            <div className="flex w-[12%] shrink-0 flex-col items-center pt-[5%]">
              <div className="sz-club-feed-accent-line h-[5cqw] w-[2px] rotate-[28deg]" />
              <span className="sz-club-feed-accent-text my-0.5 text-[clamp(0.9rem,5cqw,1.9rem)] font-black uppercase leading-none">VS</span>
              <div className="sz-club-feed-accent-line h-[5cqw] w-[2px] rotate-[28deg]" />
            </div>
            <TeamMark name={awayTeamName} logoUrl={awayLogoUrl} />
          </div>

          <div className="mt-auto w-[58%] space-y-[1.4cqw]">
            {competition ? (
              <div className="flex items-center gap-1.5 text-[clamp(0.45rem,2cqw,0.62rem)] font-bold uppercase tracking-[0.08em] text-white/80">
                <Trophy className="sz-club-feed-accent-text h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                <span className="line-clamp-2 leading-tight">{competition}</span>
              </div>
            ) : null}
            {venueLine ? <p className="sz-club-feed-accent-text text-[clamp(0.5rem,2.3cqw,0.7rem)] font-black tracking-[0.12em]">{venueLine}</p> : null}
            {matchDate ? (
              <div className="sz-club-feed-accent-border border-y-2 py-[1cqw]">
                <p className="text-[clamp(1rem,5.5cqw,1.7rem)] font-black tabular-nums uppercase leading-none tracking-[-0.035em]">{matchDate}</p>
              </div>
            ) : null}
            <div className={matchDate ? '' : 'sz-club-feed-accent-border border-y-2 py-[1cqw]'}>
              <p className="flex items-baseline gap-1 text-[clamp(1.1rem,5.8cqw,1.8rem)] font-black tabular-nums uppercase leading-none tracking-[-0.035em]">
                {heroOverride?.main ?? kickoff}
                {heroSuffix ? (
                  <span className="text-[0.42em] tracking-[0.04em] text-white/76">{heroSuffix}</span>
                ) : null}
              </p>
            </div>
            {location && location !== '—' ? (
              <div>
                <div className="sz-club-feed-accent-text mb-0.5 flex items-center gap-1 text-[clamp(0.45rem,2cqw,0.6rem)] font-black uppercase tracking-[0.12em]">
                  <MapPin className="h-3 w-3" strokeWidth={2.5} aria-hidden /> ORT
                </div>
                <p className="line-clamp-2 text-[clamp(0.62rem,3cqw,0.92rem)] font-black uppercase leading-[1.08] text-white">{location}</p>
              </div>
            ) : null}
            {meetingTime ? (
              <div className="flex items-center gap-1 text-[clamp(0.45rem,2cqw,0.6rem)] font-bold uppercase tracking-[0.08em] text-white/80">
                <Clock className="sz-club-feed-accent-text h-3 w-3" strokeWidth={2.5} aria-hidden /> Treffpunkt {meetingTime}
              </div>
            ) : null}
            {statusBadge ? <p className="sz-club-feed-accent-text font-black uppercase tracking-[0.16em]">{statusBadge}</p> : null}
          </div>

          <footer className="relative z-[3] mt-[3%] shrink-0">
            <p
              className="whitespace-nowrap text-center text-[clamp(0.9rem,4.7cqw,2rem)] font-black italic uppercase leading-none tracking-[-0.045em]"
              style={{ textShadow: '0 4px 14px rgba(0,0,0,0.95)' }}
            >
              <span className="text-white">#{teamPrefix}</span><span className="sz-club-feed-accent-text">{teamSuffix}</span>
            </p>
            <div className="sz-club-feed-accent-fade mt-[1%] h-[2px] w-full" />
          </footer>
        </div>
      </div>
    );
  },
);

MatchdayPosterArtwork.displayName = 'MatchdayPosterArtwork';
