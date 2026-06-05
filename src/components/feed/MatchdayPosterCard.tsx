import React from 'react';
import { buildFeedMatchMetaLine, pickFeedAgeGroup } from '../../lib/feedClubNaming';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import { FeedClubName } from './FeedClubName';
import { FeedMatchMetaLine } from './feedTypography';

const PLACEHOLDER =
  (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/logos/placeholder-shield-a.png';

const STADIUM_BG_URL = `${import.meta.env.BASE_URL || '/'}intro/welcome-hero.png`;

const HERO_STADIUM_GRADIENT =
  'linear-gradient(to bottom, rgba(16,14,16,0.88) 0%, rgba(10,10,12,0.94) 46%, rgba(18,10,12,0.97) 100%)';

const SHELL_SHADOW =
  '0 0 0 1px rgba(220, 38, 38, 0.12), 0 28px 56px -16px rgba(0, 0, 0, 0.85), 0 0 80px -28px rgba(220, 38, 38, 0.22)';

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

function PosterStadiumBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]" aria-hidden>
      <img
        src={STADIUM_BG_URL}
        alt=""
        className="absolute inset-0 h-full min-h-full w-full min-w-full scale-110 object-cover object-[center_28%] opacity-[0.12] brightness-[0.48] saturate-[0.75]"
      />
      <div className="absolute inset-0 bg-black/72" />
      <div className="absolute inset-0 backdrop-blur-[3px] bg-black/14" />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_0%_35%,rgba(255,240,220,0.1)_0%,rgba(122,29,42,0.14)_28%,transparent_62%),radial-gradient(ellipse_55%_45%_at_100%_35%,rgba(255,240,220,0.1)_0%,rgba(122,29,42,0.14)_28%,transparent_62%)]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-8%,rgba(122,29,42,0.14),transparent_58%),radial-gradient(ellipse_80%_50%_at_50%_110%,rgba(58,18,24,0.12),transparent_52%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_28%,rgba(0,0,0,0.22)_100%)]" />
      <div className="absolute inset-0" style={{ background: HERO_STADIUM_GRADIENT }} />
    </div>
  );
}

function LogoImg({ src, alt }: { src: string; alt: string }) {
  const [imgSrc, setImgSrc] = React.useState(src || PLACEHOLDER);
  React.useEffect(() => {
    setImgSrc(src || PLACEHOLDER);
  }, [src]);
  return (
    <div className="flex h-[5.25rem] w-[5.25rem] shrink-0 items-center justify-center rounded-full border border-red-500/38 bg-black/52 shadow-[0_0_0_1px_rgba(220,38,38,0.22),0_10px_26px_rgba(0,0,0,0.55)] sm:h-[6.25rem] sm:w-[6.25rem]">
      <img
        src={imgSrc}
        alt={alt}
        className="h-[4.35rem] w-[4.35rem] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.5)] sm:h-[5.15rem] sm:w-[5.15rem]"
        loading="lazy"
        onError={() => {
          if (!imgSrc.endsWith('/logos/placeholder-shield-a.png')) setImgSrc(PLACEHOLDER);
        }}
      />
    </div>
  );
}

function heroKickoffDisplay(
  kickoffTime: string,
  status: MatchdayPosterVisualStatus,
  homeScore?: number | null,
  awayScore?: number | null,
): { main: string; suffix: string | null } {
  if (status === 'live') return { main: 'LIVE', suffix: null };
  if (status === 'finished') {
    const hs = homeScore != null ? homeScore : null;
    const aws = awayScore != null ? awayScore : null;
    if (hs != null && aws != null) return { main: `${hs} : ${aws}`, suffix: 'ENDSTAND' };
    return { main: 'ENDSTAND', suffix: null };
  }
  const time = kickoffTime.replace(/\s*uhr\s*$/i, '').trim() || '—';
  return { main: time, suffix: 'UHR' };
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
    const matchMetaLine = buildFeedMatchMetaLine(
      pickFeedAgeGroup(homeTeamName, awayTeamName),
      typeLabel,
    );
    const heroKickoff = heroKickoffDisplay(kickoffTime, status, homeScore, awayScore);

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

    const showStatusBadge = status === 'live' || status === 'finished';
    let badgeText = 'LIVE';
    if (status === 'finished') {
      const hs = homeScore != null ? homeScore : null;
      const aws = awayScore != null ? awayScore : null;
      badgeText = hs != null && aws != null ? `ENDSTAND ${hs}:${aws}` : 'ENDSTAND';
    }

    const sectionGap = compact ? 'space-y-3.5 sm:space-y-4' : 'space-y-4 sm:space-y-5';
    const pad = compact ? 'px-3 py-4 sm:px-5 sm:py-5' : 'px-3.5 py-5 sm:px-6 sm:py-6';

    return (
      <div
        ref={ref}
        className="relative w-full rounded-2xl border border-red-500/40 p-[1px] sm:rounded-3xl"
        style={{ boxShadow: SHELL_SHADOW }}
      >
        <div className={`relative overflow-hidden rounded-[inherit] ${pad}`}>
          <PosterStadiumBackdrop />

          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent"
            aria-hidden
          />

          <div className={`relative z-[2] flex flex-col items-center ${sectionGap}`}>
            {/* Headline-Block */}
            <div className="w-full space-y-1.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-red-400/95 sm:text-[10px] sm:tracking-[0.3em]">
                {kickerText}
              </p>
              <h2 className="text-[2.15rem] font-black uppercase leading-[0.86] tracking-[0.12em] text-white [text-shadow:0_0_36px_rgba(220,38,38,0.4)] sm:text-[2.75rem]">
                SPIELTAG
              </h2>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 sm:text-[11px]">
                {venueLabel}
              </p>
              <FeedMatchMetaLine line={matchMetaLine} className="pt-0.5" />
            </div>

            {/* Duell */}
            <div className="flex w-full max-w-none items-center justify-between gap-1 sm:gap-3">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:gap-2.5">
                <LogoImg src={homeLogoUrl} alt={homeTeamName} />
                <FeedClubName fullName={homeTeamName} variant="poster" className="w-full px-0.5" />
              </div>

              <div className="flex shrink-0 flex-col items-center justify-center px-0.5">
                <span
                  className="text-base font-bold uppercase tracking-[0.14em] text-white/42 sm:text-lg"
                  style={{ textShadow: '0 0 16px rgba(220,38,38,0.18)' }}
                >
                  VS
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:gap-2.5">
                <LogoImg src={awayLogoUrl} alt={awayTeamName} />
                <FeedClubName fullName={awayTeamName} variant="poster" className="w-full px-0.5" />
              </div>
            </div>

            {/* Anpfiff — emotionaler Mittelpunkt */}
            <div className="w-full space-y-1 text-center">
              {status === 'today' && !showStatusBadge ? (
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-red-300/85 sm:text-[10px]">
                  Anpfiff
                </p>
              ) : null}
              <p
                className={
                  status === 'live'
                    ? 'text-[2.35rem] font-black uppercase leading-none tracking-[0.06em] text-red-400 [text-shadow:0_0_40px_rgba(220,38,38,0.45)] sm:text-[2.85rem] motion-safe:animate-pulse'
                    : 'text-[2.35rem] font-extrabold tabular-nums leading-none tracking-tight text-white drop-shadow-[0_3px_22px_rgba(0,0,0,0.55)] sm:text-[2.85rem]'
                }
              >
                {heroKickoff.main}
              </p>
              {heroKickoff.suffix ? (
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45 sm:text-[11px]">
                  {heroKickoff.suffix}
                </p>
              ) : null}
            </div>

            {/* Vereinfachte Infos — keine Formular-Box */}
            <div className="w-full space-y-1.5 text-center">
              {meetingTime ? (
                <p className="text-[12px] font-medium leading-snug text-white/78 sm:text-[13px]">
                  <span className="font-semibold text-white/52">Treffpunkt</span>{' '}
                  <span className="text-white/88">{meetingTime}</span>
                </p>
              ) : null}
              {locationLine && locationLine !== '—' ? (
                <p className="text-[12px] font-semibold leading-snug text-white/88 sm:text-[13px]">{locationLine}</p>
              ) : null}
            </div>

            {/* Status-Badge nur LIVE / Endstand */}
            {showStatusBadge ? (
              <div
                className={
                  status === 'live'
                    ? 'inline-flex min-h-[2rem] max-w-full items-center justify-center rounded-full border border-red-500/40 bg-red-600/88 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white sm:min-h-[2.25rem] sm:px-4 sm:text-[10px] sm:tracking-[0.16em] [animation-duration:1.5s] motion-safe:animate-pulse'
                    : 'inline-flex min-h-[2rem] max-w-full items-center justify-center rounded-full border border-red-500/35 bg-red-950/65 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-100 sm:text-[11px]'
                }
                style={{
                  boxShadow: '0 0 28px rgba(185,28,28,0.32), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                <span className="truncate">{badgeText}</span>
              </div>
            ) : null}

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
