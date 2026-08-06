import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChevronRight, MapPin } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { splitStatusForHero } from '../../features/home/homeFeedBuilder';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatMeetupTimeOnlyDe, getMatchTypeLabel } from '../match/matchCardLabels';
import { MatchCardGameCore } from '../match/MatchCardGameCore';
import { useInternalBasePath } from '../../demo/demoPaths';

type MatchdayCardProps = {
  event: EventRow;
  /** Wird für Parität mit Terminen nicht mehr für Teamnamen in der 3-Spalten-Zeile genutzt (siehe getOurTeamDisplayName). */
  teamName: string;
  /** z. B. HEUTE IST MATCHDAY / MORGEN IST MATCHDAY / NÄCHSTES SPIEL */
  statusLabel?: string;
};

export const MatchdayCard: React.FC<MatchdayCardProps> = ({
  event,
  statusLabel = 'HEUTE IST MATCHDAY',
}) => {
  const basePath = useInternalBasePath();
  const ourClubName = getOurTeamDisplayName();
  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const isHome = event.is_home;

  const { leftName, rightName } = useMemo(() => {
    if (isHome === true) return { leftName: ourClubName, rightName: opponent };
    if (isHome === false) return { leftName: opponent, rightName: ourClubName };
    return { leftName: ourClubName, rightName: opponent };
  }, [ourClubName, opponent, isHome]);

  const { leftColumnLabel, rightColumnLabel } = useMemo(() => {
    if (isHome === true) return { leftColumnLabel: 'Heim', rightColumnLabel: 'Gegner' };
    if (isHome === false) return { leftColumnLabel: 'Gegner', rightColumnLabel: 'Heim' };
    return { leftColumnLabel: 'Team', rightColumnLabel: 'Gegner' };
  }, [isHome]);

  const date = event.starts_at ? new Date(event.starts_at) : null;
  const timeStr = date
    ? new Intl.DateTimeFormat('de-AT', {
        timeZone: VIENNA_TZ,
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : '–';

  const showScore = false;
  const homeScore = 0;
  const awayScore = 0;

  const noteParts = (event.notes ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean);
  const endRaw = noteParts.find((p) => p.toLowerCase().startsWith('ende:'));
  const endTimeLabel = endRaw
    ? endRaw.replace(/^ende:\s*/i, '').replace(/\s*uhr\s*$/i, '').trim()
    : null;
  const descriptionParts = noteParts.slice(1).filter((p) => !p.toLowerCase().startsWith('ende:'));
  const descriptionText = descriptionParts.length ? descriptionParts.join(' · ') : null;

  const parsedLocation = splitCombinedLocation(event.location);
  const placeLine = parsedLocation.place;
  const addressLine = parsedLocation.address || (event.address ?? '').trim();
  const ortLine = (formatFullLocation(placeLine, addressLine) || '').trim() || '—';
  const meetLine = formatMeetupTimeOnlyDe(event.meeting_at) || '—';

  const headerTitle = getMatchTypeLabel(event.match_type ?? event.type);
  const meetupTimeOnly = formatMeetupTimeOnlyDe(event.meeting_at);

  const { lead, emphasis } = splitStatusForHero(statusLabel);
  const subline =
    opponent && opponent !== 'Gegner' ? `Gegen ${opponent}` : null;

  return (
    <div
      className="relative w-full rounded-3xl border border-red-500/40 p-[1px] shadow-2xl"
      style={{
        boxShadow:
          '0 0 0 1px rgba(220, 38, 38, 0.12), 0 28px 56px -16px rgba(0, 0, 0, 0.85), 0 0 80px -28px rgba(220, 38, 38, 0.22)',
      }}
    >
      <div
        className="relative overflow-hidden rounded-[1.4rem] px-5 pb-7 pt-8 sm:px-7 sm:pb-9 sm:pt-10"
        style={{
          background:
            'radial-gradient(ellipse 100% 70% at 50% -30%, rgba(220, 38, 38, 0.18) 0%, transparent 52%), radial-gradient(ellipse 80% 50% at 100% 100%, rgba(80, 20, 20, 0.35) 0%, transparent 45%), linear-gradient(168deg, #1a0a0a 0%, #0c0c0c 38%, #080404 100%)',
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
          <header className="flex flex-col items-center gap-4 text-center">
            {lead ? (
              <p className="text-[10px] font-bold uppercase leading-relaxed tracking-[0.32em] text-red-400/90 sm:text-[11px] sm:tracking-[0.36em]">
                {lead}
              </p>
            ) : null}
            <p className="text-[clamp(1.85rem,8vw,2.65rem)] font-black leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              {emphasis || statusLabel}
            </p>
            {subline ? (
              <p className="max-w-[280px] text-sm font-medium leading-snug text-white/50">{subline}</p>
            ) : null}
          </header>

          <div className="relative">
            <MatchCardGameCore
              headerTitle={headerTitle}
              leftName={leftName}
              rightName={rightName}
              opponentLogoUrl={null}
              timeDisplay={timeStr}
              isMatch
              showScore={showScore}
              homeScore={homeScore}
              awayScore={awayScore}
              kickoffLocation={null}
              meetupTimeOnly={meetupTimeOnly}
              showMeetupPill={false}
              endTimeLabel={endTimeLabel}
              descriptionText={descriptionText}
              variant="home-hero"
              leftColumnLabel={leftColumnLabel}
              rightColumnLabel={rightColumnLabel}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex min-h-[4.5rem] flex-col justify-center rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3.5 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600/20 text-red-400">
                  <Clock className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Treffpunkt</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{meetLine}</p>
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
                  <p className="mt-1 text-sm font-semibold leading-snug text-white">{ortLine}</p>
                </div>
              </div>
            </div>
          </div>

          <Link
            to={`${basePath}/events/${event.id}`}
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
            <span className="relative">Details &amp; Zu-/Absage</span>
            <ChevronRight
              className="relative h-5 w-5 shrink-0 opacity-90 transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={2.5}
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </div>
  );
};
