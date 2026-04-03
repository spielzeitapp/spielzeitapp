import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTeamIdsForUser } from '../notifications/inboxScope';

/**
 * notifications.read (DB) — nur teambezogene Zeilen des Nutzers zählen.
 */
export async function markNotificationAsRead(
  client: SupabaseClient,
  notificationId: string,
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export async function countUnreadMessagesForUser(
  client: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: Error | null }> {
  const teamIds = await fetchTeamIdsForUser(client, userId);
  if (teamIds.length === 0) {
    return { count: 0, error: null };
  }
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('team_id', teamIds)
    .eq('read', false);

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }
  return { count: count ?? 0, error: null };
}

export async function countUnreadTerminMessagesForUser(
  client: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: Error | null }> {
  const teamIds = await fetchTeamIdsForUser(client, userId);
  if (teamIds.length === 0) {
    return { count: 0, error: null };
  }
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('team_id', teamIds)
    .eq('read', false)
    .eq('event_type', 'reminder');

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }
  return { count: count ?? 0, error: null };
}
