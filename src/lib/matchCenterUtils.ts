import type { EventRow } from '../hooks/useEvents';
import { isEventPubliclyVisible } from './championshipVisibility';
import { safeText } from './safeText';

export type MatchCenterCountdown = {
  days: number;
  hours: number;
  minutes: number;
};

export const RUDOLF_STEUrer_DEMO_PARTICIPANTS = [
  'FK Austria Wien U12',
  'SV Ried U12',
  'First Vienna U12',
  'ASK Wilhelmsburg U12',
  'NSG Rohrbach U12',
  'NSG Hainfeld U12',
  'TSV Hartberg U12',
  'SV Mattersburg U12',
  'Fortuna Wr. Neustadt U12',
] as const;

function isCanceledOrFinished(e: EventRow): boolean {
  const st = e.status ?? 'upcoming';
  return st === 'finished' || st === 'canceled';
}

function isUpcomingSportingCandidate(e: EventRow, nowMs: number): boolean {
  if (!isEventPubliclyVisible(e)) return false;
  if (isCanceledOrFinished(e)) return false;
  if ((e.status ?? 'upcoming') === 'live') return false;
  if (!e.starts_at) return false;
  if (new Date(e.starts_at).getTime() < nowMs) return false;
  return e.kind === 'match' || e.kind === 'tournament';
}

/** Nächstes kommendes Ligaspiel (kind match), start_time in der Zukunft. */
export function pickNextUpcomingMatch(events: EventRow[], now: Date): EventRow | null {
  const nowMs = now.getTime();
  const matches = events
    .filter((e) => e.kind === 'match' && isUpcomingSportingCandidate(e, nowMs))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return matches[0] ?? null;
}

/** Nächstes kommendes Turnier (kind tournament), start_time in der Zukunft. */
export function pickNextUpcomingTournament(events: EventRow[], now: Date): EventRow | null {
  const nowMs = now.getTime();
  const tournaments = events
    .filter((e) => e.kind === 'tournament' && isUpcomingSportingCandidate(e, nowMs))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return tournaments[0] ?? null;
}

/**
 * Chronologisch nächstes sportliches Event (Turnier / Meisterschaft / Vorbereitung).
 * Trainings und sonstige Termine zählen nicht. Zeitlich, nicht nach Eventtyp.
 */
export function pickNextSportingEvent(events: EventRow[], now: Date): EventRow | null {
  const nowMs = now.getTime();
  const upcoming = events
    .filter((e) => isUpcomingSportingCandidate(e, nowMs))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return upcoming[0] ?? null;
}

function isSameViennaCalendarDay(isoA: string, isoB: Date): boolean {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Vienna',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  const dayA = fmt(new Date(isoA));
  const dayB = fmt(isoB);
  return dayA === dayB && dayA !== 'Invalid Date';
}

/**
 * Aktives Turnier HEUTE (oder kürzlich gestartet), auch wenn starts_at schon vorbei ist.
 * Verhindert, dass ein Meisterschaftsspiel in Wochen den Live-Tab übernimmt.
 */
export function pickActiveTournamentDayEvent(events: EventRow[], now: Date): EventRow | null {
  const nowMs = now.getTime();
  const candidates = events
    .filter((e) => {
      if (e.kind !== 'tournament') return false;
      if (!isEventPubliclyVisible(e)) return false;
      if (isCanceledOrFinished(e)) return false;
      if (!e.starts_at?.trim()) return false;
      const startMs = new Date(e.starts_at).getTime();
      if (Number.isNaN(startMs)) return false;
      if (isSameViennaCalendarDay(e.starts_at, now)) return true;
      const hoursSinceStart = (nowMs - startMs) / 3_600_000;
      return startMs <= nowMs && hoursSinceStart <= 36;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return candidates[0] ?? null;
}

export function computeMatchCenterCountdown(
  startsAtIso: string | null | undefined,
  now: Date,
): MatchCenterCountdown | null {
  if (!safeText(startsAtIso)) return null;
  const target = new Date(String(startsAtIso)).getTime();
  if (Number.isNaN(target)) return null;
  let diff = Math.max(0, target - now.getTime());
  const days = Math.floor(diff / 86_400_000);
  diff -= days * 86_400_000;
  const hours = Math.floor(diff / 3_600_000);
  diff -= hours * 3_600_000;
  const minutes = Math.floor(diff / 60_000);
  return { days, hours, minutes };
}

export function isRudolfSteurerGedenkturnier(title: unknown): boolean {
  const t = safeText(title).toLowerCase();
  return t.includes('rudolf steurer') || t.includes('gedenkturnier');
}

export function isHeimteamParticipant(teamName: unknown): boolean {
  const n = safeText(teamName).toLowerCase();
  return n.includes('nsg rohrbach') || n.includes('nsg hainfeld');
}
