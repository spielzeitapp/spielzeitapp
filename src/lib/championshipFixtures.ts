import { supabase } from './supabaseClient';
import { locationTextFromVenue, type VenueRow } from './venues';

export type FixtureStatus = 'open' | 'agreed';

export type ChampionshipFixture = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  is_home: boolean | null;
  starts_at: string;
  meeting_at: string | null;
  location: string | null;
  venue_id: string | null;
  match_type: string | null;
  competition: string | null;
  external_source: string | null;
  external_id: string | null;
  external_url: string | null;
  source_starts_at: string | null;
  fixture_status: FixtureStatus | null;
  opponent_logo_url: string | null;
};

export type OefbImportedFixture = {
  art: string;
  opponent: string;
  is_home: boolean;
  starts_at: string;
  competition: string | null;
  location: string | null;
  external_id: string;
  external_url: string | null;
  opponent_logo_url: string | null;
};

const FIXTURE_SELECT =
  'id, team_season_id, opponent, is_home, starts_at, meeting_at, location, venue_id, match_type, competition, external_source, external_id, external_url, source_starts_at, fixture_status, opponent_logo_url';

const FIXTURE_SELECT_NO_LOGO =
  'id, team_season_id, opponent, is_home, starts_at, meeting_at, location, venue_id, match_type, competition, external_source, external_id, external_url, source_starts_at, fixture_status';

function isMissingColumnError(message: string): boolean {
  return /fixture_status|external_source|external_id|source_starts_at|competition|column|schema cache/i.test(
    message,
  );
}

function isMissingLogoColumnError(message: string): boolean {
  return /opponent_logo_url/i.test(message);
}

async function selectChampionshipRows(
  teamSeasonId: string,
  externalId?: string,
): Promise<{ data: ChampionshipFixture[]; error: string | null }> {
  let q = supabase
    .from('events')
    .select(FIXTURE_SELECT)
    .eq('team_season_id', teamSeasonId)
    .eq('external_source', 'oefb')
    .eq('match_type', 'league');
  if (externalId) q = q.eq('external_id', externalId);
  else q = q.order('starts_at', { ascending: true });

  let res = externalId ? await q.maybeSingle() : await q;

  if (res.error && isMissingLogoColumnError(res.error.message)) {
    let q2 = supabase
      .from('events')
      .select(FIXTURE_SELECT_NO_LOGO)
      .eq('team_season_id', teamSeasonId)
      .eq('external_source', 'oefb')
      .eq('match_type', 'league');
    if (externalId) q2 = q2.eq('external_id', externalId);
    else q2 = q2.order('starts_at', { ascending: true });
    res = externalId ? await q2.maybeSingle() : await q2;
  }

  if (res.error) {
    if (isMissingColumnError(res.error.message)) {
      return {
        data: [],
        error:
          'Meisterschafts-Felder fehlen in der Datenbank. Bitte Migration 20260802180000_events_championship_fixture_fields.sql ausführen.',
      };
    }
    return { data: [], error: res.error.message };
  }

  if (externalId) {
    const row = res.data as ChampionshipFixture | null;
    return { data: row ? [row] : [], error: null };
  }
  return { data: (res.data ?? []) as ChampionshipFixture[], error: null };
}

export async function listChampionshipFixtures(
  teamSeasonId: string,
): Promise<{ data: ChampionshipFixture[]; error: string | null }> {
  return selectChampionshipRows(teamSeasonId);
}

export async function fetchOefbScheduleFixtures(opts: {
  url: string;
  ourTeamHints: string[];
}): Promise<{ fixtures: OefbImportedFixture[]; error: string | null }> {
  const params = new URLSearchParams({
    url: opts.url,
    ourTeam: opts.ourTeamHints.join('|'),
  });
  const res = await fetch(`/api/oefb/schedule?${params.toString()}`);
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    fixtures?: OefbImportedFixture[];
  };
  if (!res.ok || json.error) {
    return { fixtures: [], error: json.error ?? `HTTP ${res.status}` };
  }
  return { fixtures: json.fixtures ?? [], error: null };
}

/**
 * Upsert ÖFB-Ligaspiele.
 * Reimport: bei fixture_status=agreed keine Überschreibung von starts_at/meeting_at/venue_id.
 */
export async function importOefbChampionshipFixtures(opts: {
  teamSeasonId: string;
  fixtures: OefbImportedFixture[];
  createdBy: string | null;
}): Promise<{ inserted: number; updated: number; skippedAgreed: number; error: string | null }> {
  let inserted = 0;
  let updated = 0;
  let skippedAgreed = 0;

  for (const f of opts.fixtures) {
    if (!f.external_id || !f.opponent || !f.starts_at) continue;

    const found = await selectChampionshipRows(opts.teamSeasonId, f.external_id);
    if (found.error) {
      return { inserted, updated, skippedAgreed, error: found.error };
    }
    const existing = found.data[0] ?? null;

    if (existing) {
      const row = existing;
      const isAgreed = row.fixture_status === 'agreed';
      const patch: Record<string, unknown> = {
        opponent: f.opponent,
        is_home: f.is_home,
        competition: f.competition,
        external_url: f.external_url,
        source_starts_at: f.starts_at,
        match_type: 'league',
        kind: 'match',
        type: 'game',
      };
      if (f.opponent_logo_url) patch.opponent_logo_url = f.opponent_logo_url;
      if (!isAgreed) {
        patch.starts_at = f.starts_at;
        if (f.location && !row.venue_id) patch.location = f.location;
      } else {
        skippedAgreed += 1;
      }
      let { error: updErr } = await supabase.from('events').update(patch).eq('id', row.id);
      if (updErr && isMissingLogoColumnError(updErr.message) && 'opponent_logo_url' in patch) {
        delete patch.opponent_logo_url;
        ({ error: updErr } = await supabase.from('events').update(patch).eq('id', row.id));
      }
      if (updErr) return { inserted, updated, skippedAgreed, error: updErr.message };
      updated += 1;
      continue;
    }

    const insertPayload: Record<string, unknown> = {
      team_season_id: opts.teamSeasonId,
      kind: 'match',
      type: 'game',
      match_type: 'league',
      opponent: f.opponent,
      is_home: f.is_home,
      location: f.location,
      starts_at: f.starts_at,
      meeting_at: null,
      status: 'upcoming',
      attendance_mode: 'opt_in',
      created_by: opts.createdBy,
      external_source: 'oefb',
      external_id: f.external_id,
      external_url: f.external_url,
      competition: f.competition,
      source_starts_at: f.starts_at,
      fixture_status: 'open',
      opponent_logo_url: f.opponent_logo_url,
    };

    let { error: insErr } = await supabase.from('events').insert(insertPayload);
    if (insErr && isMissingLogoColumnError(insErr.message)) {
      delete insertPayload.opponent_logo_url;
      ({ error: insErr } = await supabase.from('events').insert(insertPayload));
    }
    if (insErr) {
      if (isMissingColumnError(insErr.message)) {
        return {
          inserted,
          updated,
          skippedAgreed,
          error:
            'Meisterschafts-Felder fehlen. Bitte Migration 20260802180000_events_championship_fixture_fields.sql ausführen.',
        };
      }
      return { inserted, updated, skippedAgreed, error: insErr.message };
    }
    inserted += 1;
  }

  return { inserted, updated, skippedAgreed, error: null };
}

export async function updateChampionshipFixture(
  eventId: string,
  patch: {
    startsAt?: string;
    meetingAt?: string | null;
    isHome?: boolean;
    opponent?: string;
    venue?: VenueRow | null;
    locationText?: string | null;
    fixtureStatus?: FixtureStatus;
  },
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.startsAt !== undefined) payload.starts_at = patch.startsAt;
  if (patch.meetingAt !== undefined) payload.meeting_at = patch.meetingAt;
  if (patch.isHome !== undefined) payload.is_home = patch.isHome;
  if (patch.opponent !== undefined) payload.opponent = patch.opponent.trim() || null;
  if (patch.fixtureStatus !== undefined) payload.fixture_status = patch.fixtureStatus;
  if (patch.venue) {
    payload.venue_id = patch.venue.id;
    payload.location = locationTextFromVenue(patch.venue);
  } else if (patch.locationText !== undefined) {
    payload.venue_id = null;
    payload.location = patch.locationText;
  }

  const { error } = await supabase.from('events').update(payload).eq('id', eventId);
  if (error) return { error: error.message };
  return { error: null };
}

export function championshipCounts(fixtures: ChampionshipFixture[]): {
  total: number;
  agreed: number;
  open: number;
} {
  const total = fixtures.length;
  const agreed = fixtures.filter((f) => f.fixture_status === 'agreed').length;
  return { total, agreed, open: Math.max(0, total - agreed) };
}
