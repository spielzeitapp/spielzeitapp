import { supabase } from './supabaseClient';
import { fetchPastTrainingEvents } from './trainingStatsLoader';

/** Anzahl vergangener, gültiger Team-Trainings (einheitliche Basis für Statistik). */
export async function countPastTeamTrainings(teamSeasonId: string): Promise<number> {
  const events = await fetchPastTrainingEvents(teamSeasonId);
  return events.length;
}

/** Anzahl zukünftiger, gültiger Team-Trainings. */
export async function countUpcomingTeamTrainings(teamSeasonId: string): Promise<number> {
  const sid = teamSeasonId.trim();
  if (!sid) return 0;
  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('team_season_id', sid)
    .eq('kind', 'training')
    .gte('starts_at', nowIso)
    .not('status', 'in', '(canceled,cancelled,deleted,archived)');

  if (error) return 0;
  return Number(count ?? 0) || 0;
}
