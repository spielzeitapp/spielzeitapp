/**
 * PLATZ.6: Optionale Standard-Heimspielzuordnung je Mannschaftssaison.
 */

import { supabase } from './supabaseClient';

export type TeamSeasonHomeDefaultRow = {
  id: string;
  team_season_id: string;
  venue_id: string;
  field_id: string;
  zone_id: string | null;
  lead_minutes: number;
  trail_minutes: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

const SELECT =
  'id, team_season_id, venue_id, field_id, zone_id, lead_minutes, trail_minutes, is_active, created_at, updated_at';

function isMigrationPending(message: string): boolean {
  return /team_season_home_defaults|does not exist|schema cache|42P01/i.test(message);
}

export async function listHomeDefaultsForTeamSeason(
  teamSeasonId: string,
): Promise<{ data: TeamSeasonHomeDefaultRow[]; error: string | null }> {
  if (!teamSeasonId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('team_season_home_defaults')
    .select(SELECT)
    .eq('team_season_id', teamSeasonId)
    .order('created_at', { ascending: true });
  if (error) {
    if (isMigrationPending(error.message)) {
      return { data: [], error: 'Heimspiel-Standards noch nicht migriert (PLATZ.6).' };
    }
    return { data: [], error: error.message };
  }
  return { data: (data ?? []) as TeamSeasonHomeDefaultRow[], error: null };
}

export async function getActiveHomeDefault(
  teamSeasonId: string,
): Promise<{ data: TeamSeasonHomeDefaultRow | null; error: string | null }> {
  if (!teamSeasonId) return { data: null, error: null };
  const { data, error } = await supabase
    .from('team_season_home_defaults')
    .select(SELECT)
    .eq('team_season_id', teamSeasonId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    if (isMigrationPending(error.message)) return { data: null, error: null };
    return { data: null, error: error.message };
  }
  return { data: (data as TeamSeasonHomeDefaultRow | null) ?? null, error: null };
}

export async function upsertHomeDefault(opts: {
  teamSeasonId: string;
  venueId: string;
  fieldId: string;
  zoneId?: string | null;
  leadMinutes?: number;
  trailMinutes?: number;
  isActive?: boolean;
}): Promise<{ data: TeamSeasonHomeDefaultRow | null; error: string | null }> {
  const payload = {
    team_season_id: opts.teamSeasonId,
    venue_id: opts.venueId,
    field_id: opts.fieldId,
    zone_id: opts.zoneId ?? null,
    lead_minutes: opts.leadMinutes ?? 0,
    trail_minutes: opts.trailMinutes ?? 0,
    is_active: opts.isActive ?? true,
  };

  const { data, error } = await supabase
    .from('team_season_home_defaults')
    .upsert(payload, { onConflict: 'team_season_id' })
    .select(SELECT)
    .maybeSingle();

  if (error) {
    if (isMigrationPending(error.message)) {
      return { data: null, error: 'Heimspiel-Standards noch nicht migriert (PLATZ.6).' };
    }
    if (/permission|policy|RLS|42501/i.test(error.message)) {
      return { data: null, error: 'Keine Berechtigung, Heimspiel-Standards zu setzen.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data as TeamSeasonHomeDefaultRow, error: null };
}

export async function clearHomeDefault(
  teamSeasonId: string,
): Promise<{ error: string | null }> {
  if (!teamSeasonId) return { error: null };
  const { error } = await supabase
    .from('team_season_home_defaults')
    .delete()
    .eq('team_season_id', teamSeasonId);
  if (error) {
    if (isMigrationPending(error.message)) return { error: null };
    if (/permission|policy|RLS|42501/i.test(error.message)) {
      return { error: 'Keine Berechtigung, Heimspiel-Standards zu löschen.' };
    }
    return { error: error.message };
  }
  return { error: null };
}
