import type { EventRow } from '../../hooks/useEvents';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { formatFullLocation, splitCombinedLocation } from '../../lib/eventLocation';
import { getMatchTypeLabel } from '../match/matchCardLabels';

export type EffectiveEventType = 'game' | 'training' | 'event' | 'other';

export function formatHeroDateParts(iso: string | null | undefined): { wd: string; day: string; mon: string } {
  if (!iso?.trim()) return { wd: '—', day: '–', mon: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { wd: '—', day: '–', mon: '' };
  const wd = new Intl.DateTimeFormat('de-AT', { weekday: 'short', timeZone: VIENNA_TZ }).format(d);
  const day = new Intl.DateTimeFormat('de-AT', { day: '2-digit', timeZone: VIENNA_TZ }).format(d);
  const mon = new Intl.DateTimeFormat('de-AT', { month: 'short', timeZone: VIENNA_TZ }).format(d);
  return {
    wd: wd.replace(/\.$/, '').toUpperCase(),
    day,
    mon: mon.replace(/\.$/, '').toUpperCase(),
  };
}

/** Eltern-Kompaktkarte: zweibuchstabiger Wochentag (MO … SO), spart Breite. */
const DE_WEEKDAY_LONG_TO_ABBREV: Record<string, string> = {
  montag: 'MO',
  dienstag: 'DI',
  mittwoch: 'MI',
  donnerstag: 'DO',
  freitag: 'FR',
  samstag: 'SA',
  sonntag: 'SO',
};

export function formatCompactListWeekdayAbbrev(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const wd = new Intl.DateTimeFormat('de-AT', { weekday: 'long', timeZone: VIENNA_TZ }).format(d);
  const key = wd.replace(/\.$/, '').trim().toLowerCase();
  return DE_WEEKDAY_LONG_TO_ABBREV[key] ?? wd.replace(/\.$/, '').slice(0, 2).toUpperCase();
}

/** Kompakte Terminliste: voller Wochentag, großer Tag, Monat + Jahr (z. B. MAI 2026). */
export function formatCompactListDateParts(iso: string | null | undefined): {
  wd: string;
  day: string;
  monYear: string;
} {
  if (!iso?.trim()) return { wd: '—', day: '–', monYear: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { wd: '—', day: '–', monYear: '' };
  const wd = new Intl.DateTimeFormat('de-AT', { weekday: 'long', timeZone: VIENNA_TZ }).format(d);
  const day = new Intl.DateTimeFormat('de-AT', { day: '2-digit', timeZone: VIENNA_TZ }).format(d);
  const monYear = new Intl.DateTimeFormat('de-AT', {
    month: 'short',
    year: 'numeric',
    timeZone: VIENNA_TZ,
  }).format(d);
  return {
    wd: wd.replace(/\.$/, '').toUpperCase(),
    day,
    monYear: monYear.replace(/\.$/g, '').replace(/\s+/g, ' '),
  };
}

export function formatTimeHHmmDe(iso: string | null | undefined): string {
  if (!iso?.trim()) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function eventNotesTitle(notes: string | null | undefined): string | null {
  const t = (notes ?? '')
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean)[0];
  return t || null;
}

export function scheduleEventTypeLabel(ev: EventRow, et: EffectiveEventType): string {
  if (et === 'game') return getMatchTypeLabel(ev.match_type) ?? 'Spiel';
  if (et === 'training') return 'Training';
  return eventNotesTitle(ev.notes) ?? 'Event';
}

export function scheduleLocationLine(ev: EventRow): string {
  const parsed = splitCombinedLocation(ev.location ?? '');
  const addrExtra = (ev as { address?: string | null }).address ?? null;
  return formatFullLocation(parsed.place, parsed.address || addrExtra);
}

/** Titelzeile für kompakte Liste (eine Zeile). */
export function scheduleCompactPrimaryTitle(ev: EventRow, et: EffectiveEventType, ourClubDisplay: string): string {
  if (et === 'game') {
    const opp = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
    return opp;
  }
  if (et === 'training') return eventNotesTitle(ev.notes) ?? 'Training';
  return eventNotesTitle(ev.notes) ?? 'Termin';
}

/** Untertitel: Spielart bzw. Kurzinfo. */
export function scheduleCompactSecondaryLine(ev: EventRow, et: EffectiveEventType): string {
  if (et === 'game') {
    const type = getMatchTypeLabel(ev.match_type);
    return type ?? '';
  }
  if (et === 'training') return 'Training';
  return scheduleEventTypeLabel(ev, et);
}

/** „Ende: …“ aus notes (Training), für Ende-Pill. */
export function eventTrainingEndDisplay(notes: string | null | undefined): string | null {
  const endRaw = (notes ?? '')
    .split(' · ')
    .find((p) => p.toLowerCase().startsWith('ende:'));
  if (!endRaw) return null;
  const v = endRaw
    .replace(/^ende:\s*/i, '')
    .replace(/\s*uhr\s*$/i, '')
    .trim();
  return v || null;
}

/** Meta-Toolbar: Zeit mit „Uhr“ (kein doppeltes „Uhr Uhr“). */
export function scheduleMetaTimeDisplay(raw: string | null | undefined, emptyLabel = 'Offen'): string {
  if (!raw?.trim()) return emptyLabel;
  const v = raw.trim();
  if (/\buhr\s*$/i.test(v)) return v;
  return `${v} Uhr`;
}

export function gameTeamNames(
  ev: EventRow,
  et: EffectiveEventType,
  ourClubDisplay: string,
): { left: string; right: string } {
  const opp = (ev.opponent ?? 'Gegner').trim() || 'Gegner';
  if (et !== 'game') return { left: ourClubDisplay, right: opp };
  if (ev.is_home === true) return { left: ourClubDisplay, right: opp };
  if (ev.is_home === false) return { left: opp, right: ourClubDisplay };
  return { left: ourClubDisplay, right: opp };
}
