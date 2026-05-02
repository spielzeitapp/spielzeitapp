import React from 'react';
import { Dumbbell } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { getOurTeamDisplayName } from '../../lib/teamLogos';
import { formatMeetupTimeOnlyDe } from '../match/matchCardLabels';
import type { EffectiveEventType } from './scheduleEventViewUtils';
import {
  formatHeroDateParts,
  formatTimeHHmmDe,
  gameTeamNames,
  scheduleEventTypeLabel,
  scheduleLocationLine,
  eventNotesTitle,
} from './scheduleEventViewUtils';

export type ScheduleHeroEventCardProps = {
  ev: EventRow;
  et: EffectiveEventType;
  /** Anzeigename Mannschaft (wie MatchCard) */
  ourTeamName: string;
  scoreHome?: number | null;
  scoreAway?: number | null;
  showMeetup: boolean;
  /** Status-Pill / TrainerStats – innerhalb der Karte rechts oben */
  topRight?: React.ReactNode;
  isPublicView: boolean;
  isClickable: boolean;
  onNavigate?: (eventId: string) => void;
};

export function ScheduleHeroEventCard({
  ev,
  et,
  ourTeamName,
  scoreHome,
  scoreAway,
  showMeetup,
  topRight,
  isPublicView,
  isClickable,
  onNavigate,
}: ScheduleHeroEventCardProps) {
  const ourClub = getOurTeamDisplayName();
  const displayOur = ourTeamName?.trim() || ourClub;
  const { wd, day, mon } = formatHeroDateParts(ev.starts_at);
  const timeStr = formatTimeHHmmDe(ev.starts_at);
  const typeLabel = scheduleEventTypeLabel(ev, et);
  const { left: leftTeam, right: rightTeam } = gameTeamNames(ev, et, displayOur);
  const loc = scheduleLocationLine(ev);
  const meetup = formatMeetupTimeOnlyDe(ev.meeting_at);
  const hasScore =
    et === 'game' &&
    (ev.status === 'live' || ev.status === 'finished') &&
    (scoreHome != null || scoreAway != null);
  const home = Number(scoreHome ?? 0);
  const away = Number(scoreAway ?? 0);

  const trainingTitle = eventNotesTitle(ev.notes) ?? 'Training';

  const handleCardClick = () => {
    if (!isPublicView && isClickable && onNavigate) onNavigate(ev.id);
  };

  const cardClass = [
    'relative w-full overflow-hidden rounded-2xl border border-red-500/35 bg-gradient-to-b from-zinc-950/95 via-black/90 to-red-950/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_rgba(220,38,38,0.12)] sm:px-4 sm:py-4',
    !isPublicView && isClickable ? 'cursor-pointer transition hover:border-red-500/50' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {topRight ? (
        <div className="absolute right-2 top-2 z-[2] max-w-[10rem] sm:right-3 sm:top-3 sm:max-w-[11rem]">{topRight}</div>
      ) : null}

      <div className="relative flex gap-2.5 pr-[4.75rem] sm:gap-3 sm:pr-[5.5rem]">
        <div className="flex w-[2.75rem] shrink-0 flex-col items-center border-r border-white/10 pr-2 text-center sm:w-12">
          <span className="text-[9px] font-black leading-none text-red-300/95 sm:text-[10px]">{wd}</span>
          <span className="mt-1 text-[1.35rem] font-black tabular-nums leading-none text-white sm:text-2xl">{day}</span>
          <span className="mt-0.5 text-[9px] font-bold uppercase leading-tight text-white/55 sm:text-[10px]">{mon}</span>
        </div>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-left text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/50 sm:text-[11px]">
            {typeLabel}
          </p>
          <p className="mt-1 text-[clamp(1.75rem,9vw,2.75rem)] font-black tabular-nums leading-none tracking-tight text-white">
            {timeStr}
          </p>

          {et === 'game' ? (
            <>
              <div className="mt-2.5 flex min-h-[2.5rem] items-center justify-between gap-1.5 text-[11px] font-bold leading-tight text-white sm:text-sm">
                <span className="min-w-0 flex-1 truncate text-right">{leftTeam}</span>
                <span className="shrink-0 px-0.5 text-[10px] font-black text-white/35">vs</span>
                <span className="min-w-0 flex-1 truncate text-left">{rightTeam}</span>
              </div>
              {hasScore ? (
                <p className="mt-1 text-center text-sm font-black tabular-nums text-red-200/95">
                  {home}:{away}
                </p>
              ) : null}
            </>
          ) : et === 'training' ? (
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <Dumbbell className="h-5 w-5 shrink-0 text-red-400 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
              <span className="min-w-0 truncate text-left text-sm font-bold text-white sm:text-base">{trainingTitle}</span>
            </div>
          ) : (
            <div className="mt-2.5 text-sm font-bold text-white">{typeLabel}</div>
          )}

          {loc ? (
            <p className="mt-2 line-clamp-2 text-left text-[11px] leading-snug text-white/60 sm:text-xs">{loc}</p>
          ) : (
            <p className="mt-2 text-left text-[11px] text-white/35">Ort folgt</p>
          )}

          {showMeetup && meetup ? (
            <div className="mt-2.5 flex justify-center">
              <span className="inline-flex max-w-full truncate rounded-full border border-red-500/40 bg-red-950/50 px-3 py-1 text-[11px] font-semibold text-red-100">
                Treffpunkt: {meetup}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  if (isPublicView) {
    return (
      <div className={cardClass} onClick={(e) => e.preventDefault()}>
        {inner}
      </div>
    );
  }

  if (isClickable && onNavigate) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cardClass}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        {inner}
      </div>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}
