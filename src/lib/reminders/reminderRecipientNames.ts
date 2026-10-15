import type { SupabaseClient } from '@supabase/supabase-js';
import type { RawEventRow } from '../notifications/eventTypes';
import { collectReminderChildNames } from '../../../supabase/functions/send-reminders/recipientCopy';
import { isEligibleForReminder } from '../../../supabase/functions/send-reminders/recipientEligibility';

export async function fetchReminderChildNames(
  admin: SupabaseClient,
  event: RawEventRow,
  userIds: string[],
  kind: string,
): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();
  const [members, guardians, roster, attendance] = await Promise.all([
    admin.from('memberships').select('user_id, role').eq('team_season_id', event.team_season_id).in('user_id', userIds),
    admin.from('player_guardians').select('user_id, player_id').in('user_id', userIds),
    admin.from('team_season_players').select('player_id').eq('team_season_id', event.team_season_id).is('left_at', null),
    admin.from('event_attendance').select('player_id, status').eq('event_id', event.id),
  ]);
  for (const result of [members, guardians, roster, attendance]) if (result.error) throw result.error;
  const ids = [...new Set((roster.data ?? []).map(row => row.player_id as string))];
  if (ids.length === 0) return new Map();
  const { data: players, error } = await admin.from('players')
    .select('id, first_name, last_name, is_injured, injured_since, injured_until').in('id', ids);
  if (error) throw error;
  const statuses = new Map((attendance.data ?? []).map(row => [row.player_id, row.status]));
  const eligible = (players ?? []).filter(player => kind === 'event' || isEligibleForReminder(kind, statuses.get(player.id), player, event.starts_at));
  return collectReminderChildNames(members.data ?? [], guardians.data ?? [], eligible);
}
