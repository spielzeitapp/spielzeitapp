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

/** Match-/Event-Karten: nur aktiver Kader; Verletzte separat, niemals offen. */
export function matchScheduleCardCounts(params: {
  rosterPlayerIds: string[];
  availabilityByPlayerId?: Record<string, string | null | undefined>;
  startsAtIso?: string | null;
  playerAvailabilityById?: Record<string, PlayerAvailabilityFlags | undefined>;
  nowMs?: number;
}): { yes: number; no: number; open: number; injured: number } {
  const counts = { yes: 0, no: 0, open: 0, injured: 0 };
  const nowMs = params.nowMs ?? Date.now();
  for (const key of new Set(params.rosterPlayerIds.map((id) => id.toLowerCase()))) {
    const status = resolveMatchEventRsvpStatus(
      params.availabilityByPlayerId?.[key],
      params.playerAvailabilityById?.[key],
      params.startsAtIso,
      nowMs,
    );
    if (status === 'yes') counts.yes += 1;
    else if (status === 'injured') counts.injured += 1;
    else if (status === 'unset') counts.open += 1;
    else counts.no += 1;
  }
  return counts;
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
