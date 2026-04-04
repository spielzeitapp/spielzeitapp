import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hilfsfunktion: Team-IDs des Users (Memberships). Wird nicht mehr für die Notifications-Inbox
 * verwendet — Inbox läuft strikt über `notifications.user_id = auth.uid()` in Queries und RLS.
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

