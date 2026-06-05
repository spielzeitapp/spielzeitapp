import React from 'react';
import { FeedClubName } from './FeedClubName';

const PLACEHOLDER =
  (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/logos/placeholder-shield-a.png';

const STADIUM_BG_URL = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

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

function PosterLogo({ src, alt }: { src: string; alt: string }) {
  const [imgSrc, setImgSrc] = React.useState(src || PLACEHOLDER);
  React.useEffect(() => {
    setImgSrc(src || PLACEHOLDER);
  }, [src]);

  return (
    <div className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-full border border-red-500/45 bg-black/40 shadow-[0_0_0_1px_rgba(220,38,38,0.3),0_14px_36px_rgba(0,0,0,0.6),0_0_48px_rgba(185,28,28,0.15)] sm:h-[6.75rem] sm:w-[6.75rem]">
      <img
        src={imgSrc}
        alt={alt}
        className="h-[4.5rem] w-[4.5rem] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] sm:h-[5.65rem] sm:w-[5.65rem]"
        loading="lazy"
        onError={() => {
          if (!imgSrc.endsWith('/logos/placeholder-shield-a.png')) setImgSrc(PLACEHOLDER);
        }}
      />
    </div>
  );
}

function PosterBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      <img
        src={STADIUM_BG_URL}
        alt=""
        className="absolute inset-0 h-full w-full scale-[1.14] object-cover object-[center_24%] opacity-[0.34] brightness-[0.42] saturate-[0.88] contrast-[1.08]"
      />
      <div className="absolute inset-0 bg-black/62" />
      <div className="absolute inset-0 backdrop-blur-[1.5px] bg-black/10" />
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'linear-gradient(145deg, transparent 18%, rgba(127,29,29,0.22) 42%, rgba(69,10,10,0.14) 58%, transparent 82%)',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_0%_42%,rgba(255,235,210,0.18)_0%,rgba(153,27,27,0.22)_32%,transparent_68%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_100%_42%,rgba(255,235,210,0.18)_0%,rgba(153,27,27,0.22)_32%,transparent_68%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-12%,rgba(248,113,113,0.2),transparent_58%)]" />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 90% 40% at 50% 88%, rgba(40,8,8,0.55) 0%, rgba(20,4,4,0.35) 40%, transparent 72%)',
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_24%,rgba(0,0,0,0.35)_78%,rgba(0,0,0,0.55)_100%)]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(12,8,10,0.55) 0%, rgba(8,4,6,0.72) 50%, rgba(6,2,4,0.88) 100%)',
        }}
      />
    </div>
  );
}

function formatKickoffHero(kickoffTime: string): { main: string; suffix: string | null } {
  const time = kickoffTime.replace(/\s*uhr\s*$/i, '').trim() || '—';
  return { main: time, suffix: 'UHR' };
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
    const padX = compact ? 'px-3' : 'px-4 sm:px-5';
    const padY = compact ? 'py-4' : 'py-5 sm:py-6';

    return (
      <div
        ref={ref}
        className={`relative aspect-[4/5] w-full overflow-hidden rounded-[inherit] ${padX} ${padY}`}
      >
        <PosterBackdrop />

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-px bg-gradient-to-r from-transparent via-red-900/30 to-transparent"
          aria-hidden
        />

        <div className="relative z-[2] flex h-full min-h-0 flex-col items-center justify-between text-center">
          {/* Kopf */}
          <div className="w-full shrink-0 space-y-2">
            <p className="text-[8px] font-bold uppercase tracking-[0.34em] text-red-400/92 sm:text-[9px] sm:tracking-[0.38em]">
              {statusLabel}
            </p>
            <h2 className="text-[clamp(3rem,17vw,4.5rem)] font-black uppercase leading-[0.78] tracking-[0.11em] text-white [text-shadow:0_0_56px_rgba(220,38,38,0.55),0_6px_32px_rgba(0,0,0,0.5)]">
              {title}
            </h2>
            {venueLine ? (
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/44 sm:text-[10px]">
                {venueLine}
              </p>
            ) : null}
            {competitionLabel ? (
              <div className="flex justify-center pt-0.5">
                <span className="inline-flex max-w-full items-center justify-center rounded-full border border-red-500/28 bg-red-950/55 px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-red-100/88 sm:px-3 sm:text-[9px]">
                  {competitionLabel}
                </span>
              </div>
            ) : null}
          </div>

          {/* Duell */}
          <div className="flex w-full shrink-0 items-center justify-between gap-0">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:gap-2">
              <PosterLogo src={homeLogoUrl} alt={homeTeamName} />
              <FeedClubName fullName={homeTeamName} variant="poster" className="w-full px-0.5" />
            </div>

            <div className="flex shrink-0 flex-col items-center justify-center self-stretch px-1 sm:px-1.5">
              <div
                className="mb-1.5 h-12 w-[2px] sm:mb-2 sm:h-14"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, rgba(248,113,113,0.15) 20%, rgba(220,38,38,0.85) 50%, rgba(248,113,113,0.15) 80%, transparent 100%)',
                  boxShadow: '0 0 12px rgba(220,38,38,0.45)',
                }}
                aria-hidden
              />
              <span
                className="text-base font-black uppercase tracking-[0.14em] text-white/62 sm:text-lg"
                style={{ textShadow: '0 0 24px rgba(220,38,38,0.4)' }}
              >
                VS
              </span>
              <div
                className="mt-1.5 h-12 w-[2px] sm:mt-2 sm:h-14"
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, rgba(248,113,113,0.15) 20%, rgba(220,38,38,0.85) 50%, rgba(248,113,113,0.15) 80%, transparent 100%)',
                  boxShadow: '0 0 12px rgba(220,38,38,0.45)',
                }}
                aria-hidden
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 sm:gap-2">
              <PosterLogo src={awayLogoUrl} alt={awayTeamName} />
              <FeedClubName fullName={awayTeamName} variant="poster" className="w-full px-0.5" />
            </div>
          </div>

          {/* Anpfiff */}
          <div className="w-full shrink-0 space-y-0.5">
            {showAnpfiffLabel && !heroOverride ? (
              <p className="text-[8px] font-bold uppercase tracking-[0.26em] text-red-300/78 sm:text-[9px]">
                Anpfiff
              </p>
            ) : null}
            <p
              className={
                kickoff.livePulse
                  ? 'text-[clamp(2.75rem,13vw,3.85rem)] font-black uppercase leading-none tracking-[0.04em] text-red-400 [text-shadow:0_0_52px_rgba(220,38,38,0.55)] motion-safe:animate-pulse'
                  : 'text-[clamp(2.75rem,13vw,3.85rem)] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_5px_32px_rgba(0,0,0,0.65)]'
              }
            >
              {kickoff.main}
            </p>
            {kickoff.suffix ? (
              <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-white/36 sm:text-[10px]">
                {kickoff.suffix}
              </p>
            ) : null}
          </div>

          {/* Fuß */}
          <div className="w-full shrink-0 space-y-2">
            <div className="space-y-0.5">
              {meetingTime ? (
                <p className="text-[9px] leading-snug text-white/42 sm:text-[10px]">Treffpunkt {meetingTime}</p>
              ) : null}
              {location && location !== '—' ? (
                <p className="text-[9px] font-medium leading-snug text-white/48 sm:text-[10px]">{location}</p>
              ) : null}
            </div>

            {statusBadge ? (
              <div
                className={
                  kickoff.livePulse
                    ? 'mx-auto inline-flex min-h-[1.75rem] max-w-full items-center justify-center rounded-full border border-red-500/40 bg-red-600/88 px-3 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white sm:text-[9px] [animation-duration:1.5s] motion-safe:animate-pulse'
                    : 'mx-auto inline-flex min-h-[1.75rem] max-w-full items-center justify-center rounded-full border border-red-500/35 bg-red-950/65 px-3 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-red-100 sm:text-[9px]'
                }
                style={{
                  boxShadow: '0 0 24px rgba(185,28,28,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                <span className="truncate">{statusBadge}</span>
              </div>
            ) : null}

            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/38 sm:text-[11px] sm:tracking-[0.32em]">
              {hashtag}
            </p>
          </div>
        </div>
      </div>
    );
  },
);

MatchdayPosterArtwork.displayName = 'MatchdayPosterArtwork';
