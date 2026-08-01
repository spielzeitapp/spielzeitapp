import { supabase } from './supabaseClient';

function ignorableSchemaError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const m = String(err.message ?? '').toLowerCase();
  if (m.includes('does not exist') || m.includes('schema cache')) return true;
  if (m.includes('could not find the table')) return true;
  return false;
}

async function tryDelete(description: string, run: () => Promise<{ error: { message?: string; code?: string } | null }>): Promise<void> {
  const { error } = await run();
  if (error && !ignorableSchemaError(error)) {
    console.warn(`[deleteEventCascade] ${description}:`, error.message ?? error);
  }
}

/**
 * Löscht einen Kalender-Termin inkl. Match-Daten (best effort, keine Migration).
 * Reihenfolge: Match-Kinder → Match → Event-Zuordnungen → Event.
 */
export async function deleteEventAndRelatedData(eventId: string, matchId: string | null): Promise<{ error: string | null }> {
  const eid = String(eventId ?? '').trim();
  if (!eid) return { error: 'Keine Event-ID.' };
  const mid = matchId ? String(matchId).trim() : '';

  if (mid) {
    const { error: unlinkErr } = await supabase.from('events').update({ match_id: null }).eq('id', eid);
    if (unlinkErr) return { error: unlinkErr.message };

    await tryDelete('match_events', () => supabase.from('match_events').delete().eq('match_id', mid));
    await tryDelete('match_lineup', () => supabase.from('match_lineup').delete().eq('match_id', mid));
    await tryDelete('match_bench', () => supabase.from('match_bench').delete().eq('match_id', mid));
    await tryDelete('match_lineup_slots', () => supabase.from('match_lineup_slots').delete().eq('match_id', mid));
    await tryDelete('match_lineup_snapshots', () =>
      supabase.from('match_lineup_snapshots').delete().eq('match_id', mid),
    );
    await tryDelete('match_rsvps', () => supabase.from('match_rsvps').delete().eq('match_id', mid));
    await tryDelete('match_attendance', () => supabase.from('match_attendance').delete().eq('match_id', mid));
    await tryDelete('motm_votes', () => supabase.from('motm_votes').delete().eq('match_id', mid));
    await tryDelete('motm_match_leaderboard', () =>
      supabase.from('motm_match_leaderboard').delete().eq('match_id', mid),
    );
    await tryDelete('availability', () => supabase.from('availability').delete().eq('match_id', mid));

    const { error: delMatchErr } = await supabase.from('matches').delete().eq('id', mid);
    if (delMatchErr && !ignorableSchemaError(delMatchErr)) {
      return { error: delMatchErr.message };
    }
  }

  await tryDelete('event_attendance', () => supabase.from('event_attendance').delete().eq('event_id', eid));
  await tryDelete('team_feed_posts', () => supabase.from('team_feed_posts').delete().eq('event_id', eid));
  await tryDelete('notification_jobs', () => supabase.from('notification_jobs').delete().eq('event_id', eid));
  await tryDelete('notifications', () => supabase.from('notifications').delete().eq('event_id', eid));

  const { error: evErr } = await supabase.from('events').delete().eq('id', eid);
  if (evErr) return { error: evErr.message };
  return { error: null };
}
