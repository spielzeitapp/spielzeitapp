/** Langfristige Spieler-Verfügbarkeit (LAZ, Verletzung). */

export type PlayerAvailabilityFlags = {
  is_injured?: boolean;
  injured_since?: string | null;
  injured_until?: string | null;
  is_laz_player?: boolean;
};

export function hasExplicitAttendanceRow(raw: string | null | undefined): boolean {
  return raw != null && String(raw).trim() !== '';
}

export function isUpcomingEvent(
  eventStartsAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!eventStartsAtIso) return false;
  const starts = Date.parse(eventStartsAtIso);
  return Number.isFinite(starts) && starts >= nowMs;
}

export function isPlayerAutoInjuredForEvent(
  player: PlayerAvailabilityFlags | null | undefined,
  eventStartsAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!player?.is_injured) return false;
  if (!isUpcomingEvent(eventStartsAtIso, nowMs)) return false;

  const starts = Date.parse(eventStartsAtIso!);
  if (!Number.isFinite(starts)) return false;

  if (player.injured_since) {
    const since = Date.parse(player.injured_since);
    if (Number.isFinite(since) && starts < since) return false;
  }

  if (player.injured_until) {
    const until = Date.parse(player.injured_until);
    if (Number.isFinite(until) && starts > until) return false;
  }

  return true;
}

export type PlayerAvailabilityStatusLabel = 'Aktiv' | 'Verletzt' | 'LAZ';

export function resolvePlayerAvailabilityStatusLabel(
  player: PlayerAvailabilityFlags,
): PlayerAvailabilityStatusLabel {
  if (player.is_injured) return 'Verletzt';
  if (player.is_laz_player) return 'LAZ';
  return 'Aktiv';
}

export type MatchRsvpDisplayStatus = 'yes' | 'no' | 'sick' | 'injured' | 'external_training' | 'unset';

/** Spiel-/Turnier-RSVP: explizite Zeile hat Vorrang; sonst Verletzten-Flag für Zukunft. */
export function resolveMatchEventRsvpStatus(
  rawDbStatus: string | null | undefined,
  player: PlayerAvailabilityFlags | null | undefined,
  eventStartsAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): MatchRsvpDisplayStatus {
  const s = String(rawDbStatus ?? '').trim().toLowerCase();
  if (s === 'yes') return 'yes';
  if (s === 'no') return 'no';
  if (s === 'sick') return 'sick';
  if (s === 'injured') return 'injured';
  if (s === 'external_training') return 'external_training';
  if (player && isPlayerAutoInjuredForEvent(player, eventStartsAtIso, nowMs)) return 'injured';
  return 'unset';
}

export function playerAvailabilityFromItem(player: {
  is_injured?: boolean;
  injured_since?: string | null;
  injured_until?: string | null;
  is_laz_player?: boolean;
}): PlayerAvailabilityFlags {
  return {
    is_injured: player.is_injured === true,
    injured_since: player.injured_since ?? null,
    injured_until: player.injured_until ?? null,
    is_laz_player: player.is_laz_player === true,
  };
}

export function buildPlayerAvailabilityMap(
  players: Array<{ id: string } & PlayerAvailabilityFlags>,
): Record<string, PlayerAvailabilityFlags> {
  const map: Record<string, PlayerAvailabilityFlags> = {};
  for (const p of players) {
    map[p.id.toLowerCase()] = playerAvailabilityFromItem(p);
  }
  return map;
}
