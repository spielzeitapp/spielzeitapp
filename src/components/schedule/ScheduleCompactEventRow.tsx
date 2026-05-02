import React, { useState } from 'react';
import { CalendarDays, ChevronRight, Pencil, Radio, Trash2 } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { getClubLogo } from '../../lib/teamLogos';
import type { EffectiveEventType } from './scheduleEventViewUtils';
import {
  formatHeroDateParts,
  formatTimeHHmmDe,
  scheduleCompactPrimaryTitle,
  scheduleLocationLine,
  eventNotesTitle,
} from './scheduleEventViewUtils';
import { EventMotifIcon, TrainingMotifIcon } from './scheduleFootballMotifIcons';

export type ScheduleCompactEventRowProps = {
  ev: EventRow;
  et: EffectiveEventType;
  ourTeamName: string;
  opponentLogoUrl?: string | null;
  forcePublicView: boolean;
  trailing?: React.ReactNode;
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
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/50 text-white/90 transition-colors hover:border-red-500/35 hover:bg-red-500/15 sm:h-8 sm:w-8"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CompactOpponentLogo({ src }: { src: string }) {
  const [phase, setPhase] = useState<'img' | 'shield' | 'ball'>('img');
  if (phase === 'ball') {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-2xl leading-none sm:h-[3.25rem] sm:w-[3.25rem]"
        aria-hidden
      >
        ⚽
      </div>
    );
  }
  const url = phase === 'shield' ? '/logos/placeholder-shield-a.png' : src;
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/45 sm:h-[3.25rem] sm:w-[3.25rem]">
      <img
        src={url}
        alt=""
        className="h-10 w-10 object-contain sm:h-11 sm:w-11"
        onError={() => {
          if (phase === 'img') setPhase('shield');
          else setPhase('ball');
        }}
      />
    </div>
  );
}

export function ScheduleCompactEventRow({
  ev,
  et,
  ourTeamName,
  opponentLogoUrl,
  trailing,
  forcePublicView,
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
  const trainingNotesTitle = eventNotesTitle(ev.notes);

  const clickable = !forcePublicView;
  const handleRowClick = () => {
    if (clickable) onNavigate(ev.id);
  };

  const oppName = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
  const oppSrc = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });

  const homeAwayBadge =
    et === 'game' && ev.is_home === true
      ? { label: 'Heim', cls: 'border-emerald-500/40 bg-emerald-950/45 text-emerald-100' }
      : et === 'game' && ev.is_home === false
        ? { label: 'Auswärts', cls: 'border-amber-500/40 bg-amber-950/40 text-amber-100' }
        : null;

  const iconSlot =
    et === 'game' ? (
      <CompactOpponentLogo src={oppSrc} />
    ) : et === 'training' ? (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-500/28 bg-red-950/40 sm:h-[3.25rem] sm:w-[3.25rem]">
        <TrainingMotifIcon className="h-8 w-8 text-amber-300/95 sm:h-9 sm:w-9" />
      </div>
    ) : (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] sm:h-[3.25rem] sm:w-[3.25rem]">
        <EventMotifIcon className="h-7 w-7 text-red-300/90 sm:h-8 sm:w-8" />
      </div>
    );

  const trainerIcons =
    canManage && (showLiveButton || onEdit || onDelete || showCalendarButton) ? (
      <div className="flex flex-col items-end gap-0.5" onClick={(e) => e.stopPropagation()}>
        {showLiveButton && onLive ? (
          <IconAction
            title="Live starten"
            onClick={(e) => {
              e.stopPropagation();
              onLive();
            }}
          >
            <Radio className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2} />
          </IconAction>
        ) : null}
        {onEdit ? (
          <IconAction
            title="Bearbeiten"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2} />
          </IconAction>
        ) : null}
        {onDelete ? (
          <IconAction
            title="Löschen"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2} />
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
            <CalendarDays className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2} />
          </IconAction>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="w-full">
      <div
        className={[
          'flex min-h-[3.5rem] items-stretch gap-2 rounded-lg border border-white/[0.08] bg-black/35 px-1.5 py-1.5 sm:gap-2.5 sm:px-2',
          clickable ? 'cursor-pointer active:bg-white/[0.06]' : 'cursor-default',
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
        <div className="flex w-8 shrink-0 flex-col items-center justify-center self-center border-r border-white/10 pr-1 text-center sm:w-9">
          <span className="text-[6px] font-black leading-none text-red-300/85">{wd}</span>
          <span className="text-[11px] font-black tabular-nums leading-none text-white">{day}</span>
          <span className="text-[6px] font-bold uppercase leading-none text-white/40">{mon}</span>
        </div>

        {iconSlot}

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5 pr-0.5">
          {et === 'game' ? (
            <>
              <div className="flex min-w-0 flex-wrap items-start gap-1.5 gap-y-0.5">
                <p className="min-w-0 flex-1 text-[12px] font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-[13px]">
                  {oppName}
                </p>
                {homeAwayBadge ? (
                  <span
                    className={`mt-0.5 shrink-0 rounded border px-1 py-0.5 text-[7px] font-bold uppercase leading-none tracking-wide ${homeAwayBadge.cls}`}
                  >
                    {homeAwayBadge.label}
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] font-medium tabular-nums text-white/58 sm:text-[11px]">
                {timeStr}
                {loc ? <span className="text-white/35"> · </span> : null}
                {loc ? <span className="[overflow-wrap:anywhere] line-clamp-2">{loc}</span> : null}
              </p>
            </>
          ) : et === 'training' ? (
            <>
              <p className="text-[12px] font-bold leading-snug text-white sm:text-[13px]">Training</p>
              {trainingNotesTitle && trainingNotesTitle.trim().toLowerCase() !== 'training' ? (
                <p className="line-clamp-1 text-[10px] leading-tight text-white/48">{trainingNotesTitle}</p>
              ) : null}
              <p className="text-[10px] font-medium tabular-nums text-white/58 sm:text-[11px]">
                {timeStr}
                {loc ? <span className="text-white/35"> · </span> : null}
                {loc ? <span className="[overflow-wrap:anywhere] line-clamp-2">{loc}</span> : null}
              </p>
            </>
          ) : (
            <>
              <p className="line-clamp-2 text-[12px] font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-[13px]">
                {title}
              </p>
              <p className="text-[10px] font-medium tabular-nums text-white/58 sm:text-[11px]">
                {timeStr}
                {loc ? <span className="text-white/35"> · </span> : null}
                {loc ? <span className="[overflow-wrap:anywhere] line-clamp-2">{loc}</span> : null}
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-row items-center gap-1 self-stretch py-0.5">
          <div className="flex min-w-0 max-w-[6rem] flex-col items-end justify-center gap-0.5 sm:max-w-[6.75rem]">
            {trailing}
          </div>
          {trainerIcons}
          {clickable ? <ChevronRight className="h-4 w-4 shrink-0 text-white/25" aria-hidden /> : null}
        </div>
      </div>
    </div>
  );
}
