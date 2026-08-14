import { supabase } from './supabaseClient';
import {
  ensureOpponentCatalogEntry,
  resolveClubIdFromTeamSeason,
  setOpponentCatalogLogo,
} from './opponentCatalog';
import {
  getClubLogo,
  isPlaceholderLogoUrl,
  PLACEHOLDER_LOGO,
} from './teamLogos';
import { normalizeOpponentKey } from './teamVenues';
import { locationTextFromVenue, type VenueRow } from './venues';
import type { FixtureStatus } from './championshipVisibility';
import { normalizeSeasonPhase, type SeasonPhase } from './seasonPhase';
import { assertTeamSeasonWritable } from './seasonTransition';
import {
  describeOefbOpponentCorrection,
  normalizeOefbImportedTeamName,
} from './oefbTeamNameNormalize';
import { tryApplyHomeDefaultAssignment } from './eventFieldAssignments';

/** Sicherer Optional-Call — darf Import nie blockieren. */
async function safeTryApplyHomeDefault(eventId: string, isHome: boolean): Promise<void> {
  if (!isHome || !eventId) return;
  try {
    await tryApplyHomeDefaultAssignment(eventId);
  } catch {
    /* ignore */
  }
}

export type { FixtureStatus } from './championshipVisibility';
export {
  describeOefbOpponentCorrection,
  normalizeOefbImportedTeamName,
  formatVisibleMatchEncounter,
} from './oefbTeamNameNormalize';

/** Bekannter Vereins-Spielplan (Rohrbach) — nur Vorausfüllung, kein erratener Link. */
export const DEFAULT_OEFB_SCHEDULE_URL =
  'https://vereine.oefb.at/USCRohrbach/Mannschaften/Saison-2026-27/U12-1/Spiele';

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
  notes: string | null;
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
  'id, team_season_id, opponent, is_home, starts_at, meeting_at, location, venue_id, match_type, competition, external_source, external_id, external_url, source_starts_at, fixture_status, opponent_logo_url, notes';

const FIXTURE_SELECT_NO_LOGO =
  'id, team_season_id, opponent, is_home, starts_at, meeting_at, location, venue_id, match_type, competition, external_source, external_id, external_url, source_starts_at, fixture_status, notes';

function isMissingColumnError(message: string): boolean {
  return /fixture_status|external_source|external_id|source_starts_at|competition|column|schema cache/i.test(
    message,
  );
}

function isMissingLogoColumnError(message: string): boolean {
  return /opponent_logo_url|opponent_slug/i.test(message);
}

function migrationHint(): string {
  return 'Meisterschafts-Felder fehlen. Bitte Migrationen 20260802180000 / 20260802190000 auf Staging ausführen.';
}

/** Lokales Asset bevorzugen; sonst ÖFB-URL; sonst null (UI zeigt Platzhalter). */
export function resolveOpponentLogoForStorage(
  opponent: string,
  oefbLogoUrl?: string | null,
): string | null {
  const local = getClubLogo(opponent);
  if (local && !isPlaceholderLogoUrl(local) && local.includes('/logos/')) {
    return local.startsWith('/') ? local : `/${local.replace(/^\/+/, '')}`;
  }
  const oefb = String(oefbLogoUrl ?? '').trim();
  if (oefb.startsWith('https://') || oefb.startsWith('http://')) return oefb;
  return null;
}

export function displayOpponentLogoUrl(
  opponent: string | null | undefined,
  storedUrl?: string | null,
): string {
  return getClubLogo(String(opponent ?? ''), { logoUrl: storedUrl ?? undefined }) || PLACEHOLDER_LOGO;
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
      return { data: [], error: migrationHint() };
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
  const fixtures = (json.fixtures ?? []).map((f) => normalizeOefbImportedFixture(f));
  return { fixtures, error: null };
}

/** Gegnername (und damit sichtbare Spielbezeichnung) vor Preview/Upsert bereinigen. */
export function normalizeOefbImportedFixture(f: OefbImportedFixture): OefbImportedFixture {
  return {
    ...f,
    opponent: normalizeOefbImportedTeamName(f.opponent),
  };
}

export function isProtectedManualStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'agreed' || s === 'published';
}

export type OefbImportPreviewStatus =
  | 'new'
  | 'update'
  | 'existing'
  | 'protected'
  | 'error';

export type OefbImportPreviewRow = {
  fixture: OefbImportedFixture;
  status: OefbImportPreviewStatus;
  statusLabel: string;
  existingEventId: string | null;
  existingFixtureStatus: FixtureStatus | null;
  message: string | null;
  /** Sichtbare Namenskorrektur, z. B. „U11 ASK Loosdorf → ASK Loosdorf“. */
  nameCorrection: string | null;
  /** Würde beim Bestätigen einen Write auslösen (Insert oder erlaubtes Update). */
  willWrite: boolean;
};

export type OefbImportPreviewResult = {
  rows: OefbImportPreviewRow[];
  counts: {
    new: number;
    update: number;
    existing: number;
    protected: number;
    error: number;
    writable: number;
  };
  error: string | null;
};

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta === tb;
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/**
 * Saisonbezogene Vorschau (ohne Writes): Neu / Aktualisierung / vorhanden / geschützt / Fehler.
 * Dublettenschlüssel: (team_season_id, external_source=oefb, external_id).
 */
export async function previewOefbChampionshipImport(opts: {
  teamSeasonId: string;
  fixtures: OefbImportedFixture[];
}): Promise<OefbImportPreviewResult> {
  const emptyCounts = { new: 0, update: 0, existing: 0, protected: 0, error: 0, writable: 0 };
  const writableGate = await assertTeamSeasonWritable(opts.teamSeasonId);
  if (!writableGate.ok) {
    return { rows: [], counts: emptyCounts, error: writableGate.message };
  }

  const rows: OefbImportPreviewRow[] = [];
  for (const raw of opts.fixtures) {
    const f = normalizeOefbImportedFixture(raw);
    if (!f.external_id || !f.opponent || !f.starts_at) {
      rows.push({
        fixture: f,
        status: 'error',
        statusLabel: 'Fehler',
        existingEventId: null,
        existingFixtureStatus: null,
        message: 'Unvollständige ÖFB-Daten (ID, Gegner oder Termin fehlen).',
        nameCorrection: null,
        willWrite: false,
      });
      continue;
    }

    const found = await selectChampionshipRows(opts.teamSeasonId, f.external_id);
    if (found.error) {
      return { rows: [], counts: emptyCounts, error: found.error };
    }
    const existing = found.data[0] ?? null;
    if (!existing) {
      rows.push({
        fixture: f,
        status: 'new',
        statusLabel: 'Neu',
        existingEventId: null,
        existingFixtureStatus: null,
        message: null,
        nameCorrection: null,
        willWrite: true,
      });
      continue;
    }

    const nameCorrection = describeOefbOpponentCorrection(existing.opponent, f.opponent);

    if (isProtectedManualStatus(existing.fixture_status)) {
      rows.push({
        fixture: f,
        status: 'protected',
        statusLabel: 'Geschützt',
        existingEventId: existing.id,
        existingFixtureStatus: existing.fixture_status,
        message: nameCorrection
          ? `Termin bleibt unverändert. Name wird bereinigt: ${nameCorrection}`
          : 'Vereinbart oder veröffentlicht: Kickoff/Ort/Status werden nicht überschrieben. Sichere Metadaten dürfen aktualisiert werden.',
        nameCorrection,
        willWrite: true,
      });
      continue;
    }

    const unchanged =
      sameInstant(existing.starts_at, f.starts_at) &&
      String(existing.opponent ?? '').trim() === String(f.opponent ?? '').trim() &&
      Boolean(existing.is_home) === Boolean(f.is_home);

    if (unchanged) {
      rows.push({
        fixture: f,
        status: 'existing',
        statusLabel: 'Bereits vorhanden',
        existingEventId: existing.id,
        existingFixtureStatus: existing.fixture_status,
        message: null,
        nameCorrection: null,
        willWrite: true,
      });
    } else {
      rows.push({
        fixture: f,
        status: 'update',
        statusLabel: 'Aktualisierung',
        existingEventId: existing.id,
        existingFixtureStatus: existing.fixture_status,
        message: nameCorrection
          ? `Namenskorrektur: ${nameCorrection}`
          : 'Offener Termin: Kickoff/Gegner werden an den ÖFB-Stand angeglichen.',
        nameCorrection,
        willWrite: true,
      });
    }
  }

  const counts = { ...emptyCounts };
  for (const r of rows) {
    counts[r.status] += 1;
    if (r.willWrite) counts.writable += 1;
  }
  return { rows, counts, error: null };
}

/**
 * Upsert ÖFB-Ligaspiele.
 * Reimport: bei agreed/published keine Überschreibung von starts_at/meeting_at/venue_id/fixture_status.
 * Schreibt nur in die angegebene team_season_id (keine Verschiebung historischer Saisons).
 */
export async function importOefbChampionshipFixtures(opts: {
  teamSeasonId: string;
  fixtures: OefbImportedFixture[];
  createdBy: string | null;
}): Promise<{ inserted: number; updated: number; skippedProtected: number; error: string | null }> {
  let inserted = 0;
  let updated = 0;
  let skippedProtected = 0;

  const writableGate = await assertTeamSeasonWritable(opts.teamSeasonId);
  if (!writableGate.ok) {
    return { inserted: 0, updated: 0, skippedProtected: 0, error: writableGate.message };
  }

  const clubId = await resolveClubIdFromTeamSeason(opts.teamSeasonId);

  for (const raw of opts.fixtures) {
    const f = normalizeOefbImportedFixture(raw);
    if (!f.external_id || !f.opponent || !f.starts_at) continue;
    const logo = resolveOpponentLogoForStorage(f.opponent, f.opponent_logo_url);
    if (clubId) {
      await ensureOpponentCatalogEntry({
        clubId,
        displayName: f.opponent,
        logoUrl: logo,
        externalSource: 'oefb',
        externalId: f.external_id,
      });
    }

    const found = await selectChampionshipRows(opts.teamSeasonId, f.external_id);
    if (found.error) {
      return { inserted, updated, skippedProtected, error: found.error };
    }
    const existing = found.data[0] ?? null;

    if (existing) {
      const protectedRow = isProtectedManualStatus(existing.fixture_status);
      // Auch bei agreed/published: Gegner/Bezeichnung + sichere Metadaten aktualisieren;
      // Termin/Ort/Status bleiben geschützt.
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
      // Sichtbare Bezeichnungsreste in notes (z. B. alte „U11 … – U11 …“-Zeilen) mitbereinigen.
      if (existing.notes) {
        const cleanedNotes = normalizeOefbImportedTeamName(existing.notes);
        if (cleanedNotes && cleanedNotes !== String(existing.notes).trim()) {
          patch.notes = cleanedNotes;
        }
      }
      if (logo && !existing.opponent_logo_url) patch.opponent_logo_url = logo;
      if (!protectedRow) {
        patch.starts_at = f.starts_at;
        if (f.location && !existing.venue_id) patch.location = f.location;
      } else {
        skippedProtected += 1;
      }
      let { error: updErr } = await supabase.from('events').update(patch).eq('id', existing.id);
      if (updErr && isMissingLogoColumnError(updErr.message) && 'opponent_logo_url' in patch) {
        delete patch.opponent_logo_url;
        ({ error: updErr } = await supabase.from('events').update(patch).eq('id', existing.id));
      }
      if (updErr) return { inserted, updated, skippedProtected, error: updErr.message };
      updated += 1;
      await safeTryApplyHomeDefault(existing.id, Boolean(f.is_home));
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
      opponent_logo_url: logo,
    };

    let { data: insertedRow, error: insErr } = await supabase
      .from('events')
      .insert(insertPayload)
      .select('id')
      .maybeSingle();
    if (insErr && isMissingLogoColumnError(insErr.message)) {
      delete insertPayload.opponent_logo_url;
      ({ data: insertedRow, error: insErr } = await supabase
        .from('events')
        .insert(insertPayload)
        .select('id')
        .maybeSingle());
    }
    if (insErr) {
      if (isMissingColumnError(insErr.message)) {
        return { inserted, updated, skippedProtected, error: migrationHint() };
      }
      return { inserted, updated, skippedProtected, error: insErr.message };
    }
    inserted += 1;
    const newId = insertedRow ? String((insertedRow as { id: string }).id) : '';
    await safeTryApplyHomeDefault(newId, Boolean(f.is_home));
  }

  return { inserted, updated, skippedProtected, error: null };
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
    notes?: string | null;
    opponentLogoUrl?: string | null;
  },
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {};
  if (patch.startsAt !== undefined) payload.starts_at = patch.startsAt;
  if (patch.meetingAt !== undefined) payload.meeting_at = patch.meetingAt;
  if (patch.isHome !== undefined) payload.is_home = patch.isHome;
  if (patch.opponent !== undefined) payload.opponent = patch.opponent.trim() || null;
  if (patch.fixtureStatus !== undefined) payload.fixture_status = patch.fixtureStatus;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  if (patch.opponentLogoUrl !== undefined) payload.opponent_logo_url = patch.opponentLogoUrl;
  if (patch.venue) {
    payload.venue_id = patch.venue.id;
    payload.location = locationTextFromVenue(patch.venue);
  } else if (patch.locationText !== undefined) {
    payload.venue_id = null;
    payload.location = patch.locationText;
  }

  let { error } = await supabase.from('events').update(payload).eq('id', eventId);
  if (error && isMissingLogoColumnError(error.message) && 'opponent_logo_url' in payload) {
    delete payload.opponent_logo_url;
    ({ error } = await supabase.from('events').update(payload).eq('id', eventId));
  }
  if (error) return { error: error.message };
  if (patch.isHome === true) {
    await safeTryApplyHomeDefault(eventId, true);
  }
  return { error: null };
}

/** Gleiches Event bleibt; Status → published. */
export async function publishChampionshipFixture(
  eventId: string,
): Promise<{ error: string | null }> {
  const { data, error: findErr } = await supabase
    .from('events')
    .select('id, fixture_status')
    .eq('id', eventId)
    .maybeSingle();
  if (findErr) return { error: findErr.message };
  if (!data) return { error: 'Spiel nicht gefunden.' };
  const status = String((data as { fixture_status?: string }).fixture_status ?? '');
  if (status === 'published') return { error: null };
  if (status !== 'agreed') {
    return { error: 'Nur vereinbarte Spiele können veröffentlicht werden.' };
  }
  const { error } = await supabase
    .from('events')
    .update({ fixture_status: 'published' })
    .eq('id', eventId);
  if (error) return { error: error.message };
  return { error: null };
}

/** Alle agreed der Saison → published. open/published unverändert. */
export async function publishAllAgreedChampionshipFixtures(
  teamSeasonId: string,
): Promise<{ published: number; error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .update({ fixture_status: 'published' })
    .eq('team_season_id', teamSeasonId)
    .eq('external_source', 'oefb')
    .eq('fixture_status', 'agreed')
    .select('id');
  if (error) return { published: 0, error: error.message };
  return { published: (data ?? []).length, error: null };
}

/** Logo für Catalog + alle Meisterschaftsspiele desselben Gegners in der Saison. */
export async function setOpponentLogoForSeason(opts: {
  teamSeasonId: string;
  opponentName: string;
  logoUrl: string | null;
}): Promise<{ updated: number; error: string | null }> {
  const key = normalizeOpponentKey(opts.opponentName);
  if (!key) return { updated: 0, error: 'Gegner fehlt.' };

  const clubId = await resolveClubIdFromTeamSeason(opts.teamSeasonId);
  if (clubId) {
    const catalog = await setOpponentCatalogLogo({
      clubId,
      displayName: opts.opponentName,
      logoUrl: opts.logoUrl,
    });
    if (catalog.error && /Migration 20260803120000/i.test(catalog.error)) {
      // Catalog optional bis Migration — Event-Update trotzdem versuchen
    } else if (catalog.error) {
      return { updated: 0, error: catalog.error };
    }
  }

  const listed = await listChampionshipFixtures(opts.teamSeasonId);
  if (listed.error) return { updated: 0, error: listed.error };

  const ids = listed.data
    .filter((f) => normalizeOpponentKey(f.opponent) === key)
    .map((f) => f.id);
  if (ids.length === 0) return { updated: 0, error: null };

  let { error } = await supabase
    .from('events')
    .update({ opponent_logo_url: opts.logoUrl })
    .in('id', ids);
  if (error && isMissingLogoColumnError(error.message)) {
    return {
      updated: 0,
      error:
        'Spalte opponent_logo_url fehlt. Bitte Migration 20260802190001_events_opponent_logo_ensure.sql ausführen.',
    };
  }
  if (error) return { updated: 0, error: error.message };
  return { updated: ids.length, error: null };
}

export function championshipCounts(fixtures: ChampionshipFixture[]): {
  total: number;
  open: number;
  agreed: number;
  published: number;
} {
  let open = 0;
  let agreed = 0;
  let published = 0;
  for (const f of fixtures) {
    const s = f.fixture_status;
    if (s === 'published') published += 1;
    else if (s === 'agreed') agreed += 1;
    else open += 1;
  }
  return { total: fixtures.length, open, agreed, published };
}

/**
 * Lädt Altersklasse + Saisonname + Phase für den PDF-Header der gewählten team_season.
 * Kein Hardcode — age_group / seasons.name / display_name-Fallback / season_phase.
 */
export async function fetchChampionshipPdfSeasonMeta(
  teamSeasonId: string,
): Promise<{
  ageGroup: string | null;
  seasonName: string | null;
  seasonPhase: SeasonPhase | null;
  error: string | null;
}> {
  const id = teamSeasonId?.trim();
  if (!id) {
    return { ageGroup: null, seasonName: null, seasonPhase: null, error: 'Keine Saison gewählt.' };
  }

  let data: Record<string, unknown> | null = null;
  let errorMsg: string | null = null;

  {
    const res = await supabase
      .from('team_seasons')
      .select('age_group, display_name, season_phase, seasons ( name )')
      .eq('id', id)
      .maybeSingle();
    if (res.error && /season_phase|column|schema cache/i.test(res.error.message)) {
      const fallback = await supabase
        .from('team_seasons')
        .select('age_group, display_name, seasons ( name )')
        .eq('id', id)
        .maybeSingle();
      if (fallback.error) {
        return {
          ageGroup: null,
          seasonName: null,
          seasonPhase: null,
          error: fallback.error.message,
        };
      }
      data = (fallback.data as Record<string, unknown> | null) ?? null;
    } else if (res.error) {
      errorMsg = res.error.message;
    } else {
      data = (res.data as Record<string, unknown> | null) ?? null;
    }
  }

  if (errorMsg) {
    return { ageGroup: null, seasonName: null, seasonPhase: null, error: errorMsg };
  }
  if (!data) {
    return { ageGroup: null, seasonName: null, seasonPhase: null, error: 'Saison nicht gefunden.' };
  }

  const seasonJoin = data.seasons as { name?: string | null } | { name?: string | null }[] | null;
  const seasonRow = Array.isArray(seasonJoin) ? seasonJoin[0] : seasonJoin;
  const seasonName = seasonRow?.name?.trim() || null;
  const ageFromCol = String(data.age_group ?? '').trim() || null;
  const ageFromDisplay =
    String(data.display_name ?? '')
      .match(/\bU\s?\d{1,2}\b/i)?.[0]
      ?.replace(/\s+/g, '')
      .toUpperCase() || null;

  return {
    ageGroup: ageFromCol || ageFromDisplay,
    seasonName,
    seasonPhase: normalizeSeasonPhase(
      typeof data.season_phase === 'string' ? data.season_phase : null,
    ),
    error: null,
  };
}
