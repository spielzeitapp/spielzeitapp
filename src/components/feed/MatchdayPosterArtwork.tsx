import React from 'react';
import { FeedClubName } from './FeedClubName';

const PLACEHOLDER =
  (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/logos/placeholder-shield-a.png';

/** Primäres Poster-Asset — Datei unter public/feed/ ablegen, gleicher Name. */
export const MATCHDAY_POSTER_BG_ASSET = 'feed/matchday-stadium-smoke-bg.png';

/** Fallback bis das dedizierte Poster-PNG vorliegt. */
export const MATCHDAY_POSTER_BG_FALLBACK = 'intro/welcome-hero.png';

function posterAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

export const MATCHDAY_POSTER_BG_URL = posterAssetUrl(MATCHDAY_POSTER_BG_ASSET);
export const MATCHDAY_POSTER_BG_FALLBACK_URL = posterAssetUrl(MATCHDAY_POSTER_BG_FALLBACK);

export type MatchdayPosterArtworkProps = {
  statusLabel: string;
  title: string;
  homeTeamName: string;
  awayTeamName: string;
  homeLogoUrl: string;
  awayLogoUrl: string;
  kickoffTime: string;
  meetingTime?: string | null;
  location?: string | null;
  competitionLabel?: string | null;
  isHomeGame?: boolean;
  hashtag?: string;
  /** LIVE/Endstand: ersetzt die Anpfiff-Zeile */
  heroOverride?: { main: string; suffix?: string | null; livePulse?: boolean };
  showAnpfiffLabel?: boolean;
  statusBadge?: string | null;
  compact?: boolean;
};

function PosterLogo({ src, alt, compact }: { src: string; alt: string; compact?: boolean }) {
  const [imgSrc, setImgSrc] = React.useState(src || PLACEHOLDER);
  React.useEffect(() => {
    setImgSrc(src || PLACEHOLDER);
  }, [src]);

  const ring = compact
    ? 'h-[4.75rem] w-[4.75rem] sm:h-[5.5rem] sm:w-[5.5rem]'
    : 'h-[5.25rem] w-[5.25rem] sm:h-[6.25rem] sm:w-[6.25rem]';
  const img = compact
    ? 'h-[3.85rem] w-[3.85rem] sm:h-[4.5rem] sm:w-[4.5rem]'
    : 'h-[4.25rem] w-[4.25rem] sm:h-[5.15rem] sm:w-[5.15rem]';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-white/18 bg-black/35 shadow-[0_8px_24px_rgba(0,0,0,0.55)] ${ring}`}
    >
      <img
        src={imgSrc}
        alt={alt}
        className={`object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)] ${img}`}
        loading="lazy"
        onError={() => {
          if (!imgSrc.endsWith('/logos/placeholder-shield-a.png')) setImgSrc(PLACEHOLDER);
        }}
      />
    </div>
  );
}

/** Asset-first: fixes Stadium/Smoke/Grunge-PNG, nur leichte Lesbarkeits-Overlays. */
function PosterAssetBackground() {
  const [bgSrc, setBgSrc] = React.useState(MATCHDAY_POSTER_BG_URL);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      <img
        src={bgSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        onError={() => {
          if (bgSrc !== MATCHDAY_POSTER_BG_FALLBACK_URL) setBgSrc(MATCHDAY_POSTER_BG_FALLBACK_URL);
        }}
      />
      {/* Nur Lesbarkeit — Hintergrund bleibt sichtbar */}
      <div className="absolute inset-0 bg-black/18" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/62" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_45%,transparent_35%,rgba(0,0,0,0.28)_100%)]" />
    </div>
  );
}

function formatKickoffHero(kickoffTime: string): { main: string; suffix: string | null } {
  const time = kickoffTime.replace(/\s*uhr\s*$/i, '').trim() || '—';
  return { main: time, suffix: 'UHR' };
}

const TITLE_SHADOW = '0 2px 18px rgba(0,0,0,0.75), 0 0 40px rgba(0,0,0,0.35)';

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
      meetingTime = null,
      location = null,
      competitionLabel = null,
      isHomeGame,
      hashtag = '#GEMEINSAMEINTEAM',
      heroOverride,
      showAnpfiffLabel = true,
      statusBadge = null,
      compact = false,
    },
    ref,
  ) {
    const parsedKickoff = formatKickoffHero(kickoffTime);
    const kickoff = heroOverride ?? {
      main: parsedKickoff.main,
      suffix: parsedKickoff.suffix,
      livePulse: false,
    };
    const venueLine = isHomeGame === true ? 'Heimspiel' : isHomeGame === false ? 'Auswärtsspiel' : null;
    const padX = compact ? 'px-2.5' : 'px-3.5 sm:px-4';
    const padY = compact ? 'py-3.5' : 'py-4 sm:py-5';

    const titleClass = compact
      ? 'text-[clamp(2.1rem,13.5vw,3.25rem)] font-black uppercase leading-[0.88] tracking-[0.08em]'
      : 'text-[clamp(2.35rem,14.5vw,3.75rem)] font-black uppercase leading-[0.86] tracking-[0.1em]';

    const kickoffClass = compact
      ? 'text-[clamp(2.1rem,11.5vw,2.85rem)]'
      : 'text-[clamp(2.35rem,12.5vw,3.25rem)]';

    return (
      <div
        ref={ref}
        className={`relative aspect-[4/5] w-full overflow-hidden rounded-[inherit] ${padX} ${padY}`}
      >
        <PosterAssetBackground />

        <div className="relative z-[1] flex h-full min-h-0 flex-col items-center justify-between text-center">
          {/* Kopf */}
          <div className="w-full shrink-0 space-y-1 sm:space-y-1.5">
            <p className="text-[7px] font-bold uppercase tracking-[0.32em] text-red-200/90 sm:text-[8px] sm:tracking-[0.36em]">
              {statusLabel}
            </p>
            <h2
              className={`${titleClass} text-white`}
              style={{ textShadow: TITLE_SHADOW }}
            >
              {title}
            </h2>
            {venueLine ? (
              <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/55 sm:text-[9px]">
                {venueLine}
              </p>
            ) : null}
            {competitionLabel ? (
              <div className="flex justify-center pt-0.5">
                <span className="inline-flex max-w-[92%] items-center justify-center rounded-full border border-white/16 bg-black/42 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-white/82 backdrop-blur-[2px] sm:max-w-full sm:px-2.5 sm:text-[8px]">
                  {competitionLabel}
                </span>
              </div>
            ) : null}
          </div>

          {/* Duell */}
          <div className="flex w-full shrink-0 items-center justify-between gap-0">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:gap-1.5">
              <PosterLogo src={homeLogoUrl} alt={homeTeamName} compact={compact} />
              <FeedClubName fullName={homeTeamName} variant="poster" className="w-full px-0.5" />
            </div>

            <div className="flex shrink-0 flex-col items-center justify-center self-stretch px-0.5 sm:px-1">
              <div
                className="mb-1 h-10 w-px bg-gradient-to-b from-transparent via-white/28 to-transparent sm:mb-1.5 sm:h-12"
                aria-hidden
              />
              <span
                className="text-sm font-bold uppercase tracking-[0.12em] text-white/55 sm:text-base"
                style={{ textShadow: '0 2px 12px rgba(0,0,0,0.65)' }}
              >
                VS
              </span>
              <div
                className="mt-1 h-10 w-px bg-gradient-to-b from-transparent via-white/28 to-transparent sm:mt-1.5 sm:h-12"
                aria-hidden
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:gap-1.5">
              <PosterLogo src={awayLogoUrl} alt={awayTeamName} compact={compact} />
              <FeedClubName fullName={awayTeamName} variant="poster" className="w-full px-0.5" />
            </div>
          </div>

          {/* Anpfiff */}
          <div className="w-full shrink-0 space-y-0.5">
            {showAnpfiffLabel && !heroOverride ? (
              <p className="text-[7px] font-bold uppercase tracking-[0.24em] text-white/52 sm:text-[8px]">
                Anpfiff
              </p>
            ) : null}
            <p
              className={
                kickoff.livePulse
                  ? `${kickoffClass} font-black uppercase leading-none tracking-[0.04em] text-red-300 motion-safe:animate-pulse`
                  : `${kickoffClass} font-extrabold tabular-nums leading-none tracking-tight text-white`
              }
              style={{ textShadow: TITLE_SHADOW }}
            >
              {kickoff.main}
            </p>
            {kickoff.suffix ? (
              <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/45 sm:text-[9px]">
                {kickoff.suffix}
              </p>
            ) : null}
          </div>

          {/* Fuß */}
          <div className="w-full shrink-0 space-y-1.5 sm:space-y-2">
            <div className="space-y-0.5">
              {meetingTime ? (
                <p className="text-[8px] leading-snug text-white/50 sm:text-[9px]">Treffpunkt {meetingTime}</p>
              ) : null}
              {location && location !== '—' ? (
                <p className="text-[8px] font-medium leading-snug text-white/55 sm:text-[9px]">{location}</p>
              ) : null}
            </div>

            {statusBadge ? (
              <div
                className={
                  kickoff.livePulse
                    ? 'mx-auto inline-flex min-h-[1.65rem] max-w-full items-center justify-center rounded-full border border-white/20 bg-black/50 px-2.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm sm:text-[8px] [animation-duration:1.5s] motion-safe:animate-pulse'
                    : 'mx-auto inline-flex min-h-[1.65rem] max-w-full items-center justify-center rounded-full border border-white/18 bg-black/45 px-2.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-white/88 backdrop-blur-sm sm:text-[8px]'
                }
              >
                <span className="truncate">{statusBadge}</span>
              </div>
            ) : null}

            <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-white/42 sm:text-[10px] sm:tracking-[0.3em]">
              {hashtag}
            </p>
          </div>
        </div>
      </div>
    );
  },
);

MatchdayPosterArtwork.displayName = 'MatchdayPosterArtwork';
