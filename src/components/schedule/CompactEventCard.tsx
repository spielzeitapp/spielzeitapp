import React, { useState } from 'react';
import { CalendarDays, MapPin, Trophy } from 'lucide-react';
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
  eventTrainingEndDisplay,
  scheduleMetaTimeDisplay,
} from './scheduleEventViewUtils';
import { formatMeetupTimeOnlyDe } from '../match/matchCardLabels';
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

/** Kurzform für Meta-Zeile (z. B. „Meisterschaft“ statt „Meisterschaftsspiel“). */
function shortMatchTypeLabel(matchType: string | null | undefined): string | null {
  const raw = (matchType ?? '').trim();
  if (!raw) return null;
  const f = getMatchTypeLabel(matchType);
  if (!f) return null;
  if (/^Meisterschaftsspiel$/i.test(f)) return 'Meisterschaft';
  if (/^Freundschaftsspiel$/i.test(f)) return 'Freundschaft';
  if (/^Testspiel$/i.test(f)) return 'Testspiel';
  if (/^Turnier$/i.test(f)) return 'Turnier';
  return f;
}

function gameHomeAwayChipLabel(isHome: boolean | null | undefined): string | null {
  if (isHome === true) return 'Heim';
  if (isHome === false) return 'Auswärts';
  return null;
}

const GAME_CHIP_BASE_CLASS =
  'inline-flex w-fit max-w-full shrink-0 rounded-full px-2 py-px text-[11px] font-semibold leading-tight';

function gameHomeAwayChipClass(isHome: boolean | null | undefined): string {
  if (isHome === true) {
    return [
      GAME_CHIP_BASE_CLASS,
      'border border-[rgba(73,190,139,0.38)] bg-[rgba(12,50,38,0.82)] text-[#7FE3B2]',
      'shadow-[0_0_10px_rgba(73,190,139,0.16)]',
    ].join(' ');
  }
  return [GAME_CHIP_BASE_CLASS, 'border border-red-500/35 text-red-300/95'].join(' ');
}

function gameMatchTypeDisplayLine(
  matchType: string | null | undefined,
): { prefix: string; label: string } | null {
  const label = shortMatchTypeLabel(matchType);
  if (!label) return null;
  const key = (matchType ?? '').trim().toLowerCase();
  const isLeague = !key || key === 'game' || key === 'league' || /^Meisterschaft$/i.test(label);
  return { prefix: isLeague ? '🏆 ' : '', label };
}

/** Weitere Termine — Spiele: Chip Heim/Auswärts + Spielart (keine kombinierte Meta-Zeile). */
function GameCompactMeta({
  isHome,
  matchType,
  className = '',
}: {
  isHome: boolean | null | undefined;
  matchType: string | null | undefined;
  className?: string;
}) {
  const homeAway = gameHomeAwayChipLabel(isHome);
  const typeLine = gameMatchTypeDisplayLine(matchType);
  if (!homeAway && !typeLine) return null;

  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      {homeAway ? (
        <span className={gameHomeAwayChipClass(isHome)}>{homeAway}</span>
      ) : null}
      {typeLine ? (
        <p className="min-w-0 whitespace-normal break-words text-[13px] leading-tight text-white/72">
          {typeLine.prefix}
          {typeLine.label}
        </p>
      ) : null}
    </div>
  );
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
  if (et === 'tournament') {
    return 'border border-purple-500/35 bg-purple-900/55 text-purple-100/95';
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

  const trainingTitle =
    et === 'training' ? (compactTrainingHeadline(ourTeamName, trainingNotesTitle) ?? 'Training') : null;
  const trainingTitleLines = splitTrainingTitleLines(trainingTitle);
  const tournamentTitle = et === 'tournament' ? (trainingNotesTitle ?? 'Turnier') : null;
  const tournamentEndLabel = et === 'tournament' ? eventTrainingEndDisplay(ev.notes) : null;
  const meetupLabel =
    et === 'tournament' && ev.meeting_at ? formatMeetupTimeOnlyDe(ev.meeting_at) : null;
  const hasTrailing = Boolean(trailing);
  const oppSrc = getClubLogo(oppName, { logoUrl: opponentLogoUrl ?? undefined });
  const inlineTypeIcon =
    et === 'game' ? (
      <CompactOpponentLogo src={oppSrc} />
    ) : et === 'training' ? (
      <TrainingPlayerIcon variant="list" />
    ) : et === 'tournament' ? (
      <Trophy className="h-5 w-5 shrink-0 text-amber-300/90" strokeWidth={2} aria-hidden />
    ) : (
      <CalendarDays className="h-5 w-5 shrink-0 text-red-200/85" />
    );

  if (parentCompactLayout) {
    const wdAbbrev = formatCompactListWeekdayAbbrev(ev.starts_at);
    const parentTitle =
      et === 'game' ? oppName : et === 'training' ? trainingTitle : et === 'tournament' ? tournamentTitle : title;

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
        {et === 'training' ? <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(122,29,42,0.07)_0%,transparent_60%)]" aria-hidden /> : null}
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
            ) : et === 'game' ? (
              <div className="min-w-0 flex-1">
                <p
                  className="min-w-0 line-clamp-2 text-[17px] font-semibold leading-tight text-white break-normal hyphens-none [overflow-wrap:normal]"
                  lang="de"
                >
                  {oppName}
                </p>
                <GameCompactMeta
                  isHome={ev.is_home}
                  matchType={ev.match_type}
                  className="mt-0.5"
                />
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

  const venueIsShort = Boolean(venueOnly && venueOnly.length <= 24);

  const typeBadgeLabelOther =
    et !== 'game' && et !== 'training' && et !== 'tournament'
      ? (scheduleEventTypeLabel(ev, et) ?? 'Termin').toUpperCase()
      : et === 'tournament'
        ? 'TURNIER'
        : null;

  const iconSlot =
    et === 'game' ? (
      <CompactOpponentLogo src={oppSrc} />
    ) : et === 'training' ? (
      <TrainingPlayerIcon variant="list" />
    ) : et === 'tournament' ? (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-950/45">
        <Trophy className="h-5 w-5 text-amber-300/90" strokeWidth={2} aria-hidden />
      </span>
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
        <>
          <p className={titleClamp} lang="de">
            {oppName}
          </p>
          <GameCompactMeta isHome={ev.is_home} matchType={ev.match_type} className="mt-0.5" />
        </>
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
      ) : et === 'tournament' ? (
        <p className={titleClamp} lang="de">
          {tournamentTitle}
        </p>
      ) : (
        <p className={titleClamp} lang="de">
          {title}
        </p>
      )}
    </div>
  );

  const line2 =
    et !== 'game' && et !== 'training' && typeBadgeLabelOther ? (
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
          className={`min-w-0 text-[14px] leading-tight text-white/72 line-clamp-2 ${
            venueIsShort ? 'whitespace-nowrap' : 'whitespace-normal'
          }`}
          title={venueOnly}
        >
          {venueOnly}
        </p>
      ) : (
        <p className="flex min-h-0 min-w-0 max-w-full items-center gap-1 text-[14px] font-medium leading-snug text-white/72 line-clamp-2">
          <MapPin className="h-3 w-3 shrink-0 text-rose-300/70" aria-hidden />
          <span className="min-w-0 flex-1" title={venueOnly}>
            {venueOnly}
          </span>
        </p>
      )
    ) : null;

  if (et === 'tournament' && !parentCompactLayout) {
    return (
      <div
        className={[
          'relative mb-2 -mx-1 grid w-[calc(100%+0.5rem)] min-w-0 grid-cols-[78px_58px_minmax(0,1fr)_54px_20px] items-center gap-x-0 overflow-x-hidden px-2.5 py-2 sm:mx-0 sm:w-full',
          dsScheduleListPanelClass(),
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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(88,28,135,0.12)_0%,transparent_60%)]" aria-hidden />
        <div className={dsScheduleListPanelGlowClass()} aria-hidden />
        <div className={`${dsScheduleDateBoxClass()} relative z-[1] shrink-0 !w-[78px]`}>
          <span className={dsScheduleDateBoxWeekdayClass()}>{wd}</span>
          <span className={`${dsScheduleDateBoxDayClass()} !text-[1.45rem]`}>{day}</span>
          <span className={`${dsScheduleDateBoxMonthClass()} !text-[9px]`}>{monYear}</span>
          <span className="text-[11px] font-semibold tabular-nums leading-tight text-purple-300/90">{timeStr}</span>
        </div>

        <div className="relative z-[1] flex w-[58px] shrink-0 items-center justify-center self-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/35 bg-purple-950/50 text-lg shadow-[0_0_12px_rgba(168,85,247,0.2)]">
            <Trophy className="h-5 w-5 text-amber-300/95" strokeWidth={2} aria-hidden />
          </span>
        </div>

        <div className="relative z-[1] min-w-0 overflow-hidden py-0.5">
          <p className="line-clamp-2 text-[18px] font-semibold leading-[1.05] text-white" lang="de">
            {tournamentTitle}
          </p>
          <span
            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${eventTypeBadgeClass(et)}`}
          >
            Turnier
          </span>
          <p className="mt-1 text-[13px] leading-snug text-white/72">
            {meetupLabel ? `Treffpunkt ${meetupLabel}` : 'Treffpunkt —'}
            {tournamentEndLabel
              ? ` · Ende ${scheduleMetaTimeDisplay(tournamentEndLabel)}`
              : ` · Beginn ${scheduleMetaTimeDisplay(timeStr)}`}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-white/65">
            {venueOnly ?? 'Ort —'}
          </p>
          {clickable ? (
            <p className="mt-1 text-[12px] font-semibold text-purple-200/85">Turnier öffnen ›</p>
          ) : null}
        </div>

        <div className="relative z-[1] flex w-[54px] shrink-0 items-center justify-center self-center">
          {hasTrailing ? <div className="min-w-0 [&>*]:origin-center">{trailing}</div> : null}
        </div>

        <div className="relative z-[1] flex w-5 shrink-0 items-center justify-center self-center">
          {clickable ? (
            <span className="text-[15px] font-light leading-none text-white/25" aria-hidden>
              ›
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (et === 'training' && !parentCompactLayout) {
    return (
      <div
        className={[
          'relative mb-2 -mx-1 grid w-[calc(100%+0.5rem)] min-w-0 grid-cols-[78px_58px_minmax(0,1fr)_54px_20px] items-center gap-x-0 overflow-x-hidden px-2.5 py-2 sm:mx-0 sm:w-full',
          dsScheduleListPanelClass(),
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
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(122,29,42,0.07)_0%,transparent_60%)]" aria-hidden />
        <div className={dsScheduleListPanelGlowClass()} aria-hidden />
        <div className={`${dsScheduleDateBoxClass()} relative z-[1] shrink-0 !w-[78px]`}>
          <span className={dsScheduleDateBoxWeekdayClass()}>{wd}</span>
          <span className={`${dsScheduleDateBoxDayClass()} !text-[1.45rem]`}>{day}</span>
          <span className={`${dsScheduleDateBoxMonthClass()} !text-[9px]`}>{monYear}</span>
          <span className="text-[11px] font-semibold tabular-nums leading-tight text-[#B85C68]">{timeStr}</span>
        </div>

        <div className="relative z-[1] flex w-[58px] shrink-0 items-center justify-center self-center">
          <TrainingPlayerIcon variant="list" />
        </div>

        <div className="relative z-[1] min-w-0 overflow-hidden py-0.5">
          <p className="text-[18px] font-semibold leading-[1.05] text-white" lang="de">
            {trainingTitleLines.top}
          </p>
          {trainingTitleLines.bottom ? (
            <p className="text-[18px] font-semibold leading-[1.05] text-white" lang="de">
              {trainingTitleLines.bottom}
            </p>
          ) : null}
          <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug text-white/[0.72]">
            {venueOnly ?? '—'}
          </p>
        </div>

        <div className="relative z-[1] flex w-[54px] shrink-0 items-center justify-center self-center">
          {hasTrailing ? <div className="min-w-0 [&>*]:origin-center">{trailing}</div> : null}
        </div>

        <div className="relative z-[1] flex w-5 shrink-0 items-center justify-center self-center">
          {clickable ? (
            <span className="text-[15px] font-light leading-none text-white/25" aria-hidden>
              ›
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  const listGridCols = 'grid-cols-[78px_46px_minmax(0,1fr)_48px_20px]';

  const listIconColumn = (
    <div className="flex w-[46px] shrink-0 items-center justify-center self-center">
      {iconSlot}
    </div>
  );

  const listTextColumn = (
    <div className="ml-3 min-w-0 overflow-hidden">
      {titleText}
      {line2}
      {line3}
    </div>
  );

  return (
    <div
      className={[
        `relative mb-2 -mx-1 grid w-[calc(100%+0.5rem)] min-w-0 ${listGridCols} items-center gap-x-0 overflow-x-hidden px-2.5 py-1.5 sm:mx-0 sm:w-full ${dsScheduleListPanelClass()}`,
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
      <div className={`${dsScheduleDateBoxClass()} relative z-[1] shrink-0 !w-[78px]`}>
        <span className={dsScheduleDateBoxWeekdayClass()}>{wd}</span>
        <span className={`${dsScheduleDateBoxDayClass()} !text-[1.45rem]`}>{day}</span>
        <span className={`${dsScheduleDateBoxMonthClass()} !text-[9px]`}>{monYear}</span>
        <span className="text-[11px] font-semibold tabular-nums leading-tight text-[#B85C68]">{timeStr}</span>
      </div>

      {listIconColumn}

      <div className="relative z-[1] flex min-w-0 flex-col justify-center py-0.5">{listTextColumn}</div>

      <div className="relative z-[1] flex w-[48px] shrink-0 items-center justify-center self-center">
        {hasTrailing ? <div className="min-w-0 [&>*]:origin-center">{trailing}</div> : null}
      </div>

      <div className="relative z-[1] flex w-5 shrink-0 items-center justify-center self-center">
        {clickable ? (
          <span className="text-[15px] font-light leading-none text-white/25" aria-hidden>
            ›
          </span>
        ) : null}
      </div>
    </div>
  );
}
