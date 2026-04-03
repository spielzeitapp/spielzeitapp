import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTeamIdsForUser } from '../notifications/inboxScope';
import {
  markNotificationReadLocal,
  readNotificationReadSet,
} from '../notificationsInAppRead';

/**
 * Markiert gelesen (client-only localStorage — kein `notifications.user_id` / kein DB-`read` nötig).
 */
export async function markNotificationAsRead(
  client: SupabaseClient,
  notificationId: string,
): Promise<{ error: Error | null }> {
  const { data: auth } = await client.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) {
    return { error: new Error('Not authenticated') };
  }
  markNotificationReadLocal(uid, notificationId);
  return { error: null };
}

/** Ungelesene In-App-Einträge (teambezogen + localStorage). */
export async function countUnreadMessagesForUser(
  client: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: Error | null }> {
  const teamIds = await fetchTeamIdsForUser(client, userId);
  if (teamIds.length === 0) {
    return { count: 0, error: null };
  }
  const { data, error } = await client
    .from('notifications')
    .select('id')
    .in('team_id', teamIds);
  if (error) {
    return { count: 0, error: new Error(error.message) };
  }
  const readSet = readNotificationReadSet(userId);
  const unread = (data ?? []).filter((r) => !readSet.has((r as { id: string }).id)).length;
  return { count: unread, error: null };
}

/** Termin-Reminder (`event_type = 'reminder'`), falls Spalte vorhanden. */
export async function countUnreadTerminMessagesForUser(
  client: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: Error | null }> {
  const teamIds = await fetchTeamIdsForUser(client, userId);
  if (teamIds.length === 0) {
    return { count: 0, error: null };
  }
  const { data, error } = await client
    .from('notifications')
    .select('id')
    .in('team_id', teamIds)
    .eq('event_type', 'reminder');
  if (error) {
    return { count: 0, error: new Error(error.message) };
  }
  const readSet = readNotificationReadSet(userId);
  const unread = (data ?? []).filter((r) => !readSet.has((r as { id: string }).id)).length;
  return { count: unread, error: null };
}
