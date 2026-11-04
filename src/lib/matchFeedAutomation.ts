import { supabase } from './supabaseClient';

/** Missing optional settings retain the original defaults; query errors stop generation. */
export async function isMatchFeedAutomationEnabled(eventId: string, kind?: 'result' | 'lineup'): Promise<boolean> {
  const { data, error } = await supabase.from('event_feed_settings')
    .select('feed_automation_enabled, result_feed_enabled, lineup_feed_enabled').eq('event_id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.feed_automation_enabled !== false && (kind !== 'result' || data?.result_feed_enabled !== false)
    && (kind !== 'lineup' || data?.lineup_feed_enabled !== false);
}
