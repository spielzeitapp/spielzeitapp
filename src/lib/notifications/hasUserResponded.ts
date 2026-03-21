import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getCanonicalEventType,
  getParticipationMode,
  type RawEventRow,
} from './eventTypes';
import { hasAllChildrenAnsweredGameOptIn, hasAllChildrenDeclinedTraining } from './helpers';
import { fetchPlayerIdsForUserInTeamSeason } from './users';

/**
 * Prüft, ob für diesen User am Event „kein Reminder mehr nötig“ ist:
 * - Training opt-out: alle Kinder haben abgesagt
 * - Spiel opt-in: alle Kinder haben Zu- oder Absage (ja/nein)
 */
export async function hasUserResponded(
  admin: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const { data: ev, error } = await admin.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error || !ev) return false;

  const row = ev as RawEventRow;
  const playerIds = await fetchPlayerIdsForUserInTeamSeason(admin, userId, row.team_season_id);
  if (playerIds.length === 0) return true;

  const { data: rows, error: aErr } = await admin
    .from('event_attendance')
    .select('player_id, status')
    .eq('event_id', eventId);
  if (aErr) throw aErr;

  const map = new Map((rows ?? []).map((r: { player_id: string; status: string }) => [r.player_id, r.status]));

  const ctype = getCanonicalEventType(row);
  const mode = getParticipationMode(row);

  if (ctype === 'training' && mode === 'opt_out') {
    return hasAllChildrenDeclinedTraining(playerIds, map);
  }
  if (ctype === 'game' && mode === 'opt_in') {
    return hasAllChildrenAnsweredGameOptIn(playerIds, map);
  }
  return true;
}
