import React from 'react';
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
import { EventMotifIcon, TrainingMotifIcon } from './scheduleFootballMotifIcons';

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

  const clickable = !forcePublicView;
  const handleRowClick = () => {
    if (clickable) onNavigate(ev.id);
  };

  const oppName = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
  const ourSrc = getClubLogo(ourTeamName?.trim() || 'Verein');
  const oppSrc = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });

  const homeAwayBadge =
    et === 'game' && ev.is_home === true
      ? { label: 'Heim', cls: 'border-emerald-500/40 bg-emerald-950/45 text-emerald-100' }
      : et === 'game' && ev.is_home === false
        ? { label: 'Auswärts', cls: 'border-amber-500/40 bg-amber-950/40 text-amber-100' }
        : null;

  const iconSlot =
    et === 'game' ? (
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-black/45 sm:h-[3.25rem] sm:w-[3.25rem]">
        <img
          src={oppSrc}
          alt=""
          className="h-9 w-9 object-contain sm:h-10 sm:w-10"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.src.endsWith('/logos/placeholder-shield-a.png')) return;
            img.src = '/logos/placeholder-shield-a.png';
          }}
        />
        <div className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-[1.15rem] w-[1.15rem] items-center justify-center rounded-md border border-white/12 bg-zinc-950/95 p-[1px] shadow-sm">
          <img
            src={ourSrc}
            alt=""
            className="h-full w-full rounded object-contain opacity-[0.72]"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.src.endsWith('/logos/placeholder-shield-a.png')) return;
              img.src = '/logos/placeholder-shield-a.png';
            }}
          />
        </div>
      </div>
    ) : et === 'training' ? (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-950/40">
        <TrainingMotifIcon className="h-7 w-7 text-amber-300/95 sm:h-8 sm:w-8" />
      </div>
    ) : (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06]">
        <EventMotifIcon className="h-7 w-7 text-red-300/90 sm:h-8 sm:w-8" />
      </div>
    );

  return (
    <div className="w-full">
      <div
        className={[
          'flex min-h-[4.25rem] items-stretch gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.05] to-black/40 px-2 py-1.5 sm:gap-2.5 sm:px-2.5 sm:py-2',
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
        <div className="flex w-9 shrink-0 flex-col items-center justify-center self-center border-r border-white/10 pr-1.5 text-center sm:w-10">
          <span className="text-[7px] font-black leading-none text-red-300/90">{wd}</span>
          <span className="text-xs font-black tabular-nums leading-none text-white">{day}</span>
          <span className="text-[7px] font-bold uppercase leading-none text-white/45">{mon}</span>
        </div>

        {iconSlot}

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5 pr-0.5">
          {et === 'game' ? (
            <>
              <div className="flex min-w-0 flex-wrap items-start gap-1.5 gap-y-0.5">
                <p className="min-w-0 flex-1 text-[12px] font-bold leading-snug text-white [overflow-wrap:anywhere] line-clamp-2 sm:text-[13px]">
                  {oppName}
                </p>
                {homeAwayBadge ? (
                  <span
                    className={`mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-wide ${homeAwayBadge.cls}`}
                  >
                    {homeAwayBadge.label}
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] font-medium tabular-nums text-white/58 sm:text-[11px]">{timeStr}</p>
              {loc ? (
                <p className="text-[10px] leading-snug text-white/44 [overflow-wrap:anywhere] line-clamp-2 sm:text-[11px]">
                  {loc}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="line-clamp-2 text-[12px] font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-[13px]">
                {title}
              </p>
              <p className="text-[10px] font-medium tabular-nums text-white/58 sm:text-[11px]">{timeStr}</p>
              {loc ? (
                <p className="text-[10px] leading-snug text-white/44 [overflow-wrap:anywhere] line-clamp-2 sm:text-[11px]">
                  {loc}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex min-w-0 max-w-[min(9rem,34%)] shrink-0 flex-col items-end justify-center gap-0.5 self-stretch py-0.5 sm:max-w-[10rem]">
          {trailing ? <div className="flex w-full flex-col items-end">{trailing}</div> : null}
          {clickable ? <ChevronRight className="h-4 w-4 shrink-0 text-white/28" aria-hidden /> : null}
        </div>
      </div>

      {showParentAttendanceRow ? (
        <div className="mt-1 pl-0.5" onClick={(e) => e.stopPropagation()}>
          <AttendanceActionRow isTraining={isTraining} onOpenAttendance={onOpenAttendance} variant="compact" />
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
