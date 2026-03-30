import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Inbox-Filter für `public.notifications` (gleiches Modell wie RLS):
 * - Zeilen mit `user_id = aktueller User` (z. B. Reminder pro Empfänger)
 * - teamweite Zeilen (`user_id` IS NULL) für Mannschaften, in denen der User Mitglied ist
 *
 * Entspricht dem älteren API-Pfad GET /api/notifications?team_id=… (teambezogen)
 * plus den neuen user-spezifischen Reminder-Zeilen — ohne zweite Tabelle.
 */
export async function fetchTeamIdsForUser(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from('memberships')
    .select('team_seasons(team_id)')
    .eq('user_id', userId);

  if (error) {
    console.warn('[inboxScope] fetchTeamIdsForUser', error.message ?? error);
    return [];
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const tid = (row as { team_seasons?: { team_id?: string | null } | null }).team_seasons?.team_id;
    if (tid) ids.add(tid);
  }
  return [...ids];
}

/**
 * PostgREST-`.or()`-String: sichtbare Einträge für Badge + Liste.
 */
export function notificationsInboxOrFilter(userId: string, teamIds: string[]): string {
  if (teamIds.length === 0) {
    return `user_id.eq.${userId}`;
  }
  const inList = teamIds.join(',');
  return `user_id.eq.${userId},and(user_id.is.null,team_id.in.(${inList}))`;
}
