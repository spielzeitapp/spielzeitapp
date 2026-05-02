import React, { useState } from 'react';
import { CalendarDays, ChevronRight, Pencil, Radio, Trash2 } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { getClubLogo } from '../../lib/teamLogos';
import { AttendanceActionRow } from './AttendanceActionRow';
import type { EffectiveEventType } from './scheduleEventViewUtils';
import {
  formatHeroDateParts,
  formatTimeHHmmDe,
  scheduleCompactPrimaryTitle,
  scheduleLocationLine,
} from './scheduleEventViewUtils';
import { EventMotifIcon, MatchFallbackMotifIcon, TrainingMotifIcon } from './scheduleFootballMotifIcons';

export type ScheduleCompactEventRowProps = {
  ev: EventRow;
  et: EffectiveEventType;
  ourTeamName: string;
  opponentLogoUrl?: string | null;
  forcePublicView: boolean;
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

function IconAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/90 transition-colors hover:border-red-500/35 hover:bg-red-500/15"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

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
  const loc = scheduleLocationLine(ev);
  const locShort = loc.length > 36 ? `${loc.slice(0, 34)}…` : loc;

  const clickable = !forcePublicView;
  const handleRowClick = () => {
    if (clickable) onNavigate(ev.id);
  };

  const oppName = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
  const ourSrc = getClubLogo(ourTeamName?.trim() || 'Verein');
  const oppSrc = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });
  const [ourBroken, setOurBroken] = useState(false);
  const [oppBroken, setOppBroken] = useState(false);

  const iconSlot =
    et === 'game' ? (
      <div className="flex h-11 w-[4.25rem] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/12 bg-black/35 px-0.5 sm:w-[4.5rem]">
        {!ourBroken ? (
          <img
            src={ourSrc}
            alt=""
            className="h-7 w-7 rounded-md object-contain sm:h-8 sm:w-8"
            onError={() => setOurBroken(true)}
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center sm:h-8 sm:w-8">
            <MatchFallbackMotifIcon className="h-6 w-6 text-red-400/80 sm:h-7 sm:w-7" />
          </div>
        )}
        {!oppBroken ? (
          <img
            src={oppSrc}
            alt=""
            className="h-7 w-7 rounded-md object-contain sm:h-8 sm:w-8"
            onError={() => setOppBroken(true)}
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center sm:h-8 sm:w-8">
            <MatchFallbackMotifIcon className="h-6 w-6 text-white/35 sm:h-7 sm:w-7" />
          </div>
        )}
      </div>
    ) : et === 'training' ? (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-950/35">
        <TrainingMotifIcon className="h-7 w-7 text-amber-300/95" />
      </div>
    ) : (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.06]">
        <EventMotifIcon className="h-6 w-6 text-red-300/90" />
      </div>
    );

  return (
    <div className="w-full">
      <div
        className={[
          'flex min-h-[4.5rem] max-h-[5.5rem] items-stretch gap-1.5 rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.05] to-black/40 px-1.5 py-1 sm:gap-2 sm:px-2',
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
        <div className="flex w-9 shrink-0 flex-col items-center justify-center border-r border-white/10 pr-1 text-center">
          <span className="text-[7px] font-black leading-none text-red-300/90">{wd}</span>
          <span className="text-xs font-black tabular-nums leading-none text-white">{day}</span>
          <span className="text-[7px] font-bold uppercase leading-none text-white/45">{mon}</span>
        </div>

        {iconSlot}

        <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
          <p className="truncate text-[12px] font-bold leading-tight text-white sm:text-[13px]">{title}</p>
          <p className="truncate text-[10px] tabular-nums text-white/55 sm:text-[11px]">{timeStr}</p>
          {locShort ? (
            <p className="truncate text-[10px] leading-tight text-white/40 sm:text-[11px]">{locShort}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 pr-0.5">
          {trailing}
          {clickable ? <ChevronRight className="h-4 w-4 text-white/30" aria-hidden /> : null}
        </div>
      </div>

      {showParentAttendanceRow ? (
        <div className="mt-1 pl-0.5" onClick={(e) => e.stopPropagation()}>
          <AttendanceActionRow isTraining={isTraining} onOpenAttendance={onOpenAttendance} variant="default" />
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {canManage && showLiveButton && onLive ? (
          <IconAction
            title="Live starten"
            onClick={(e) => {
              e.stopPropagation();
              onLive();
            }}
          >
            <Radio className="h-3.5 w-3.5" strokeWidth={2} />
          </IconAction>
        ) : null}
        {canManage && onEdit ? (
          <IconAction
            title="Bearbeiten"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          </IconAction>
        ) : null}
        {canManage && onDelete ? (
          <IconAction
            title="Löschen"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </IconAction>
        ) : null}
        {showCalendarButton ? (
          <IconAction
            title="Zum Kalender hinzufügen"
            onClick={(e) => {
              e.stopPropagation();
              onCalendar();
            }}
          >
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
          </IconAction>
        ) : null}
      </div>
    </div>
  );
}
