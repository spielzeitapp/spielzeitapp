/**
 * Service-role loader for public team tournament page (TURNIER.1).
 * Does not open RLS — returns a sanitized DTO only.
 */
import { createClient } from '@supabase/supabase-js';
import {
  isValidPublicTournamentId,
  isDemoPublicTournamentId,
  buildPublicTeamTournamentDto,
  tournamentTitleFromNotes,
  assertPublicDtoSafe,
} from './publicTeamTournamentLogic.js';

function getEnv(name) {
  return globalThis?.process?.env?.[name];
}

function createAdmin() {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    const err = new Error('Server-Konfiguration unvollständig.');
    err.code = 'config';
    throw err;
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function locationDisplay(location) {
  const raw = String(location ?? '').trim();
  if (!raw) return null;
  const place = raw.split(/\s*·\s*/)[0]?.trim() || raw;
  return place || null;
}

export async function loadPublicTeamTournamentPage(publicIdRaw) {
  const publicId = String(publicIdRaw ?? '').trim();
  if (!isValidPublicTournamentId(publicId)) {
    return { ok: false, httpStatus: 404, code: 'not_found', message: 'Turnierseite nicht gefunden.' };
  }
  if (isDemoPublicTournamentId(publicId)) {
    return {
      ok: false,
      httpStatus: 404,
      code: 'demo_client',
      message: 'Demo-Turnier wird clientseitig geladen.',
    };
  }

  let admin;
  try {
    admin = createAdmin();
  } catch {
    return {
      ok: false,
      httpStatus: 503,
      code: 'unavailable',
      message: 'Turnierseite vorübergehend nicht verfügbar.',
    };
  }

  const { data: event, error: eventErr } = await admin
    .from('events')
    .select('id, kind, status, starts_at, location, notes, team_season_id')
    .eq('id', publicId)
    .maybeSingle();

  if (eventErr) {
    return {
      ok: false,
      httpStatus: 503,
      code: 'unavailable',
      message: 'Turnierseite vorübergehend nicht verfügbar.',
    };
  }
  if (!event || String(event.kind) !== 'tournament') {
    return { ok: false, httpStatus: 404, code: 'not_found', message: 'Turnierseite nicht gefunden.' };
  }

  const teamSeasonId = event.team_season_id;
  if (!teamSeasonId) {
    return { ok: false, httpStatus: 404, code: 'not_found', message: 'Turnierseite nicht gefunden.' };
  }

  const { data: ts } = await admin
    .from('team_seasons')
    .select('id, age_group, display_name, teams:teams ( id, name )')
    .eq('id', teamSeasonId)
    .maybeSingle();

  const teamRow = Array.isArray(ts?.teams) ? ts.teams[0] : ts?.teams;
  const rawTeamName =
    String(ts?.display_name ?? '').trim() ||
    String(teamRow?.name ?? '').trim() ||
    'Mannschaft';
  const ageGroup = ts?.age_group ?? null;

  let slotRes = await admin
    .from('tournament_matches')
    .select(
      'id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, phase, sort_order',
    )
    .eq('tournament_event_id', publicId)
    .order('kickoff_at', { ascending: true })
    .order('sort_order', { ascending: true });

  if (slotRes.error && /phase|column/i.test(String(slotRes.error.message ?? ''))) {
    slotRes = await admin
      .from('tournament_matches')
      .select(
        'id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, sort_order',
      )
      .eq('tournament_event_id', publicId)
      .order('kickoff_at', { ascending: true })
      .order('sort_order', { ascending: true });
    if (slotRes.data) {
      slotRes = {
        ...slotRes,
        data: slotRes.data.map((row) => ({ ...row, phase: null })),
      };
    }
  }

  if (slotRes.error) {
    return {
      ok: false,
      httpStatus: 503,
      code: 'unavailable',
      message: 'Turnierseite vorübergehend nicht verfügbar.',
    };
  }

  const slots = slotRes.data ?? [];
  const matchIds = slots.map((s) => s.match_id).filter(Boolean);
  const matchById = new Map();
  if (matchIds.length) {
    const { data: matches } = await admin
      .from('matches')
      .select('id, status, score_home, score_away, team_season_id')
      .in('id', matchIds);
    for (const m of matches ?? []) {
      if (String(m.team_season_id) !== String(teamSeasonId)) continue;
      matchById.set(m.id, m);
    }
  }

  const enriched = [];
  for (const slot of slots) {
    const m = matchById.get(slot.match_id);
    if (!m) continue;
    enriched.push({
      ...slot,
      match_status: m.status ?? 'upcoming',
      score_home: Number(m.score_home ?? 0),
      score_away: Number(m.score_away ?? 0),
    });
  }

  const dto = buildPublicTeamTournamentDto({
    publicId,
    tournamentName: tournamentTitleFromNotes(event.notes),
    notes: event.notes,
    startsAt: event.starts_at,
    venue: locationDisplay(event.location),
    teamName: rawTeamName,
    ageGroup,
    teamLogoUrl: null,
    eventStatus: event.status,
    slots: enriched,
  });

  try {
    assertPublicDtoSafe(dto);
  } catch {
    return {
      ok: false,
      httpStatus: 500,
      code: 'sanitize_failed',
      message: 'Turnierseite konnte nicht geladen werden.',
    };
  }

  return { ok: true, httpStatus: 200, page: dto };
}
