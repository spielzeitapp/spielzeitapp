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

const TITLE_SHADOW = '0 2px 14px rgba(0,0,0,0.72), 0 0 22px rgba(0,0,0,0.28)';
const KICKOFF_SHADOW =
  '0 3px 22px rgba(0,0,0,0.82), 0 0 36px rgba(220,38,38,0.14), 1px 1px 0 rgba(0,0,0,0.35)';
const VS_LIGHTNING =
  'linear-gradient(180deg, transparent 0%, rgba(248,113,113,0.18) 14%, rgba(220,38,38,0.92) 50%, rgba(248,113,113,0.18) 86%, transparent 100%)';

function PosterLogo({ src, alt, compact }: { src: string; alt: string; compact?: boolean }) {
  const [imgSrc, setImgSrc] = React.useState(src || PLACEHOLDER);
  React.useEffect(() => {
    setImgSrc(src || PLACEHOLDER);
  }, [src]);

  const ring = compact
    ? 'h-[5.85rem] w-[5.85rem] sm:h-[6.75rem] sm:w-[6.75rem]'
    : 'h-[6.5rem] w-[6.5rem] sm:h-[7.75rem] sm:w-[7.75rem]';
  const img = compact
    ? 'h-[4.75rem] w-[4.75rem] sm:h-[5.5rem] sm:w-[5.5rem]'
    : 'h-[5.3rem] w-[5.3rem] sm:h-[6.35rem] sm:w-[6.35rem]';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-red-500/42 bg-black/30 shadow-[0_0_0_1px_rgba(220,38,38,0.32),0_0_32px_rgba(185,28,28,0.32),0_10px_28px_rgba(0,0,0,0.52)] ${ring}`}
    >
      <img
        src={imgSrc}
        alt={alt}
        className={`object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.58)] ${img}`}
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
      <div className="absolute inset-0 bg-black/14" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/42 via-black/8 to-black/48" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_45%,transparent_40%,rgba(0,0,0,0.22)_100%)]" />
    </div>
  );
}

function formatKickoffHero(kickoffTime: string): { main: string; suffix: string | null } {
  const time = kickoffTime.replace(/\s*uhr\s*$/i, '').trim() || '—';
  return { main: time, suffix: 'UHR' };
}

function VsLightningDivider() {
  return (
    <div
      className="h-11 w-[2px] sm:h-14"
      style={{ background: VS_LIGHTNING, boxShadow: '0 0 16px rgba(220,38,38,0.55)' }}
      aria-hidden
    />
  );
}

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
    const kickoffLine =
      kickoff.suffix && !heroOverride ? `${kickoff.main} ${kickoff.suffix}` : kickoff.main;
    const venueLine = isHomeGame === true ? 'Heimspiel' : isHomeGame === false ? 'Auswärtsspiel' : null;
    const padX = compact ? 'px-2' : 'px-3 sm:px-3.5';
    const padY = compact ? 'py-3' : 'py-3.5 sm:py-4';

    const titleClass = compact
      ? 'w-full max-w-full px-0.5 text-[clamp(2.45rem,15.5vw,3.55rem)] font-black uppercase leading-[0.8] tracking-[0.06em]'
      : 'w-full max-w-full px-0.5 text-[clamp(2.65rem,16.5vw,4.05rem)] font-black uppercase leading-[0.78] tracking-[0.08em]';

    const kickoffClass = compact
      ? 'text-[clamp(2.35rem,13.5vw,3.15rem)]'
      : 'text-[clamp(2.55rem,14.5vw,3.55rem)]';

    return (
      <div
        ref={ref}
        className={`relative aspect-[4/5] w-full overflow-hidden rounded-[inherit] ${padX} ${padY}`}
      >
        <PosterAssetBackground />

        <div className="relative z-[1] flex h-full min-h-0 flex-col items-center justify-between text-center">
          {/* Kopf */}
          <div className="w-full shrink-0 space-y-0.5 sm:space-y-1">
            <p className="text-[6px] font-semibold uppercase tracking-[0.34em] text-red-200/82 sm:text-[7px] sm:tracking-[0.38em]">
              {statusLabel}
            </p>
            <h2 className={`${titleClass} text-white`} style={{ textShadow: TITLE_SHADOW }}>
              {title}
            </h2>
            {venueLine ? (
              <p className="text-[7px] font-medium uppercase tracking-[0.18em] text-white/48 sm:text-[8px]">
                {venueLine}
              </p>
            ) : null}
            {competitionLabel ? (
              <div className="flex justify-center pt-0.5">
                <span className="inline-flex max-w-[94%] items-center justify-center rounded-full border border-white/14 bg-black/28 px-2 py-0.5 text-[6px] font-bold uppercase tracking-[0.13em] text-white/76 sm:max-w-full sm:px-2.5 sm:text-[7px]">
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
              <VsLightningDivider />
              <span
                className="my-1 text-base font-black uppercase tracking-[0.1em] text-white/72 sm:my-1.5 sm:text-lg"
                style={{ textShadow: '0 0 22px rgba(220,38,38,0.55), 0 2px 14px rgba(0,0,0,0.65)' }}
              >
                VS
              </span>
              <VsLightningDivider />
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:gap-1.5">
              <PosterLogo src={awayLogoUrl} alt={awayTeamName} compact={compact} />
              <FeedClubName fullName={awayTeamName} variant="poster" className="w-full px-0.5" />
            </div>
          </div>

          {/* Anpfiff — zweitgrößter Poster-Mittelpunkt */}
          <div className="w-full shrink-0 px-0.5">
            {showAnpfiffLabel && !heroOverride ? (
              <p className="text-[7px] font-bold uppercase tracking-[0.28em] text-white/55 sm:text-[8px]">
                Anpfiff
              </p>
            ) : null}
            <p
              className={
                kickoff.livePulse
                  ? `${kickoffClass} font-black uppercase leading-[0.92] tracking-[0.03em] text-red-300 motion-safe:animate-pulse`
                  : `${kickoffClass} font-extrabold tabular-nums leading-[0.92] tracking-tight text-white`
              }
              style={{ textShadow: KICKOFF_SHADOW }}
            >
              {kickoffLine}
            </p>
            {kickoff.suffix && heroOverride ? (
              <p className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.28em] text-white/42 sm:text-[8px]">
                {kickoff.suffix}
              </p>
            ) : null}
          </div>

          {/* Fuß — Zusatzinfos dezent */}
          <div className="w-full shrink-0">
            <div className="space-y-0.5">
              {meetingTime ? (
                <p className="text-[7px] leading-snug text-white/38 sm:text-[8px]">Treffpunkt {meetingTime}</p>
              ) : null}
              {location && location !== '—' ? (
                <p className="text-[7px] font-medium leading-snug text-white/42 sm:text-[8px]">{location}</p>
              ) : null}
            </div>

            {statusBadge ? (
              <div
                className={`mt-1.5 ${
                  kickoff.livePulse
                    ? 'mx-auto inline-flex min-h-[1.5rem] max-w-full items-center justify-center rounded-full border border-white/16 bg-black/32 px-2.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.12em] text-white sm:text-[7px] [animation-duration:1.5s] motion-safe:animate-pulse'
                    : 'mx-auto inline-flex min-h-[1.5rem] max-w-full items-center justify-center rounded-full border border-white/14 bg-black/28 px-2.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.14em] text-white/82 sm:text-[7px]'
                }`}
              >
                <span className="truncate">{statusBadge}</span>
              </div>
            ) : null}

            <div className="mt-4 sm:mt-5">
              <span
                className="relative inline-block text-[11px] font-black uppercase tracking-[0.24em] text-red-400 sm:text-[12px] sm:tracking-[0.28em]"
                style={{ textShadow: '0 0 18px rgba(220,38,38,0.35)' }}
              >
                {hashtag}
                <span
                  className="absolute -bottom-1 left-[6%] right-[6%] h-[2px] rounded-full opacity-90"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(220,38,38,0.25) 12%, rgba(248,113,113,0.85) 50%, rgba(220,38,38,0.25) 88%, transparent 100%)',
                    boxShadow: '0 0 10px rgba(220,38,38,0.4)',
                  }}
                  aria-hidden
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

MatchdayPosterArtwork.displayName = 'MatchdayPosterArtwork';
