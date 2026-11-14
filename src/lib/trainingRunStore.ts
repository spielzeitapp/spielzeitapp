import { supabase } from './supabaseClient';
import type { TrainingRun } from './trainingRun';
export async function loadTrainingRun(sessionId: string) {
 const { data, error } = await supabase.from('training_sessions').select('live_run,live_revision').eq('id', sessionId).single();
 if (error) throw new Error('Trainingsablauf konnte nicht geladen werden. Bitte erneut versuchen.');
 return { run: data.live_run as TrainingRun | null, revision: Number(data.live_revision) };
}
export async function saveTrainingRun(sessionId: string, run: TrainingRun, revision: number) {
 const { data, error } = await supabase.from('training_sessions').update({ live_run: run, live_revision: revision + 1 }).eq('id', sessionId).eq('live_revision', revision).select('live_revision').maybeSingle();
 if (error) throw new Error('Ablauf konnte nicht gespeichert werden. Bitte Verbindung prüfen.');
 if (!data) throw new Error('Der Ablauf wurde auf einem anderen Gerät geändert. Bitte neu laden.');
 return Number(data.live_revision);
}
