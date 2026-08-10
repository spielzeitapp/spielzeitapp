/**
 * PLATZ.5: Erlaubte Trainingsanlagen je Mannschaftssaison.
 */

import { supabase } from './supabaseClient';
import { listVenuesForClub, type VenueRow } from './venues';

export type TeamSeasonTrainingVenueRow = {
  id: string;
  team_season_id: string;
  venue_id: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

const LINK_SELECT =
  'id, team_season_id, venue_id, is_active, sort_order, created_at, updated_at';

function isMigrationPending(message: string): boolean {
  return /team_season_training_venues|does not exist|schema cache|42P01/i.test(message);
}

export async function listTrainingVenuesForTeamSeason(
  teamSeasonId: string,
  opts?: { includeInactive?: boolean },
): Promise<{ data: (TeamSeasonTrainingVenueRow & { venue: VenueRow | null })[]; error: string | null }> {
  if (!teamSeasonId) return { data: [], error: null };
  let q = supabase
    .from('team_season_training_venues')
    .select(LINK_SELECT)
    .eq('team_season_id', teamSeasonId)
    .order('sort_order', { ascending: true });
  if (!opts?.includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) {
    if (isMigrationPending(error.message)) {
      return { data: [], error: 'Trainingsanlagen-Zuordnung noch nicht migriert (PLATZ.5).' };
    }
    return { data: [], error: error.message };
  }
  const links = (data ?? []) as TeamSeasonTrainingVenueRow[];
  if (links.length === 0) return { data: [], error: null };

  const ids = links.map((l) => l.venue_id);
  const { data: venues, error: vErr } = await supabase
    .from('venues')
    .select('id, club_id, team_id, name, address, postal_code, city, latitude, longitude, is_home, is_active')
    .in('id', ids);
  if (vErr) return { data: [], error: vErr.message };
  const byId = new Map((venues ?? []).map((v) => [String((v as VenueRow).id), v as VenueRow]));
  return {
    data: links.map((l) => ({
      ...l,
      venue: byId.get(l.venue_id) ?? null,
    })),
    error: null,
  };
}

/** Aktive Venue-Rows für Training-Picker (nur freigegebene). */
export async function listAllowedTrainingVenueRows(
  teamSeasonId: string,
): Promise<{ data: VenueRow[]; error: string | null; emptyReason: 'none_assigned' | 'migration' | null }> {
  const res = await listTrainingVenuesForTeamSeason(teamSeasonId);
  if (res.error && /noch nicht migriert/i.test(res.error)) {
    return { data: [], error: res.error, emptyReason: 'migration' };
  }
  if (res.error) return { data: [], error: res.error, emptyReason: null };
  const rows = res.data
    .filter((l) => l.is_active && l.venue && l.venue.is_active !== false)
    .map((l) => l.venue!)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return { data: rows, error: null, emptyReason: rows.length === 0 ? 'none_assigned' : null };
}

export async function assignTrainingVenue(opts: {
  teamSeasonId: string;
  venueId: string;
  sortOrder?: number;
}): Promise<{ data: TeamSeasonTrainingVenueRow | null; error: string | null }> {
  const payload = {
    team_season_id: opts.teamSeasonId,
    venue_id: opts.venueId,
    is_active: true,
    sort_order: opts.sortOrder ?? 0,
  };
  const { data, error } = await supabase
    .from('team_season_training_venues')
    .upsert(payload, { onConflict: 'team_season_id,venue_id' })
    .select(LINK_SELECT)
    .maybeSingle();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { data: null, error: 'Diese Anlage ist bereits zugewiesen.' };
    }
    if (/permission|policy|RLS|42501/i.test(error.message)) {
      return { data: null, error: 'Keine Berechtigung, Trainingsanlagen zu verwalten.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data as TeamSeasonTrainingVenueRow, error: null };
}

export async function setTrainingVenueActive(opts: {
  linkId: string;
  isActive: boolean;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('team_season_training_venues')
    .update({ is_active: opts.isActive })
    .eq('id', opts.linkId);
  if (error) {
    if (/permission|policy|RLS|42501/i.test(error.message)) {
      return { error: 'Keine Berechtigung, Trainingsanlagen zu verwalten.' };
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function updateTrainingVenueSort(opts: {
  linkId: string;
  sortOrder: number;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('team_season_training_venues')
    .update({ sort_order: opts.sortOrder })
    .eq('id', opts.linkId);
  return { error: error?.message ?? null };
}

/** Club-Katalog für Admin-Auswahl (explizite Zuweisung; kein Auto-Cross-Club). */
export async function listClubVenuesForTrainingAssignment(
  clubId: string,
): Promise<{ data: VenueRow[]; error: string | null }> {
  return listVenuesForClub(clubId, { includeInactive: false });
}

export function isTrainingVenueAllowedClient(
  allowedVenueIds: readonly string[],
  venueId: string | null | undefined,
): boolean {
  if (!venueId) return false;
  return allowedVenueIds.includes(venueId);
}
