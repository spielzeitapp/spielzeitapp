import type { SupabaseClient } from '@supabase/supabase-js';

type AttendanceStatus = 'yes' | 'no';

type EventAttendancePayload = {
  event_id: string;
  player_id: string;
  status: AttendanceStatus;
};

export async function upsertEventAttendanceMinimal(
  supabase: SupabaseClient,
  payload: EventAttendancePayload,
) {
  console.log('event_attendance payload', payload);
  console.log('[ATTENDANCE FLOW] final table access', {
    table: 'event_attendance',
    operation: 'upsert',
    onConflict: 'event_id,player_id',
    payloadKeys: Object.keys(payload),
  });

  return supabase
    .from('event_attendance')
    .upsert(payload, { onConflict: 'event_id,player_id' })
    .select('event_id, player_id, status');
}
