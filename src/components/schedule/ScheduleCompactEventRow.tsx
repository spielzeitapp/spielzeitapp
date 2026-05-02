import React from 'react';
import { ChevronRight, Dumbbell } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { Button } from '../../app/components/ui/Button';
import { AttendanceActionRow } from './AttendanceActionRow';
import type { EffectiveEventType } from './scheduleEventViewUtils';
import {
  formatHeroDateParts,
  formatTimeHHmmDe,
  scheduleCompactPrimaryTitle,
  scheduleCompactSecondaryLine,
  scheduleLocationLine,
} from './scheduleEventViewUtils';

export type ScheduleCompactEventRowProps = {
  ev: EventRow;
  et: EffectiveEventType;
  ourTeamName: string;
  opponentLogoUrl?: string | null;
  forcePublicView: boolean;
  /** Rechts in der Zeile (Status-Pill oder TrainerStatsMini); Fans ohne Pill. */
  trailing?: React.ReactNode;
  showParentAttendanceRow: boolean;
  isTraining: boolean;
  onOpenAttendance: () => void;
  canManage: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onNavigate: (id: string) => void;
  onLive?: () => void;
  showLiveButton: boolean;
  onCalendar: () => void;
  showCalendarButton: boolean;
};

export function ScheduleCompactEventRow({
  ev,
  et,
  ourTeamName,
  opponentLogoUrl,
  trailing,
  forcePublicView,
  showParentAttendanceRow,
  isTraining,
  onOpenAttendance,
  canManage,
  onEdit,
  onDelete,
  onNavigate,
  onLive,
  showLiveButton,
  onCalendar,
  showCalendarButton,
}: ScheduleCompactEventRowProps) {
  const { wd, day, mon } = formatHeroDateParts(ev.starts_at);
  const timeStr = formatTimeHHmmDe(ev.starts_at);
  const title = scheduleCompactPrimaryTitle(ev, et, ourTeamName);
  const sub = scheduleCompactSecondaryLine(ev, et);
  const loc = scheduleLocationLine(ev);
  const locShort = loc.length > 42 ? `${loc.slice(0, 40)}…` : loc;

  const clickable = !forcePublicView;
  const handleRowClick = () => {
    if (clickable) onNavigate(ev.id);
  };

  const logoSrc = (opponentLogoUrl ?? '').trim();

  return (
    <div className="w-full">
      <div
        className={[
          'flex min-h-[3.25rem] items-stretch gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.05] to-black/40 px-2 py-2 sm:min-h-[3.5rem] sm:gap-2.5 sm:px-2.5',
          clickable ? 'cursor-pointer active:bg-white/[0.07]' : 'cursor-default',
        ].join(' ')}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? handleRowClick : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick();
                }
              }
            : undefined
        }
      >
        <div className="flex w-10 shrink-0 flex-col items-center justify-center border-r border-white/10 pr-1.5 text-center sm:w-11">
          <span className="text-[8px] font-black leading-none text-red-300/90">{wd}</span>
          <span className="text-sm font-black tabular-nums leading-none text-white">{day}</span>
          <span className="text-[8px] font-bold uppercase leading-none text-white/45">{mon}</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {et === 'game' && logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg border border-white/15 bg-black/30 object-contain sm:h-10 sm:w-10"
            />
          ) : et === 'training' || et === 'event' || et === 'other' ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-950/40 sm:h-10 sm:w-10">
              <Dumbbell className="h-4 w-4 text-red-300/90" strokeWidth={2} aria-hidden />
            </div>
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-white/5 sm:h-10 sm:w-10" aria-hidden />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight text-white sm:text-sm">{title}</p>
            <p className="truncate text-[11px] text-white/50">
              {sub ? `${sub} · ` : ''}
              {timeStr}
              {locShort ? ` · ${locShort}` : ''}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {trailing}
            {clickable ? (
              <ChevronRight className="h-5 w-5 text-white/30 sm:h-5 sm:w-5" aria-hidden />
            ) : null}
          </div>
        </div>
      </div>

      {showParentAttendanceRow ? (
        <div className="mt-1.5 pl-0.5" onClick={(e) => e.stopPropagation()}>
          <AttendanceActionRow isTraining={isTraining} onOpenAttendance={onOpenAttendance} variant="default" />
        </div>
      ) : null}

      <div className="mt-1.5 flex flex-wrap justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {canManage && showLiveButton && onLive ? (
          <Button
            type="button"
            variant="primary"
            size="xs"
            className="rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onLive();
            }}
          >
            Live
          </Button>
        ) : null}
        {canManage && onEdit ? (
          <Button
            type="button"
            variant="soft"
            size="xs"
            className="rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            Bearbeiten
          </Button>
        ) : null}
        {canManage && onDelete ? (
          <Button
            type="button"
            variant="soft"
            size="xs"
            className="rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            Löschen
          </Button>
        ) : null}
        {showCalendarButton ? (
          <Button
            type="button"
            variant="soft"
            size="xs"
            className="rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onCalendar();
            }}
          >
            Kalender
          </Button>
        ) : null}
      </div>
    </div>
  );
}
