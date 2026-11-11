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
  let rawTeamName =
    String(teamRow?.name ?? '').trim() ||
    String(ts?.display_name ?? '').trim() ||
    'Mannschaft';
  const originalAge = String(event.notes ?? '').match(/^Turniermannschaft: (U\d{1,2})$/m)?.[1];
  const originalSeason = String(event.notes ?? '').match(/^Turniersaison: (20\d{2}\/\d{2})$/m)?.[1];
  const ageGroup = originalAge || ts?.age_group || null;
  if (originalAge) rawTeamName = teamRow?.name || rawTeamName;

  let slotRes = await admin
    .from('tournament_matches')
    .select(
      'id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, phase, sort_order, home_team, away_team, official_status, home_goals, away_goals',
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
      .select('id, status, score_home, score_away, team_season_id, live_started_at, live_elapsed_seconds')
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
    const officialFallback = m.status === 'upcoming' && !m.live_started_at && !m.live_elapsed_seconds && !m.score_home && !m.score_away && slot.official_status === 'finished' && slot.home_goals != null && slot.away_goals != null;
    const ownHome = slot.away_team === slot.opponent_name;
    enriched.push({
      ...slot,
      match_status: officialFallback ? 'finished' : m.status ?? 'upcoming',
      score_home: Number(officialFallback ? (ownHome ? slot.home_goals : slot.away_goals) : m.score_home ?? 0),
      score_away: Number(officialFallback ? (ownHome ? slot.away_goals : slot.home_goals) : m.score_away ?? 0),
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

  const { data: sync } = await admin.from('tournament_sync_state').select('analysis,synced_at').eq('event_id', publicId).maybeSingle();
  const analysis = sync?.analysis ?? {};
  dto.groupTables = (analysis.groupStandings ?? []).map(g => ({groupLabel:String(g.groupLabel),rows:(g.rows ?? []).map(r => ({teamName:String(r.teamName),rank:Number(r.rank),played:Number(r.played),goalsFor:Number(r.goalsFor),goalsAgainst:Number(r.goalsAgainst),points:Number(r.points)}))}));
  dto.finalRanking = (analysis.finalStandings ?? []).map(r => ({rank:Number(r.rank),teamName:String(r.teamName)}));
  dto.schedule = (analysis.rawMatches ?? []).map(m => ({id:String(m.externalMatchId ?? ''),homeTeam:String(m.homeTeam),awayTeam:String(m.awayTeam),time:String(m.kickoffTimeHHmm),phase:String(m.phase),groupLabel:m.groupLabel == null ? null : String(m.groupLabel),roundLabel:m.roundLabel == null ? null : String(m.roundLabel),homeGoals:m.hasResult ? Number(m.homeGoals) : null,awayGoals:m.hasResult ? Number(m.awayGoals) : null}));
  dto.syncedAt = sync?.synced_at ?? null;
  dto.seasonLabel = originalSeason || String(ts?.display_name ?? '').match(/20\d{2}\/\d{2}/)?.[0] || null;
  const originalDate = String(event.notes ?? '').match(/^Turnierdatum: (20\d{2}-\d{2}-\d{2})$/m)?.[1];
  if (originalDate) dto.dateLabel = new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(originalDate+'T12:00:00Z'));
  const {data: teamClub} = await admin.from('teams').select('club_id').eq('id',teamRow?.id).maybeSingle();
  const {data: club} = teamClub?.club_id ? await admin.from('clubs').select('logo_url,accent_color').eq('id',teamClub.club_id).maybeSingle() : {data:null};
  dto.teamLogoUrl = club?.logo_url ?? null;
  dto.accentColor = /^#[0-9a-f]{6}$/i.test(club?.accent_color ?? '') ? club.accent_color : '#c82333';

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
