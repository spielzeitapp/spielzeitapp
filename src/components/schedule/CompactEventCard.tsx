import React, { useState } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import type { EventRow } from '../../hooks/useEvents';
import { getClubLogo } from '../../lib/teamLogos';
import { splitCombinedLocation } from '../../lib/eventLocation';
import { getMatchTypeLabel } from '../match/matchCardLabels';
import type { EffectiveEventType } from './scheduleEventViewUtils';
import {
  formatCompactListDateParts,
  formatCompactListWeekdayAbbrev,
  formatTimeHHmmDe,
  scheduleCompactPrimaryTitle,
  scheduleEventTypeLabel,
  eventNotesTitle,
} from './scheduleEventViewUtils';
import {
  dsScheduleDateBoxClass,
  dsScheduleDateBoxDayClass,
  dsScheduleDateBoxMonthClass,
  dsScheduleDateBoxWeekdayClass,
  dsScheduleListPanelClass,
  dsScheduleListPanelGlowClass,
} from '../../lib/premiumDesignSystem';
import { TrainingPlayerIcon } from './TrainingPlayerIcon';

export type CompactEventCardProps = {
  ev: EventRow;
  et: EffectiveEventType;
  ourTeamName: string;
  opponentLogoUrl?: string | null;
  forcePublicView: boolean;
  /** Eltern/Spieler „Weitere Termine“: 3 Spalten (Datum | Text | Button+Pfeil), ohne Logos. */
  parentCompactLayout?: boolean;
  trailing?: React.ReactNode;
  onNavigate: (id: string) => void;
};

function compactTrainingHeadline(ourTeamName: string, notesTitle: string | null): string | null {
  const team = (ourTeamName ?? '').trim();
  let m = team.match(/\bU\s*(\d{1,2})\b/i);
  if (m) return `U${m[1]} Training`;
  m = team.match(/\bU(\d{1,2})\b/i);
  if (m) return `U${m[1]} Training`;
  const n = (notesTitle ?? '').trim();
  if (n && n.toLowerCase() !== 'training') return n;
  return null;
}

function splitTrainingTitleLines(trainingTitle: string | null): { top: string; bottom: string | null } {
  const t = (trainingTitle ?? '').trim();
  if (!t) return { top: 'Training', bottom: null };
  const m = t.match(/^(.*)\s+Training$/i);
  if (!m) return { top: t, bottom: null };
  const top = (m[1] ?? '').trim();
  return { top: top || 'Training', bottom: 'Training' };
}

/** Kurzform für Zeile 2 (z. B. „Meisterschaft“ statt „Meisterschaftsspiel“). */
function shortMatchTypeLabel(matchType: string | null | undefined): string {
  const f = getMatchTypeLabel(matchType) ?? 'Spiel';
  if (/^Meisterschaftsspiel$/i.test(f)) return 'Meisterschaft';
  if (/^Freundschaftsspiel$/i.test(f)) return 'Freundschaft';
  if (/^Testspiel$/i.test(f)) return 'Test';
  return f;
}

function CompactOpponentLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center text-[1rem] leading-none text-white/90 [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.06))] sm:h-9 sm:w-9"
        aria-hidden
      >
        ⚽
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-8 w-8 shrink-0 object-contain [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.06))] sm:h-9 sm:w-9"
      onError={() => setFailed(true)}
    />
  );
}

function eventTypeBadgeClass(et: EffectiveEventType): string {
  if (et === 'training') {
    return 'bg-emerald-950/75 text-emerald-100/95';
  }
  if (et === 'game') {
    return 'bg-zinc-800/90 text-white/82';
  }
  return 'bg-zinc-800/80 text-white/78';
}

/**
 * „Weitere Termine“: Datum | Content (Icon+Text) | Aktion+Pfeil.
 * Eltern: rechte Spalte fix w-[118px]; Trainer: gleiche Spalte für Stats.
 */
export function CompactEventCard({
  ev,
  et,
  ourTeamName,
  opponentLogoUrl,
  parentCompactLayout = false,
  trailing,
  forcePublicView,
  onNavigate,
}: CompactEventCardProps) {
  const { wd, day, monYear } = formatCompactListDateParts(ev.starts_at);
  const timeStr = formatTimeHHmmDe(ev.starts_at);
  const title = scheduleCompactPrimaryTitle(ev, et, ourTeamName);
  const trainingNotesTitle = eventNotesTitle(ev.notes);

  const parsedLoc = splitCombinedLocation(ev.location ?? '');
  const venueOnly = (parsedLoc.place ?? '').trim() || null;

  const clickable = !forcePublicView;
  const handleRowClick = () => {
    if (clickable) onNavigate(ev.id);
  };

  const oppName = (ev.opponent ?? 'Gegner').trim() || 'Gegner';

  const homeAwayShort =
    et === 'game' && ev.is_home === true ? 'Heim' : et === 'game' && ev.is_home === false ? 'Auswärts' : '';

  const trainingTitle =
    et === 'training' ? (compactTrainingHeadline(ourTeamName, trainingNotesTitle) ?? 'Training') : null;
  const trainingTitleLines = splitTrainingTitleLines(trainingTitle);
  const hasTrailing = Boolean(trailing);
  const oppSrc = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });
  const inlineTypeIcon =
    et === 'game' ? (
      <CompactOpponentLogo src={oppSrc} />
    ) : et === 'training' ? (
      <TrainingPlayerIcon variant="list" />
    ) : (
      <CalendarDays className="h-5 w-5 shrink-0 text-red-200/85" />
    );

  if (parentCompactLayout) {
    const wdAbbrev = formatCompactListWeekdayAbbrev(ev.starts_at);
    const parentTitle = et === 'game' ? oppName : et === 'training' ? trainingTitle : title;

    return (
      <div
        className={[
          `relative mb-2 -mx-1 flex min-h-[88px] w-[calc(100%+0.5rem)] min-w-0 flex-row items-stretch gap-2.5 overflow-hidden px-2 py-2 sm:mx-0 sm:w-full ${dsScheduleListPanelClass()}`,
          clickable ? 'cursor-pointer active:bg-white/[0.04]' : 'cursor-default',
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
        <div className="flex w-[60px] shrink-0 flex-col items-start justify-center gap-0.5 rounded-lg border border-white/10 bg-black/25 px-1.5 py-1.5 leading-none">
          <span className="text-[12px] font-semibold uppercase leading-none tracking-widest text-red-400">
            {wdAbbrev}
          </span>
          <span className="text-[30px] font-bold tabular-nums leading-none text-white">{day}</span>
          <span className="text-[12px] leading-tight text-white/60">{monYear}</span>
          <span className="text-[13px] font-medium tabular-nums leading-tight text-red-400">{timeStr}</span>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center space-y-1.5 pr-16">
          <div className={`flex min-w-0 items-start ${et === 'training' ? 'gap-3' : 'gap-2'}`}>
            <div className="shrink-0 pt-0.5">{inlineTypeIcon}</div>
            {et === 'training' ? (
              <div className="min-w-0 flex-1">
                <p className="min-w-0 line-clamp-1 text-[17px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal]" lang="de">
                  {trainingTitleLines.top}
                </p>
                {trainingTitleLines.bottom ? (
                  <p className="min-w-0 line-clamp-1 text-[17px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal]" lang="de">
                    {trainingTitleLines.bottom}
                  </p>
                ) : null}
              </div>
            ) : (
              <p
                className="min-w-0 flex-1 line-clamp-2 text-[17px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal]"
                lang="de"
              >
                {parentTitle}
              </p>
            )}
          </div>
          {et === 'game' && homeAwayShort ? (
            <span
              className={`inline-flex w-fit shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${
                ev.is_home === true
                  ? 'border-emerald-400/25 bg-emerald-500/12 text-emerald-200'
                  : ev.is_home === false
                    ? 'border-red-400/25 bg-red-500/12 text-red-200'
                    : 'border-white/20 bg-white/10 text-white/75'
              }`}
            >
              {homeAwayShort}
            </span>
          ) : null}
          {venueOnly ? <p className="min-w-0 line-clamp-2 text-[14px] leading-tight text-white/72">{venueOnly}</p> : null}
        </div>

        {hasTrailing ? (
          <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5 opacity-90 [&>*]:origin-top-right [&>*]:scale-90">
            {trailing}
          </div>
        ) : null}
        {clickable ? (
          <span className="pointer-events-none absolute bottom-5 right-4 text-[18px] font-light leading-none text-white/22" aria-hidden>
            ›
          </span>
        ) : null}
      </div>
    );
  }

  const matchShort = shortMatchTypeLabel(ev.match_type);
  const venueIsShort = Boolean(venueOnly && venueOnly.length <= 24);

  const typeBadgeLabelOther =
    et !== 'game' && et !== 'training'
      ? (scheduleEventTypeLabel(ev, et) ?? 'Termin').toUpperCase()
      : null;

  const iconSlot =
    et === 'game' ? (
      <CompactOpponentLogo src={oppSrc} />
    ) : et === 'training' ? (
      <TrainingPlayerIcon variant="list" />
    ) : (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <CalendarDays className="h-5 w-5 text-red-200/85" />
      </span>
    );

  const titleClamp =
    'line-clamp-2 min-w-0 flex-1 whitespace-normal text-[17px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal] [word-break:normal]';

  const titleText = (
    <div className="min-w-0 flex-1">
      {et === 'game' ? (
        <p className={titleClamp} lang="de">
          {oppName}
        </p>
      ) : et === 'training' ? (
        <>
          <p className="min-w-0 line-clamp-1 text-[17px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal]" lang="de">
            {trainingTitleLines.top}
          </p>
          {trainingTitleLines.bottom ? (
            <p className="min-w-0 line-clamp-1 text-[17px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal]" lang="de">
              {trainingTitleLines.bottom}
            </p>
          ) : null}
        </>
      ) : (
        <p className={titleClamp} lang="de">
          {title}
        </p>
      )}
    </div>
  );

  const line2 =
    et === 'game' ? (
      <div className="flex min-w-0 items-center gap-1.5 pl-[calc(2rem+0.5rem)]">
        {homeAwayShort ? (
          <span
            className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${
              ev.is_home === true
                ? 'border-emerald-400/20 bg-emerald-500/12 text-emerald-200'
                : ev.is_home === false
                  ? 'border-red-400/20 bg-red-500/12 text-red-200'
                  : 'border-white/20 bg-white/10 text-white/75'
            }`}
          >
            {homeAwayShort}
          </span>
        ) : null}
        {venueOnly ? null : (
          <span className="min-w-0 text-[14px] leading-tight text-white/70">{matchShort}</span>
        )}
      </div>
    ) : et !== 'game' && et !== 'training' && typeBadgeLabelOther ? (
      <span
        className={`inline-flex w-fit max-w-full shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide ${eventTypeBadgeClass(et)}`}
      >
        {typeBadgeLabelOther}
      </span>
    ) : null;

  const line3 =
    venueOnly ? (
      et === 'game' ? (
        <p
          className={`min-w-0 pl-[calc(2rem+0.5rem)] text-[14px] leading-tight text-white/72 line-clamp-2 ${
            venueIsShort ? 'whitespace-nowrap' : 'whitespace-normal'
          }`}
          title={venueOnly}
        >
          {venueOnly}
        </p>
      ) : (
        <p className="flex min-h-0 min-w-0 max-w-full items-center gap-1 pl-[calc(2rem+0.375rem)] text-[14px] font-medium leading-snug text-white/72 line-clamp-2">
          <MapPin className="h-3 w-3 shrink-0 text-rose-300/70" aria-hidden />
          <span className="min-w-0 flex-1" title={venueOnly}>
            {venueOnly}
          </span>
        </p>
      )
    ) : null;

  return (
    <div
      className={[
        `relative mb-2 -mx-1 flex w-[calc(100%+0.5rem)] min-w-0 flex-row items-stretch gap-2 overflow-x-hidden px-2 py-2 sm:mx-0 sm:w-full ${dsScheduleListPanelClass()}`,
        clickable ? 'cursor-pointer active:bg-white/[0.03]' : 'cursor-default',
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
      <div className={dsScheduleListPanelGlowClass()} aria-hidden />
      <div className={`${dsScheduleDateBoxClass()} relative z-[1] !w-[54px]`}>
        <span className={dsScheduleDateBoxWeekdayClass()}>{wd}</span>
        <span className={`${dsScheduleDateBoxDayClass()} !text-[1.45rem]`}>{day}</span>
        <span className={`${dsScheduleDateBoxMonthClass()} !text-[9px]`}>{monYear}</span>
        <span className="text-[11px] font-semibold tabular-nums leading-tight text-[#B85C68]">{timeStr}</span>
      </div>

      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5">
        <div className={`flex min-w-0 items-start ${et === 'training' ? 'gap-2' : 'gap-1.5'}`}>
          <div className="shrink-0 pt-0.5">{iconSlot}</div>
          {titleText}
        </div>
        {line2}
        {line3}
      </div>

      <div className="relative z-[1] flex shrink-0 flex-col items-end justify-between gap-1 py-0.5 pl-1">
        {hasTrailing ? <div className="min-w-0 [&>*]:origin-top-right">{trailing}</div> : null}
        {clickable ? (
          <span className="text-[17px] font-light leading-none text-white/22" aria-hidden>
            ›
          </span>
        ) : null}
      </div>
    </div>
  );
}
