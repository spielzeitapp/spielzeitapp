import { tournamentLivestreamUrl, TOURNAMENT_LIVESTREAM_POST, TOURNAMENT_RECORDING_POST } from './tournamentLivestream.js';
import { publicTournamentStandings } from './publicTournamentStandings.js';
import { resolveTournamentOwnTeam } from './tournamentOwnTeam.js';
import { tournamentTeamLogos } from './tournamentTeamLogos.js';
import { buildPublicTournamentMatchDetails } from './publicTournamentMatchDetails.js';
import { meinTurnierplanLiveByMatchId, normalizeMeinTurnierplanLiveMatches, resolveMeinTurnierplanFinalStandings, supersededLiveMatches } from './meinTurnierplanModel.js';
/**
 * Service-role loader for public team tournament page (TURNIER.1).
 * Does not open RLS — returns a sanitized DTO only.
 */
import { createClient } from '@supabase/supabase-js';
import {
  isValidPublicTournamentId,
  isDemoPublicTournamentId,
  buildPublicTeamTournamentDto,
  formatViennaTimeLabel,
  tournamentTitleFromNotes,
  assertPublicDtoSafe,
  buildPublicTournamentPlayers,
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
    .select('id, kind, status, starts_at, location, notes, team_season_id, tournament_completed_at')
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
    .select('id, age_group, display_name, teams:teams ( id, name, club_id )')
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
      'id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, phase, sort_order, external_match_id, home_team, away_team, official_status, home_goals, away_goals',
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
      .select('id, status, score_home, score_away, team_season_id, live_started_at, live_elapsed_seconds, live_is_running, u11_formation_id, period_scores')
      .in('id', matchIds);
    for (const m of matches ?? []) {
      if (String(m.team_season_id) !== String(teamSeasonId)) continue;
      matchById.set(m.id, m);
    }
  }

  const { data: sync } = await admin.from('tournament_sync_state').select('analysis,synced_at,own_team_name').eq('event_id', publicId).maybeSingle();
  const viennaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna' });
  const localProgress = slots.flatMap(slot => {
    const status = matchById.get(slot.match_id)?.status;
    const kickoff = Date.parse(slot.kickoff_at);
    if ((status !== 'live' && status !== 'finished') || !Number.isFinite(kickoff)) return [];
    return [{
      slotId: slot.id,
      externalMatchId: String(slot.external_match_id ?? '').replace(/^meinturnierplan:/, ''),
      local: true,
      pitch: slot.pitch,
      kickoffDate: viennaDate.format(kickoff),
      kickoffTimeHHmm: formatViennaTimeLabel(slot.kickoff_at),
      isLive: status === 'live',
      hasResult: status === 'finished',
    }];
  });
  const analysis = normalizeMeinTurnierplanLiveMatches(sync?.analysis ?? {}, localProgress);
  const liveByMatch = meinTurnierplanLiveByMatchId(analysis);
  const supersededLocalIds = new Set(analysis.provider === 'meinturnierplan'
    ? [...supersededLiveMatches(localProgress, analysis.rawMatches ?? [])].map(match => match.slotId)
    : []);
  const officialResults = new Map((analysis.rawMatches ?? [])
    .filter(match => match.hasResult && match.externalMatchId)
    .map(match => [match.externalMatchId, match]));
  const enriched = [];
  for (const slot of slots) {
    const m = matchById.get(slot.match_id);
    if (!m) continue;
    const organizerLive = liveByMatch.get(slot.external_match_id);
    const untouchedLocal = m.status === 'upcoming' && !m.live_started_at && !m.live_elapsed_seconds && !m.score_home && !m.score_away;
    const officialLive = Boolean(untouchedLocal && organizerLive);
    const supersededLocal = supersededLocalIds.has(slot.id);
    const officialResult = officialResults.get(String(slot.external_match_id ?? '').replace(`${analysis.provider}:`, ''));
    const officialHome = (slot.official_status === 'finished' ? slot.home_goals : null) ?? officialResult?.homeGoals;
    const officialAway = (slot.official_status === 'finished' ? slot.away_goals : null) ?? officialResult?.awayGoals;
    const officialFallback = (untouchedLocal || supersededLocal) && !officialLive && officialHome != null && officialAway != null;
    const ownHome = slot.away_team === slot.opponent_name;
    enriched.push({
      ...slot,
      match_status: officialLive ? 'live' : officialFallback ? 'finished' : supersededLocal ? 'upcoming' : m.status ?? 'upcoming',
      organizer_live: officialLive,
      score_home: officialLive ? (ownHome ? organizerLive.liveHomeGoals : organizerLive.liveAwayGoals)
        : officialFallback ? (ownHome ? officialHome : officialAway) : m.score_home ?? 0,
      score_away: officialLive ? (ownHome ? organizerLive.liveAwayGoals : organizerLive.liveHomeGoals)
        : officialFallback ? (ownHome ? officialAway : officialHome) : m.score_away ?? 0,
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

  const { data: streamPost } = await admin.from('team_feed_posts')
    .select('cta_url, post_kind, payload').eq('event_id', publicId).eq('team_season_id', teamSeasonId)
    .eq('team_id', teamRow?.id ?? null).in('post_kind', [TOURNAMENT_LIVESTREAM_POST, TOURNAMENT_RECORDING_POST])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  dto.livestreamUrl = dto.tournamentStatus === 'canceled' ? null : tournamentLivestreamUrl(streamPost?.cta_url);
  dto.livestreamIsRecording = Boolean(dto.livestreamUrl && (
    streamPost?.post_kind === TOURNAMENT_RECORDING_POST || event.tournament_completed_at || dto.tournamentStatus === 'finished'
  ));
  if (dto.livestreamIsRecording && Array.isArray(streamPost?.payload?.recording_parts)) {
    const parts = [...new Set(streamPost.payload.recording_parts.slice(0, 10).map(tournamentLivestreamUrl).filter(Boolean))];
    if (parts.length > 1) dto.recordingParts = parts;
  }
  dto.finalRanking = resolveMeinTurnierplanFinalStandings(analysis);
  const slotsByExternalId = new Map(slots.map(slot => [slot.external_match_id, slot]));
  dto.schedule = (analysis.rawMatches ?? []).map(m => {
    const id = String(m.externalMatchId ?? '');
    const slot = slotsByExternalId.get(`${analysis.provider}:${id}`) ?? slotsByExternalId.get(id);
    return {
      id, homeTeam: String(m.homeTeam), awayTeam: String(m.awayTeam), time: String(m.kickoffTimeHHmm),
      resultDecision: m.resultDecision === 'extra_time' || m.resultDecision === 'shootout' ? m.resultDecision : undefined,
      phase: String(m.phase), groupLabel: m.groupLabel == null ? null : String(m.groupLabel),
      roundLabel: m.roundLabel == null ? null : String(m.roundLabel),
      homeProjection: m.homeConfirmed === false && m.homeProjection ? String(m.homeProjection) : null,
      awayProjection: m.awayConfirmed === false && m.awayProjection ? String(m.awayProjection) : null,
      homeGoals: m.hasResult ? Number(m.homeGoals) : null, awayGoals: m.hasResult ? Number(m.awayGoals) : null,
      kickoffAt: slot?.kickoff_at ?? null, plannedMinutes: Number(m.plannedMinutes ?? slot?.planned_minutes ?? 0),
      status: m.isLive ? 'live' : m.hasResult ? 'finished' : 'upcoming',
      liveHomeGoals: m.liveHomeGoals ?? null, liveAwayGoals: m.liveAwayGoals ?? null,
    };
  });
  dto.syncedAt = sync?.synced_at ?? null;
  dto.ownParticipantName = sync?.own_team_name ?? resolveTournamentOwnTeam(analysis.teams ?? [], [rawTeamName]);
  const standings = publicTournamentStandings(analysis, enriched, dto.ownParticipantName);
  dto.groupTables = standings.tables;
  dto.standingsProvisional = standings.provisional;
  dto.seasonLabel = originalSeason || String(ts?.display_name ?? '').match(/20\d{2}\/\d{2}/)?.[0] || null;
  const originalDate = String(event.notes ?? '').match(/^Turnierdatum: (20\d{2}-\d{2}-\d{2})$/m)?.[1];
  if (originalDate) dto.dateLabel = new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date(originalDate+'T12:00:00Z'));
  const [teamBrandingResult, clubResult, catalogResult] = await Promise.all([
    teamRow?.id
      ? admin.from('team_branding_overrides').select('logo_url,accent_color').eq('team_id', teamRow.id).maybeSingle()
      : { data: null },
    teamRow?.club_id
      ? admin.from('clubs').select('logo_url,accent_color').eq('id', teamRow.club_id).maybeSingle()
      : { data: null },
    teamRow?.club_id
      ? admin.from('opponent_catalog').select('display_name,logo_url').eq('club_id', teamRow.club_id).not('logo_url', 'is', null)
      : { data: [] },
  ]);
  const teamBranding = teamBrandingResult.data;
  const club = clubResult.data;
  const catalog = catalogResult.data;
  dto.teamLogoUrl = teamBranding?.logo_url || club?.logo_url || null;
  dto.accentColor = [teamBranding?.accent_color, club?.accent_color]
    .find(color => /^#[0-9a-f]{6}$/i.test(color ?? '')) ?? '#c82333';
  dto.teamLogos = { ...tournamentTeamLogos(analysis), ...Object.fromEntries((catalog ?? []).filter(r=>typeof r.logo_url==='string').map(r=>[r.display_name,r.logo_url])) };
  const [{data: tournamentPlayers}, {data: rosterRows, error: rosterError}] = await Promise.all([
    admin.from('tournament_squad').select('player_id').eq('tournament_event_id', publicId),
    admin.from('team_season_players').select('player_id,jersey_number,players:players(id,first_name,last_name,cutout_url)').eq('team_season_id', event.team_season_id),
  ]);
  let roster = rosterRows ?? [];
  if (rosterError) {
    const {data: legacy} = await admin.from('players').select('id,first_name,last_name,jersey_number,cutout_url').eq('team_season_id', event.team_season_id);
    roster = (legacy ?? []).map(player => ({player_id:player.id,jersey_number:player.jersey_number,players:player}));
  }
  const chosenIds = new Set((tournamentPlayers ?? []).map(row => row.player_id));
  dto.fanRoster = roster.filter(row => chosenIds.has(row.player_id)).map(row => [row.players?.first_name,row.players?.last_name].filter(Boolean).join(' ')).filter(Boolean);
  dto.fanRosterExample = false;
  dto.scorers = [];
  if (matchIds.length) {
    const {data: goals} = await admin.from('match_events').select('match_id,player_id').in('match_id',matchIds).eq('type','goal');
    const playerIds = [...new Set((goals ?? []).map(g=>g.player_id).filter(Boolean))];
    const {data: players} = playerIds.length ? await admin.from('players').select('id,first_name,last_name').in('id',playerIds) : {data:[]};
    const names = new Map((players ?? []).map(p=>[p.id,[p.first_name,p.last_name].filter(Boolean).join(' ')]));
    const totals = new Map();
    for (const g of goals ?? []) { const slot=slots.find(s=>s.match_id===g.match_id); const name=names.get(g.player_id);if(!slot||!name)continue;
      const time=new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',hour:'2-digit',minute:'2-digit'}).format(new Date(slot.kickoff_at));
      const key=g.player_id+':'+time;const row=totals.get(key)??{name,goals:0,time,example:false};row.goals++;totals.set(key,row);
    }
    dto.scorers=[...totals.values()];
  }
  if (/^TEST/.test(String(event.notes ?? ''))) {
    try { const sample=JSON.parse(String(event.notes ?? '').match(/^Fan-Testdaten: (.+)$/m)?.[1] ?? '{}');
      if (!dto.fanRoster.length && Array.isArray(sample.roster) && sample.roster.length) {
        dto.fanRoster=sample.roster.map(name=>String(name));
        dto.fanRosterExample=true;
      }
      if (!dto.scorers.length) dto.scorers=(sample.scorers ?? []).map(s=>({name:String(s.name),goals:Number(s.goals),time:String(s.time),example:true}));
    } catch { /* no example data */ }
  }
  const ownMatchIds = [...matchById.keys()];
  let currentRows = [], kickoffRows = [], benchRows = [], publicEvents = [], detailsUnavailable = false;
  if (ownMatchIds.length) {
    const results = await Promise.all([
      admin.from('match_lineup').select('match_id,player_id,slot').in('match_id',ownMatchIds),
      admin.from('match_lineup_snapshots').select('match_id,player_id,slot').in('match_id',ownMatchIds).eq('snapshot_type','kickoff'),
      admin.from('match_bench').select('match_id,player_id').in('match_id',ownMatchIds),
      admin.from('match_events').select('match_id,type,minute,player_id,payload').in('match_id',ownMatchIds).order('minute').order('created_at'),
    ]);
    detailsUnavailable = results.some(result => result.error);
    [currentRows,kickoffRows,benchRows,publicEvents] = results.map(result=>result.data ?? []);
  }
  dto.matchDetails = buildPublicTournamentMatchDetails({matches:[...matchById.values()],roster,events:publicEvents,currentRows,kickoffRows,benchRows,unavailable:detailsUnavailable});
  const decisionByFixture = new Map(dto.schedule.map(fixture => [fixture.id, fixture.resultDecision]));
  const decisionByMatch = new Map(slots.filter(slot => slot.match_id && slot.external_match_id).map(slot => [
    slot.match_id, decisionByFixture.get(slot.external_match_id) ??
      decisionByFixture.get(slot.external_match_id.slice((analysis.provider?.length ?? 0) + 1)),
  ]));
  for (const detail of dto.matchDetails) detail.officialDecision = decisionByMatch.get(detail.id);
  const detailNames = dto.matchDetails.flatMap(detail=>[...detail.startingPlayers.map(p=>p.name),...detail.benchPlayers,...detail.events.flatMap(event=>[event.playerName,event.otherPlayerName,event.removedPlayerName].filter(Boolean))]);
  const profileNames = [...dto.fanRoster, ...dto.scorers.map(s => s.name),...detailNames];
  const profileIds = roster.map(row => row.player_id).filter(Boolean);
  const {data: avatars} = profileIds.length ? await admin.from('player_avatars').select('player_id,avatar_url').in('player_id',profileIds) : {data:[]};
  dto.fanPlayers = buildPublicTournamentPlayers(profileNames, roster, avatars ?? []);

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
