import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Setzt messages.read und read_at (RLS: nur eigene Zeilen).
 */
export async function markNotificationAsRead(
  client: SupabaseClient,
  notificationId: string,
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await client
    .from('messages')
    .update({ read: true, read_at: now })
    .eq('id', notificationId);

  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

/** Ungelesene Nachrichten (gesamte App) — zählt Zeilen mit read ≠ true */
export async function countUnreadMessagesForUser(
  client: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await client
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or('read.is.null,read.eq.false');

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }
  return { count: count ?? 0, error: null };
}

/** Nur Termine: notification_kind match | training | event */
export async function countUnreadTerminMessagesForUser(
  client: SupabaseClient,
  userId: string,
): Promise<{ count: number; error: Error | null }> {
  const { count, error } = await client
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or('read.is.null,read.eq.false')
    .in('notification_kind', ['match', 'training', 'event']);

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }
  return { count: count ?? 0, error: null };
}
