import React from 'react';
import { Clock, MapPin } from 'lucide-react';
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

const TITLE_SHADOW =
  '0 0 40px rgba(220,38,38,0.28), 0 4px 22px rgba(0,0,0,0.88), 0 2px 0 rgba(0,0,0,0.55), 2px 2px 8px rgba(0,0,0,0.45)';
const KICKOFF_SHADOW =
  '0 3px 24px rgba(0,0,0,0.88), 0 0 40px rgba(220,38,38,0.18), 1px 1px 0 rgba(0,0,0,0.4)';
const VS_LIGHTNING =
  'linear-gradient(180deg, transparent 0%, rgba(248,113,113,0.22) 12%, rgba(220,38,38,0.95) 50%, rgba(248,113,113,0.22) 88%, transparent 100%)';

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
      className={`flex shrink-0 items-center justify-center rounded-full border border-red-600/55 bg-[#0a0404]/72 shadow-[inset_0_0_22px_rgba(0,0,0,0.72),inset_0_2px_8px_rgba(0,0,0,0.45),0_0_0_1px_rgba(220,38,38,0.38),0_0_36px_rgba(185,28,28,0.36),0_12px_30px_rgba(0,0,0,0.55)] ${ring}`}
    >
      <img
        src={imgSrc}
        alt={alt}
        className={`object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.62)] ${img}`}
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

function VsLightningDivider({ tall }: { tall?: boolean }) {
  return (
    <div
      className={tall ? 'h-12 w-[3px] sm:h-[4.5rem]' : 'h-10 w-[3px] sm:h-12'}
      style={{ background: VS_LIGHTNING, boxShadow: '0 0 20px rgba(220,38,38,0.62)' }}
      aria-hidden
    />
  );
}

function PosterMetaColumn({
  icon: Icon,
  label,
  value,
  align,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  align: 'left' | 'right';
}) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div
        className={`mb-0.5 flex items-center gap-0.5 text-[6px] font-bold uppercase tracking-[0.14em] text-red-400/92 sm:text-[7px] ${
          align === 'right' ? 'justify-end' : 'justify-start'
        }`}
      >
        <Icon className="h-2.5 w-2.5 shrink-0 sm:h-[11px] sm:w-[11px]" strokeWidth={2.5} aria-hidden />
        <span>{label}</span>
      </div>
      <p
        className={`text-[7px] font-semibold leading-snug text-white/68 sm:text-[8px] ${
          align === 'right' ? 'line-clamp-2 break-words' : 'truncate'
        }`}
      >
        {value}
      </p>
    </div>
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
    const venueLine = isHomeGame === true ? 'Heimspiel' : isHomeGame === false ? 'Auswärtsspiel' : null;
    const padX = compact ? 'px-2' : 'px-3 sm:px-3.5';
    const padY = compact ? 'py-3 pb-3.5' : 'py-3.5 pb-4 sm:py-4 sm:pb-5';
    const showMetaRow = Boolean(meetingTime) || Boolean(location && location !== '—');

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
            <h2
              className={`${titleClass} text-white [paint-order:stroke_fill]`}
              style={{
                textShadow: TITLE_SHADOW,
                WebkitTextStroke: '0.6px rgba(0,0,0,0.42)',
              }}
            >
              {title}
            </h2>
            <div
              className="mx-auto mt-0.5 h-[3px] w-[min(78%,14rem)] rounded-full opacity-95"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(127,29,29,0.35) 8%, rgba(220,38,38,0.82) 50%, rgba(127,29,29,0.35) 92%, transparent 100%)',
                boxShadow: '0 0 14px rgba(220,38,38,0.42)',
              }}
              aria-hidden
            />
            {venueLine ? (
              <p className="pt-0.5 text-[7px] font-medium uppercase tracking-[0.18em] text-white/48 sm:text-[8px]">
                {venueLine}
              </p>
            ) : null}
            {competitionLabel ? (
              <div className="flex justify-center pt-0.5">
                <span className="inline-flex max-w-[94%] items-center justify-center rounded-full border border-red-500/22 bg-black/28 px-2 py-0.5 text-[6px] font-bold uppercase tracking-[0.13em] text-white/76 sm:max-w-full sm:px-2.5 sm:text-[7px]">
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

            <div className="relative flex shrink-0 flex-col items-center justify-center self-stretch px-1 sm:px-1.5">
              <div
                className="pointer-events-none absolute inset-y-1 left-1/2 z-0 w-[3px] -translate-x-1/2 sm:inset-y-0.5"
                style={{ background: VS_LIGHTNING, boxShadow: '0 0 24px rgba(220,38,38,0.65)' }}
                aria-hidden
              />
              <div className="relative z-[1] flex flex-col items-center">
                <VsLightningDivider />
                <span
                  className="my-1 text-lg font-black uppercase tracking-[0.08em] text-white sm:my-1.5 sm:text-xl"
                  style={{
                    textShadow:
                      '0 0 28px rgba(220,38,38,0.62), 0 0 12px rgba(255,255,255,0.35), 0 3px 16px rgba(0,0,0,0.75)',
                  }}
                >
                  VS
                </span>
                <VsLightningDivider />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 sm:gap-1.5">
              <PosterLogo src={awayLogoUrl} alt={awayTeamName} compact={compact} />
              <FeedClubName fullName={awayTeamName} variant="poster" className="w-full px-0.5" />
            </div>
          </div>

          {/* Anpfiff */}
          <div className="w-full shrink-0 px-0.5">
            {showAnpfiffLabel && !heroOverride ? (
              <div className="mb-0.5 flex items-center justify-center gap-1">
                <Clock className="h-2.5 w-2.5 text-red-400/95 sm:h-3 sm:w-3" strokeWidth={2.5} aria-hidden />
                <p className="text-[7px] font-bold uppercase tracking-[0.28em] text-red-100/92 sm:text-[8px]">
                  Anpfiff
                </p>
              </div>
            ) : null}
            {heroOverride ? (
              <p
                className={
                  kickoff.livePulse
                    ? `${kickoffClass} font-black uppercase leading-[0.92] tracking-[0.03em] text-red-300 motion-safe:animate-pulse`
                    : `${kickoffClass} font-extrabold tabular-nums leading-[0.92] tracking-tight text-white`
                }
                style={{ textShadow: KICKOFF_SHADOW }}
              >
                {kickoff.main}
              </p>
            ) : (
              <div className="flex items-baseline justify-center gap-1 sm:gap-1.5">
                <span
                  className={`${kickoffClass} font-extrabold tabular-nums leading-none tracking-tight text-white`}
                  style={{ textShadow: KICKOFF_SHADOW }}
                >
                  {kickoff.main}
                </span>
                {kickoff.suffix ? (
                  <span className="text-[0.34em] font-black uppercase tracking-[0.14em] text-white/78 sm:tracking-[0.18em]">
                    {kickoff.suffix}
                  </span>
                ) : null}
              </div>
            )}
            {kickoff.suffix && heroOverride ? (
              <p className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.28em] text-white/42 sm:text-[8px]">
                {kickoff.suffix}
              </p>
            ) : null}
          </div>

          {/* Fuß */}
          <div className="w-full shrink-0">
            {showMetaRow ? (
              <div
                className={`grid w-full gap-x-2 gap-y-1 px-0.5 ${
                  meetingTime && location && location !== '—' ? 'grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {meetingTime ? (
                  <PosterMetaColumn icon={Clock} label="Treffpunkt" value={meetingTime} align="left" />
                ) : null}
                {location && location !== '—' ? (
                  <PosterMetaColumn
                    icon={MapPin}
                    label="Ort"
                    value={location}
                    align={meetingTime ? 'right' : 'left'}
                  />
                ) : null}
              </div>
            ) : null}

            {statusBadge ? (
              <div
                className={`${showMetaRow ? 'mt-1.5' : ''} ${
                  kickoff.livePulse
                    ? 'mx-auto inline-flex min-h-[1.5rem] max-w-full items-center justify-center rounded-full border border-red-500/28 bg-black/32 px-2.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.12em] text-white sm:text-[7px] [animation-duration:1.5s] motion-safe:animate-pulse'
                    : 'mx-auto inline-flex min-h-[1.5rem] max-w-full items-center justify-center rounded-full border border-red-500/22 bg-black/28 px-2.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.14em] text-white/82 sm:text-[7px]'
                }`}
              >
                <span className="truncate">{statusBadge}</span>
              </div>
            ) : null}

            <div className="mt-3.5 pb-0.5 sm:mt-4">
              <span
                className="relative inline-block text-[12px] font-black uppercase tracking-[0.22em] text-red-400 sm:text-[14px] sm:tracking-[0.26em]"
                style={{
                  textShadow:
                    '0 0 28px rgba(220,38,38,0.55), 0 0 12px rgba(248,113,113,0.35), 0 2px 14px rgba(0,0,0,0.55)',
                }}
              >
                {hashtag}
                <span
                  className="absolute -bottom-1.5 left-[4%] right-[4%] h-[3px] rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(127,29,29,0.4) 6%, rgba(248,113,113,0.95) 50%, rgba(127,29,29,0.4) 94%, transparent 100%)',
                    boxShadow: '0 0 16px rgba(220,38,38,0.55), 0 2px 8px rgba(185,28,28,0.35)',
                  }}
                  aria-hidden
                />
                <span
                  className="absolute -bottom-2.5 left-[18%] right-[18%] h-[1px] rounded-full opacity-70"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(220,38,38,0.65), transparent)',
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
