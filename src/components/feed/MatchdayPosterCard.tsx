import React from 'react';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import { FeedClubName } from './FeedClubName';

const PLACEHOLDER =
  (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/logos/placeholder-shield-a.png';

const STADIUM_BG =
  'linear-gradient(180deg, rgba(8,0,0,0.99) 0%, rgba(18,2,2,0.98) 42%, rgba(6,0,0,1) 100%)';

export type MatchdayPosterVisualStatus = 'today' | 'live' | 'finished';

export type MatchdayAnnouncementTiming = 'today' | 'tomorrow';

export type MatchdayPosterCardProps = {
  homeTeamName: string;
  awayTeamName: string;
  homeLogoUrl: string;
  awayLogoUrl: string;
  kickoffTime: string;
  meetingTime: string | null;
  locationLine: string;
  venueLabel: string;
  status: MatchdayPosterVisualStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  matchType?: string | null;
  /** Auto-Feed Heute/Morgen — emotionale Headline (nicht bei LIVE/Endstand). */
  announcementTiming?: MatchdayAnnouncementTiming | null;
  /** Kompaktere Höhe für Home / kleine Screens (iPhone SE). */
  compact?: boolean;
};

function LogoImg({ src, alt, compact }: { src: string; alt: string; compact?: boolean }) {
  const [imgSrc, setImgSrc] = React.useState(src || PLACEHOLDER);
  React.useEffect(() => {
    setImgSrc(src || PLACEHOLDER);
  }, [src]);
  return (
    <div
      className={
        compact
          ? 'flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full border border-red-500/35 bg-black/50 shadow-[0_0_0_1px_rgba(220,38,38,0.2),0_8px_20px_rgba(0,0,0,0.5)] sm:h-[5.25rem] sm:w-[5.25rem]'
          : 'flex h-[5rem] w-[5rem] shrink-0 items-center justify-center rounded-full border border-red-500/35 bg-black/50 shadow-[0_0_0_1px_rgba(220,38,38,0.22),0_10px_24px_rgba(0,0,0,0.55)] sm:h-[5.75rem] sm:w-[5.75rem]'
      }
    >
      <img
        src={imgSrc}
        alt={alt}
        className={
          compact
            ? 'h-[3.65rem] w-[3.65rem] object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] sm:h-[4.35rem] sm:w-[4.35rem]'
            : 'h-[4.1rem] w-[4.1rem] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] sm:h-[4.85rem] sm:w-[4.85rem]'
        }
        loading="lazy"
        onError={() => {
          if (!imgSrc.endsWith('/logos/placeholder-shield-a.png')) setImgSrc(PLACEHOLDER);
        }}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2 min-w-0' : 'min-w-0'}>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-red-300/90 sm:text-[10px]">
        {label}
      </p>
      <p
        className={`mt-0.5 text-[12px] font-semibold leading-snug text-white/92 sm:text-[13px] ${
          wide ? 'break-words' : 'truncate'
        }`}
      >
        {value || '—'}
      </p>
    </div>
  );
}

export const MatchdayPosterCard = React.forwardRef<HTMLDivElement, MatchdayPosterCardProps>(
  function MatchdayPosterCard(
    {
      homeTeamName,
      awayTeamName,
      homeLogoUrl,
      awayLogoUrl,
      kickoffTime,
      meetingTime,
      locationLine,
      venueLabel,
      status,
      homeScore,
      awayScore,
      matchType,
      announcementTiming = null,
      compact = false,
    },
    ref,
  ) {
    const typeLabel = getMatchTypeLabel(matchType ?? undefined);
    const showAnnouncement = announcementTiming && status === 'today';

    const kickerText =
      showAnnouncement && announcementTiming === 'tomorrow'
        ? 'MORGEN IST SPIELTAG'
        : showAnnouncement && announcementTiming === 'today'
          ? 'HEUTE IST SPIELTAG'
          : status === 'live'
            ? 'LIVE'
            : status === 'finished'
              ? 'ENDSTAND'
              : 'MATCHDAY';

    let badgeText = 'HEUTE';
    if (showAnnouncement && announcementTiming === 'today') badgeText = 'HEUTE IST SPIELTAG';
    else if (showAnnouncement && announcementTiming === 'tomorrow') badgeText = 'MORGEN IST SPIELTAG';
    else if (status === 'live') badgeText = 'LIVE';
    else if (status === 'finished') {
      const hs = homeScore != null ? homeScore : null;
      const aws = awayScore != null ? awayScore : null;
      badgeText = hs != null && aws != null ? `ENDSTAND ${hs}:${aws}` : 'ENDSTAND';
    }

    const sectionGap = compact ? 'space-y-3.5 sm:space-y-4' : 'space-y-4 sm:space-y-5';
    const pad = compact ? 'px-3 py-4 sm:px-5 sm:py-5' : 'px-3.5 py-5 sm:px-6 sm:py-6';

    return (
      <div
        ref={ref}
        className={`relative w-full overflow-hidden rounded-2xl border border-red-950/55 sm:rounded-3xl ${pad}`}
        style={{
          background: STADIUM_BG,
          boxShadow:
            'inset 0 0 100px rgba(120,20,20,0.14), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(220,38,38,0.12), 0 20px 44px rgba(0,0,0,0.55)',
        }}
      >
        {/* Roter Brush / Stadium-Glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'linear-gradient(128deg, transparent 32%, rgba(185,28,28,0.12) 48%, rgba(127,29,29,0.22) 58%, rgba(69,10,10,0.08) 72%, transparent 88%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 110% 65% at 50% -8%, rgba(248,113,113,0.28), transparent 58%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(ellipse 85% 50% at 50% 108%, rgba(0,0,0,0.65), transparent 62%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/35 to-transparent"
          aria-hidden
        />

        <div className={`relative z-[1] flex flex-col items-center ${sectionGap}`}>
          {/* Headline */}
          <div className="w-full space-y-1 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-red-400/95 sm:text-[10px] sm:tracking-[0.3em]">
              {kickerText}
            </p>
            <h2
              className={
                compact
                  ? 'text-[2.15rem] font-black uppercase leading-[0.86] tracking-[0.12em] text-white [text-shadow:0_0_32px_rgba(220,38,38,0.38)] sm:text-[2.65rem]'
                  : 'text-[2.35rem] font-black uppercase leading-[0.86] tracking-[0.12em] text-white [text-shadow:0_0_40px_rgba(220,38,38,0.42)] sm:text-[2.85rem]'
              }
            >
              SPIELTAG
            </h2>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/48 sm:text-[11px]">
              {venueLabel}
            </p>
          </div>

          {/* Duell */}
          <div className="flex w-full max-w-none items-center justify-between gap-1.5 sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:gap-2.5">
              <LogoImg src={homeLogoUrl} alt={homeTeamName} compact={compact} />
              <FeedClubName fullName={homeTeamName} variant="poster" className="w-full px-0.5" />
            </div>

            <div className="flex shrink-0 flex-col items-center justify-center px-0.5 sm:px-1">
              <span
                className={
                  compact
                    ? 'text-xl font-black uppercase tracking-[0.08em] text-white/80 sm:text-2xl'
                    : 'text-2xl font-black uppercase tracking-[0.1em] text-white/82 sm:text-[1.75rem]'
                }
                style={{ textShadow: '0 0 24px rgba(220,38,38,0.25)' }}
              >
                VS
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:gap-2.5">
              <LogoImg src={awayLogoUrl} alt={awayTeamName} compact={compact} />
              <FeedClubName fullName={awayTeamName} variant="poster" className="w-full px-0.5" />
            </div>
          </div>

          {/* Premium-Info-Box */}
          <div
            className="w-full rounded-xl border border-white/[0.08] bg-black/45 px-3 py-2.5 backdrop-blur-[2px] sm:rounded-2xl sm:px-4 sm:py-3"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 24px rgba(120,20,20,0.08)' }}
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              <InfoRow label="Anpfiff" value={kickoffTime} />
              {meetingTime ? <InfoRow label="Treffpunkt" value={meetingTime} /> : null}
              <InfoRow label="Ort" value={locationLine} wide />
              {typeLabel ? <InfoRow label="Bewerb" value={typeLabel} wide /> : null}
            </div>
          </div>

          {/* Status-Badge */}
          <div className="flex w-full flex-col items-center gap-1.5 pt-0.5">
            <div
              className={
                status === 'live'
                  ? 'inline-flex min-h-[2rem] max-w-full items-center justify-center rounded-full border border-red-500/40 bg-red-600/88 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white sm:min-h-[2.25rem] sm:px-4 sm:text-[10px] sm:tracking-[0.16em] [animation-duration:1.5s] motion-safe:animate-pulse'
                  : showAnnouncement
                    ? 'inline-flex min-h-[2rem] max-w-full items-center justify-center rounded-full border border-red-500/45 bg-red-950/75 px-3 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-red-50 sm:min-h-[2.25rem] sm:px-3.5 sm:text-[9px] sm:tracking-[0.12em]'
                    : 'inline-flex min-h-[2rem] items-center justify-center rounded-full border border-red-500/35 bg-red-950/65 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-100 sm:text-[11px]'
              }
              style={{
                boxShadow:
                  '0 0 28px rgba(185,28,28,0.32), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              <span className="truncate">{badgeText}</span>
            </div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/32 sm:text-[10px]">
              #GEMEINSAMEINTEAM
            </p>
          </div>
        </div>
      </div>
    );
  },
);

MatchdayPosterCard.displayName = 'MatchdayPosterCard';
