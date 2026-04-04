import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * notifications.read (DB) — nur eigene Zeilen (user_id).
 */
export async function markNotificationAsRead(
  client: SupabaseClient,
  notificationId: string,
  userId: string,
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export async function countUnreadMessagesForUser(
  client: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
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
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .eq('event_type', 'reminder');

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }
  return { count: count ?? 0, error: null };
}
