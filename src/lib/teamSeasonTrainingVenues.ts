/**
 * PLATZ.5/6: Erlaubte Anlagen je Mannschaftssaison (Training + Heimspiel).
 */

import { supabase } from './supabaseClient';
import { listVenuesForClub, type VenueRow } from './venues';

export type VenuePurpose = 'training' | 'home_match';

export type TeamSeasonTrainingVenueRow = {
  id: string;
  team_season_id: string;
  venue_id: string;
  purpose: VenuePurpose;
  is_active: boolean;
  sort_order: number;
  valid_from?: string | null;
  valid_until?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const LINK_SELECT =
  'id, team_season_id, venue_id, purpose, is_active, sort_order, valid_from, valid_until, created_at, updated_at';

function isMigrationPending(message: string): boolean {
  return /team_season_training_venues|does not exist|schema cache|42P01/i.test(message);
}

function normalizePurpose(raw: unknown): VenuePurpose {
  return String(raw ?? '').toLowerCase() === 'home_match' ? 'home_match' : 'training';
}

export async function listTrainingVenuesForTeamSeason(
  teamSeasonId: string,
  opts?: {
    includeInactive?: boolean;
    /** Default 'training' (PLATZ.5-kompatibel). 'all' = beide Zwecke. */
    purpose?: VenuePurpose | 'all';
  },
): Promise<{ data: (TeamSeasonTrainingVenueRow & { venue: VenueRow | null })[]; error: string | null }> {
  if (!teamSeasonId) return { data: [], error: null };
  const purposeFilter = opts?.purpose ?? 'training';
  let q = supabase
    .from('team_season_training_venues')
    .select(LINK_SELECT)
    .eq('team_season_id', teamSeasonId)
    .order('sort_order', { ascending: true });
  if (!opts?.includeInactive) q = q.eq('is_active', true);
  if (purposeFilter !== 'all') q = q.eq('purpose', purposeFilter);
  const { data, error } = await q;
  if (error) {
    // Vor PLATZ.6: Spalte purpose fehlt ggf. — Fallback ohne Purpose-Filter.
    if (/purpose|column/i.test(error.message) && purposeFilter !== 'all') {
      return listTrainingVenuesForTeamSeasonLegacy(teamSeasonId, opts);
    }
    if (isMigrationPending(error.message)) {
      return { data: [], error: 'Trainingsanlagen-Zuordnung noch nicht migriert (PLATZ.5).' };
    }
    return { data: [], error: error.message };
  }
  const links = ((data ?? []) as Array<Record<string, unknown>>).map((raw) => ({
    ...(raw as unknown as TeamSeasonTrainingVenueRow),
    purpose: normalizePurpose(raw.purpose),
  }));
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

/** Fallback wenn purpose-Spalte noch fehlt (nur Training-Semantik). */
async function listTrainingVenuesForTeamSeasonLegacy(
  teamSeasonId: string,
  opts?: { includeInactive?: boolean },
): Promise<{ data: (TeamSeasonTrainingVenueRow & { venue: VenueRow | null })[]; error: string | null }> {
  let q = supabase
    .from('team_season_training_venues')
    .select('id, team_season_id, venue_id, is_active, sort_order, created_at, updated_at')
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
  const links = ((data ?? []) as Array<Record<string, unknown>>).map((raw) => ({
    id: String(raw.id),
    team_season_id: String(raw.team_season_id),
    venue_id: String(raw.venue_id),
    purpose: 'training' as VenuePurpose,
    is_active: Boolean(raw.is_active),
    sort_order: Number(raw.sort_order ?? 0),
    created_at: (raw.created_at as string | null) ?? null,
    updated_at: (raw.updated_at as string | null) ?? null,
  }));
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

/** Aktive Venue-Rows für Training-Picker (nur freigegebene, purpose=training). */
export async function listAllowedTrainingVenueRows(
  teamSeasonId: string,
): Promise<{ data: VenueRow[]; error: string | null; emptyReason: 'none_assigned' | 'migration' | null }> {
  return listAllowedVenueRowsForPurpose(teamSeasonId, 'training');
}

/** Aktive Venue-Rows für einen Zweck (training | home_match). */
export async function listAllowedVenueRowsForPurpose(
  teamSeasonId: string,
  purpose: VenuePurpose,
): Promise<{ data: VenueRow[]; error: string | null; emptyReason: 'none_assigned' | 'migration' | null }> {
  const res = await listTrainingVenuesForTeamSeason(teamSeasonId, { purpose });
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
  purpose?: VenuePurpose;
}): Promise<{ data: TeamSeasonTrainingVenueRow | null; error: string | null }> {
  const purpose: VenuePurpose = opts.purpose ?? 'training';
  const payload = {
    team_season_id: opts.teamSeasonId,
    venue_id: opts.venueId,
    purpose,
    is_active: true,
    sort_order: opts.sortOrder ?? 0,
  };

  // Unique key nach PLATZ.6: (team_season_id, venue_id, purpose)
  const upsertAttempt = await supabase
    .from('team_season_training_venues')
    .upsert(payload, { onConflict: 'team_season_id,venue_id,purpose' })
    .select(LINK_SELECT)
    .maybeSingle();

  if (!upsertAttempt.error) {
    const row = upsertAttempt.data as TeamSeasonTrainingVenueRow | null;
    return {
      data: row ? { ...row, purpose: normalizePurpose(row.purpose) } : null,
      error: null,
    };
  }

  // Fallback: Purpose-Spalte / neuer Unique-Index noch nicht da → alter Key
  if (/on conflict|purpose|column|42P10|42703/i.test(upsertAttempt.error.message)) {
    const legacy = await supabase
      .from('team_season_training_venues')
      .upsert(
        {
          team_season_id: opts.teamSeasonId,
          venue_id: opts.venueId,
          is_active: true,
          sort_order: opts.sortOrder ?? 0,
        },
        { onConflict: 'team_season_id,venue_id' },
      )
      .select('id, team_season_id, venue_id, is_active, sort_order, created_at, updated_at')
      .maybeSingle();
    if (legacy.error) {
      return { data: null, error: humanizeAssignError(legacy.error.message) };
    }
    const raw = legacy.data as Record<string, unknown> | null;
    if (!raw) return { data: null, error: null };
    return {
      data: {
        id: String(raw.id),
        team_season_id: String(raw.team_season_id),
        venue_id: String(raw.venue_id),
        purpose: 'training',
        is_active: Boolean(raw.is_active),
        sort_order: Number(raw.sort_order ?? 0),
        created_at: (raw.created_at as string | null) ?? null,
        updated_at: (raw.updated_at as string | null) ?? null,
      },
      error: null,
    };
  }

  // Alternativ: bestehende Zeile per Zweck suchen und updaten, sonst insert
  if (/duplicate|unique/i.test(upsertAttempt.error.message)) {
    const existing = await supabase
      .from('team_season_training_venues')
      .select(LINK_SELECT)
      .eq('team_season_id', opts.teamSeasonId)
      .eq('venue_id', opts.venueId)
      .eq('purpose', purpose)
      .maybeSingle();
    if (existing.data) {
      const { data, error } = await supabase
        .from('team_season_training_venues')
        .update({ is_active: true, sort_order: opts.sortOrder ?? 0 })
        .eq('id', (existing.data as { id: string }).id)
        .select(LINK_SELECT)
        .maybeSingle();
      if (error) return { data: null, error: humanizeAssignError(error.message) };
      const row = data as TeamSeasonTrainingVenueRow | null;
      return {
        data: row ? { ...row, purpose: normalizePurpose(row.purpose) } : null,
        error: null,
      };
    }
  }

  return { data: null, error: humanizeAssignError(upsertAttempt.error.message) };
}

function humanizeAssignError(message: string): string {
  if (/duplicate|unique/i.test(message)) {
    return 'Diese Anlage ist für diesen Zweck bereits zugewiesen.';
  }
  if (/permission|policy|RLS|42501/i.test(message)) {
    return 'Keine Berechtigung, Anlagen-Freigaben zu verwalten.';
  }
  return message;
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
      return { error: 'Keine Berechtigung, Anlagen-Freigaben zu verwalten.' };
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

export type GroupedVenueGrant = {
  venueId: string;
  venueName: string;
  training: boolean;
  homeMatch: boolean;
};

export function groupVenueGrantsByVenue(
  links: ReadonlyArray<{
    venue_id: string;
    purpose?: VenuePurpose | null;
    is_active: boolean;
    venue?: { name?: string | null } | null;
  }>,
): GroupedVenueGrant[] {
  const byId = new Map<string, GroupedVenueGrant>();
  for (const link of links) {
    if (!link.is_active || !link.venue_id) continue;
    const current = byId.get(link.venue_id) ?? {
      venueId: link.venue_id,
      venueName: (link.venue?.name ?? '').trim() || 'Anlage',
      training: false,
      homeMatch: false,
    };
    if ((link.venue?.name ?? '').trim()) current.venueName = String(link.venue?.name).trim();
    if (link.purpose === 'home_match') current.homeMatch = true;
    else current.training = true;
    byId.set(link.venue_id, current);
  }
  return Array.from(byId.values()).sort((a, b) => a.venueName.localeCompare(b.venueName, 'de'));
}

export function venuesAvailableForPurposeGrant<T extends { id: string }>(
  catalog: readonly T[],
  grouped: readonly GroupedVenueGrant[],
  purpose: VenuePurpose,
): T[] {
  const taken = new Set(
    grouped
      .filter((g) => (purpose === 'home_match' ? g.homeMatch : g.training))
      .map((g) => g.venueId),
  );
  return catalog.filter((v) => !taken.has(v.id));
}

export function assignmentUsesVenueGrantPurpose(
  event: { kind?: string | null; is_home?: boolean | null },
  purpose: VenuePurpose,
): boolean {
  const kind = String(event.kind ?? '').trim().toLowerCase();
  if (purpose === 'home_match') return kind === 'match' && event.is_home === true;
  return kind === 'training' || (kind !== 'match' && kind !== 'game');
}

/** Zukünftige interne Belegungen, die diesen Venue-Grant noch nutzen. */
export async function countFutureAssignmentsForVenueGrant(opts: {
  teamSeasonId: string;
  venueId: string;
  purpose: VenuePurpose;
}): Promise<{ count: number; error: string | null }> {
  if (!opts.teamSeasonId || !opts.venueId) return { count: 0, error: null };
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('event_field_assignments')
    .select('id, starts_at, events!inner(team_season_id, kind, is_home)')
    .eq('venue_id', opts.venueId)
    .gte('starts_at', nowIso);
  if (error) {
    if (isMigrationPending(error.message) || /relationship|schema cache/i.test(error.message)) {
      return countFutureAssignmentsForVenueGrantLegacy(opts, nowIso);
    }
    return { count: 0, error: error.message };
  }
  const rows = (data ?? []) as Array<{
    events?: { team_season_id?: string; kind?: string | null; is_home?: boolean | null } | Array<{
      team_season_id?: string;
      kind?: string | null;
      is_home?: boolean | null;
    }>;
  }>;
  const count = rows.filter((row) => {
    const ev = Array.isArray(row.events) ? row.events[0] : row.events;
    if (!ev || String(ev.team_season_id ?? '') !== opts.teamSeasonId) return false;
    return assignmentUsesVenueGrantPurpose(ev, opts.purpose);
  }).length;
  return { count, error: null };
}

async function countFutureAssignmentsForVenueGrantLegacy(
  opts: { teamSeasonId: string; venueId: string; purpose: VenuePurpose },
  nowIso: string,
): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .select('id, kind, is_home, venue_id, starts_at')
    .eq('team_season_id', opts.teamSeasonId)
    .eq('venue_id', opts.venueId)
    .gte('starts_at', nowIso);
  if (error) return { count: 0, error: error.message };
  const count = ((data ?? []) as Array<{ kind?: string | null; is_home?: boolean | null }>).filter((ev) =>
    assignmentUsesVenueGrantPurpose(ev, opts.purpose),
  ).length;
  return { count, error: null };
}

/** Serverseitige Grant-Prüfung (RPC). Keine clientseitige Allowlist, keine Venue-IDs. */
export async function assertVenuePurposeAllowed(
  teamSeasonId: string,
  venueId: string,
  purpose: VenuePurpose,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!teamSeasonId || !venueId) {
    return { ok: false, error: 'Sportanlage und Mannschaftssaison sind Pflicht.' };
  }
  const { data, error } = await supabase.rpc('is_venue_purpose_allowed_for_team_season', {
    p_team_season_id: teamSeasonId,
    p_venue_id: venueId,
    p_purpose: purpose,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  if (data === true) return { ok: true };
  return {
    ok: false,
    error:
      purpose === 'home_match'
        ? 'Diese Anlage ist für Heimspiele nicht freigegeben.'
        : 'Diese Anlage ist für Training nicht freigegeben.',
  };
}
