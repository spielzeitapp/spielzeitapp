import { supabase } from './supabaseClient';
import type { HallDay } from './hallTraining';
export async function loadHallDay(eventId: string) {
  const result = await supabase.from('hall_training_days').select('state,revision').eq('event_id', eventId).maybeSingle();
  if (result.error) throw new Error('Hallenspieltag konnte nicht geladen werden. Bitte erneut versuchen.');
  return result.data ? { day: result.data.state as HallDay, revision: Number(result.data.revision) } : null;
}
export async function saveHallDay(eventId: string, day: HallDay, revision: number) {
  const { data, error } = await supabase.rpc('save_hall_training_day', { p_event: eventId, p_state: day, p_revision: revision });
  if (error) throw new Error(error.message.includes('neu laden') ? error.message : 'Speichern fehlgeschlagen. Bitte erneut versuchen.');
  return Number(data);
}
