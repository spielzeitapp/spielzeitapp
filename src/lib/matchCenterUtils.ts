import type { EventRow } from '../hooks/useEvents';
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

/** Nächstes kommendes Ligaspiel (kind match), start_time in der Zukunft. */
export function pickNextUpcomingMatch(events: EventRow[], now: Date): EventRow | null {
  const nowMs = now.getTime();
  const matches = events
    .filter((e) => {
      if (e.kind !== 'match') return false;
      if (isCanceledOrFinished(e)) return false;
      if ((e.status ?? 'upcoming') === 'live') return false;
      if (!e.starts_at) return false;
      return new Date(e.starts_at).getTime() >= nowMs;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return matches[0] ?? null;
}

/** Nächstes kommendes Turnier (kind tournament), start_time in der Zukunft. */
export function pickNextUpcomingTournament(events: EventRow[], now: Date): EventRow | null {
  const nowMs = now.getTime();
  const tournaments = events
    .filter((e) => {
      if (e.kind !== 'tournament') return false;
      if (isCanceledOrFinished(e)) return false;
      if ((e.status ?? 'upcoming') === 'live') return false;
      if (!e.starts_at) return false;
      return new Date(e.starts_at).getTime() >= nowMs;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return tournaments[0] ?? null;
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
