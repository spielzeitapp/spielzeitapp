import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChevronRight, MapPin } from 'lucide-react';
import type { MatchFeedTemplateKey } from '../../features/home/feedTemplates';
import { MatchCardGameCore } from '../match/MatchCardGameCore';

export type MatchdayHeroCardProps = {
  templateKey: MatchFeedTemplateKey;
  title: string;
  subtitle?: string | null;
  /** Kleine Zeile oberhalb des großen Titels (z. B. „HEUTE IST“). */
  titleLead?: string | null;
  homeTeam: string;
  opponent: string;
  isHome: boolean | null;
  matchLeftName: string;
  matchRightName: string;
  matchLeftColLabel: string;
  matchRightColLabel: string;
  kickoff: string;
  meetup: string;
  location: string;
  teamLogoUrl?: string | null;
  opponentLogoUrl?: string | null;
  playerImageUrl?: string | null;
  matchTypeLine?: string | null;
  meetupTimeOnly: string;
  endTimeLabel?: string | null;
  descriptionText?: string | null;
  eventId: string;
  ctaLabel: string;
};

const shellClass =
  'relative w-full rounded-3xl border border-red-500/40 p-[1px] shadow-2xl';

const shellStyle: React.CSSProperties = {
  boxShadow:
    '0 0 0 1px rgba(220, 38, 38, 0.12), 0 28px 56px -16px rgba(0, 0, 0, 0.85), 0 0 80px -28px rgba(220, 38, 38, 0.22)',
};

const innerBg =
  'radial-gradient(ellipse 100% 70% at 50% -30%, rgba(220, 38, 38, 0.18) 0%, transparent 52%), radial-gradient(ellipse 80% 50% at 100% 100%, rgba(80, 20, 20, 0.35) 0%, transparent 45%), linear-gradient(168deg, #1a0a0a 0%, #0c0c0c 38%, #080404 100%)';

export const MatchdayHeroCard: React.FC<MatchdayHeroCardProps> = ({
  templateKey,
  title,
  subtitle,
  titleLead,
  homeTeam: _homeTeam,
  opponent: _opponent,
  isHome: _isHome,
  matchLeftName,
  matchRightName,
  matchLeftColLabel,
  matchRightColLabel,
  kickoff,
  meetup,
  location,
  teamLogoUrl: _teamLogoUrl,
  opponentLogoUrl,
  playerImageUrl,
  matchTypeLine,
  meetupTimeOnly,
  endTimeLabel,
  descriptionText,
  eventId,
  ctaLabel,
}) => {
  const showPlayer = templateKey === 'hero_red_player_right' && Boolean(playerImageUrl?.trim());

  const headerBlock = (
    <header className="flex min-w-0 flex-col items-center gap-4 text-center">
      {titleLead ? (
        <p className="text-[10px] font-bold uppercase leading-relaxed tracking-[0.32em] text-red-400/90 sm:text-[11px] sm:tracking-[0.36em]">
          {titleLead}
        </p>
      ) : null}
      <p className="max-w-[min(100%,320px)] text-[clamp(1.65rem,7vw,2.4rem)] font-black leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        {title}
      </p>
      {subtitle ? (
        <p className="max-w-[280px] text-sm font-medium leading-snug text-white/50">{subtitle}</p>
      ) : null}
    </header>
  );

  const coreBlock = (
    <div className="relative min-w-0 flex-1">
      <MatchCardGameCore
        headerTitle={matchTypeLine ?? null}
        leftName={matchLeftName}
        rightName={matchRightName}
        opponentLogoUrl={opponentLogoUrl ?? null}
        timeDisplay={kickoff}
        isMatch
        showScore={false}
        homeScore={0}
        awayScore={0}
        kickoffLocation={null}
        meetupTimeOnly={meetupTimeOnly}
        showMeetupPill={false}
        endTimeLabel={endTimeLabel ?? null}
        descriptionText={descriptionText ?? null}
        variant="home-hero"
        leftColumnLabel={matchLeftColLabel}
        rightColumnLabel={matchRightColLabel}
      />
    </div>
  );

  const metaGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <div className="flex min-h-[4.5rem] flex-col justify-center rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600/20 text-red-400">
            <Clock className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Treffpunkt</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{meetup}</p>
          </div>
        </div>
      </div>
      <div className="flex min-h-[4.5rem] flex-col justify-center rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3.5 backdrop-blur-sm">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600/20 text-red-400">
            <MapPin className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Ort</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-white">{location}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const cta = (
    <Link
      to={`/app/events/${eventId}`}
      className="group relative flex min-h-[56px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 text-base font-bold text-white transition-all duration-200 active:brightness-95 sm:min-h-[58px] sm:rounded-3xl sm:text-[1.05rem]"
      style={{
        background: 'linear-gradient(180deg, #ef4444 0%, #b91c1c 48%, #991b1b 100%)',
        boxShadow:
          '0 4px 20px rgba(220, 38, 38, 0.45), 0 1px 0 rgba(255,255,255,0.12) inset, 0 -1px 0 rgba(0,0,0,0.2) inset',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.2) 0%, transparent 55%)',
        }}
      />
      <span className="relative">{ctaLabel}</span>
      <ChevronRight
        className="relative h-5 w-5 shrink-0 opacity-90 transition-transform duration-200 group-hover:translate-x-0.5"
        strokeWidth={2.5}
        aria-hidden
      />
    </Link>
  );

  return (
    <div className={shellClass} style={shellStyle}>
      <div
        className="relative overflow-hidden rounded-[1.4rem] px-5 pb-7 pt-8 sm:px-7 sm:pb-9 sm:pt-10"
        style={{
          background: innerBg,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[1.4rem] opacity-[0.35]"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(248, 113, 113, 0.12) 0%, transparent 42%)',
          }}
        />

        <div className="relative flex flex-col gap-8">
          {showPlayer ? (
            <div className="flex flex-row items-start gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-8">
                {headerBlock}
                {coreBlock}
              </div>
              <div className="shrink-0 pt-1">
                <img
                  src={playerImageUrl!.trim()}
                  alt=""
                  className="h-[132px] w-[96px] rounded-2xl border border-white/15 object-cover shadow-lg sm:h-[152px] sm:w-[108px]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              {headerBlock}
              {coreBlock}
            </>
          )}

          {metaGrid}
          {cta}
        </div>
      </div>
    </div>
  );
};
