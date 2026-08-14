import { canManageMatches, normalizeRole, type RoleKey } from './roles';

/** Route zur Match-Vorbereitung (Kader, Aufstellung, Feed-Automatisierung). */
export function matchPreparationPath(
  matchId: string,
  base: '/app' | '/demo' = '/app',
): string {
  return `${base}/match-preparation?matchId=${encodeURIComponent(matchId.trim())}`;
}

/** Route zur Aufstellungsseite eines Spiels. */
export function matchLineupPath(matchId: string, base: '/app' | '/demo' = '/app'): string {
  return `${base}/match-lineup?matchId=${encodeURIComponent(matchId.trim())}`;
}

/** Route zum Livespiel. */
export function liveMatchPath(matchId: string, base: '/app' | '/demo' = '/app'): string {
  return `${base}/live?matchId=${encodeURIComponent(matchId.trim())}`;
}

/** Trainer/Admin/Staff darf Match vorbereiten / Aufstellung schreiben. */
export function canMutateMatchPreparation(role: RoleKey | string | null | undefined): boolean {
  return canManageMatches(normalizeRole(role));
}

/** Kader vor Anpfiff bearbeitbar; danach nur noch Live-Wechsel. */
export function isMatchSquadEditable(params: {
  status?: string | null;
  live_started_at?: string | null;
}): boolean {
  const status = String(params.status ?? '').trim().toLowerCase();
  if (status === 'live' || status === 'finished') return false;
  if (params.live_started_at) return false;
  return true;
}

/** Nutzerfreundliche Meldung statt roher Supabase/RLS-Texte. */
export function friendlyMatchLineupWriteError(raw: string | null | undefined): string {
  const msg = String(raw ?? '').trim();
  if (!msg) return 'Aufstellung konnte nicht gespeichert werden.';
  if (/row-level security|rls|permission denied|not allowed/i.test(msg)) {
    return 'Aufstellung konnte nicht gespeichert werden.';
  }
  return msg;
}

export function isMatchPreparationAccessible(
  ...statuses: Array<string | null | undefined>
): boolean {
  return !statuses.some((raw) => {
    const s = (raw ?? '').trim().toLowerCase();
    return s === 'finished' || s === 'ended' || s === 'completed';
  });
}

/** Match beendet, Kalender-Termin noch offen (Nacharbeit / Review). */
export function isMatchReviewPending(params: {
  eventStatus?: string | null;
  matchStatus?: string | null;
}): boolean {
  const ms = String(params.matchStatus ?? '').trim().toLowerCase();
  const es = String(params.eventStatus ?? '').trim().toLowerCase();
  return ms === 'finished' && es !== 'finished' && es !== 'canceled';
}
