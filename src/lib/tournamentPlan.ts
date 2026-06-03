import { supabase } from './supabaseClient';
import { upsertMatchForSetup, updateMatchRow } from './liveMatchService';
import {
  getDateTimePartsInTimeZone,
  meetupUtcIsoOnViennaEventDay,
  utcIsoToViennaTimeHHmm,
  VIENNA_TZ,
} from './viennaTime';
/** Standard-Spieldauer für Turnierspiele (Kurzturnier). */
export const TOURNAMENT_DEFAULT_PLANNED_MINUTES = 12;

const MIGRATION_MISSING_MSG = 'Turnierplan-Migration fehlt oder Tabellen nicht vorhanden.';

export function normalizeTournamentDbError(
  message: string,
  code?: string | null,
): string {
  const m = message.toLowerCase();
  const c = (code ?? '').toLowerCase();
  if (
    c === '42p01' ||
    c === 'pgrst205' ||
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('tournament_participants') ||
    m.includes('tournament_matches') ||
    m.includes('could not find the table')
  ) {
    return MIGRATION_MISSING_MSG;
  }
  return message;
}

export type TournamentParticipant = {
  id: string;
  tournament_event_id: string;
  team_name: string;
  group_label: string | null;
  sort_order: number;
};

export type TournamentMatchSlot = {
  id: string;
  tournament_event_id: string;
  match_id: string;
  opponent_name: string;
  kickoff_at: string;
  planned_minutes: number;
  pitch: string | null;
  group_label: string | null;
  sort_order: number;
};

export type TournamentMatchSlotView = TournamentMatchSlot & {
  match_status: string | null;
  score_home: number;
  score_away: number;
  has_lineup: boolean;
  has_squad: boolean;
};

export type TournamentMatchDisplayStatus =
  | { kind: 'planned'; label: 'Geplant' }
  | { kind: 'preparation'; label: 'Vorbereitung' }
  | { kind: 'live'; label: 'Live' }
  | { kind: 'result'; label: string; ourGoals: number; oppGoals: number };

export function tournamentMatchDisplayStatus(slot: TournamentMatchSlotView): TournamentMatchDisplayStatus {
  const st = (slot.match_status ?? 'upcoming').toLowerCase();
  if (st === 'live') return { kind: 'live', label: 'Live' };
  if (st === 'finished') {
    const our = slot.score_home;
    const opp = slot.score_away;
    return { kind: 'result', label: `Ergebnis ${our}:${opp}`, ourGoals: our, oppGoals: opp };
  }
  if (slot.has_lineup || slot.has_squad) {
    return { kind: 'preparation', label: 'Vorbereitung' };
  }
  return { kind: 'planned', label: 'Geplant' };
}

export function formatTournamentKickoffTime(kickoffAtIso: string): string {
  const d = new Date(kickoffAtIso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export async function fetchTournamentParticipants(
  tournamentEventId: string,
): Promise<{ data: TournamentParticipant[]; error: string | null }> {
  const { data, error } = await supabase
    .from('tournament_participants')
    .select('id, tournament_event_id, team_name, group_label, sort_order')
    .eq('tournament_event_id', tournamentEventId)
    .order('group_label', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('team_name', { ascending: true });

  if (error) return { data: [], error: normalizeTournamentDbError(error.message, error.code) };
  return { data: (data ?? []) as TournamentParticipant[], error: null };
}

export async function addTournamentParticipant(params: {
  tournamentEventId: string;
  teamName: string;
  groupLabel?: string | null;
}): Promise<{ error: string | null }> {
  const name = params.teamName.trim();
  if (!name) return { error: 'Mannschaftsname fehlt.' };

  const { count, error: countErr } = await supabase
    .from('tournament_participants')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_event_id', params.tournamentEventId);

  if (countErr) return { error: normalizeTournamentDbError(countErr.message, countErr.code) };

  const { error } = await supabase.from('tournament_participants').insert({
    tournament_event_id: params.tournamentEventId,
    team_name: name,
    group_label: params.groupLabel?.trim() || null,
    sort_order: (count ?? 0) + 1,
  });

  return { error: error ? normalizeTournamentDbError(error.message, error.code) : null };
}

export async function removeTournamentParticipant(participantId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tournament_participants').delete().eq('id', participantId);
  return { error: error ? normalizeTournamentDbError(error.message, error.code) : null };
}

async function enrichTournamentMatchSlots(
  rows: TournamentMatchSlot[],
): Promise<TournamentMatchSlotView[]> {
  if (rows.length === 0) return [];

  const matchIds = rows.map((r) => r.match_id);
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, status, score_home, score_away')
    .in('id', matchIds);

  if (matchErr) {
    return rows.map((r) => ({
      ...r,
      match_status: null,
      score_home: 0,
      score_away: 0,
      has_lineup: false,
      has_squad: false,
    }));
  }

  const matchById = new Map(
    (matches ?? []).map((m: { id: string; status: string | null; score_home: number; score_away: number }) => [
      m.id,
      m,
    ]),
  );

  const [{ data: lineupRows }, { data: benchRows }] = await Promise.all([
    supabase.from('match_lineup').select('match_id').in('match_id', matchIds),
    supabase.from('match_bench').select('match_id').in('match_id', matchIds),
  ]);

  const lineupCounts = new Map<string, number>();
  for (const row of lineupRows ?? []) {
    const mid = String((row as { match_id: string }).match_id);
    lineupCounts.set(mid, (lineupCounts.get(mid) ?? 0) + 1);
  }
  const benchCounts = new Map<string, number>();
  for (const row of benchRows ?? []) {
    const mid = String((row as { match_id: string }).match_id);
    benchCounts.set(mid, (benchCounts.get(mid) ?? 0) + 1);
  }

  return rows.map((r) => {
    const m = matchById.get(r.match_id);
    return {
      ...r,
      match_status: m?.status ?? null,
      score_home: Number(m?.score_home ?? 0),
      score_away: Number(m?.score_away ?? 0),
      has_lineup: (lineupCounts.get(r.match_id) ?? 0) > 0,
      has_squad: (benchCounts.get(r.match_id) ?? 0) > 0,
    };
  });
}

export async function fetchTournamentMatchSlots(
  tournamentEventId: string,
): Promise<{ data: TournamentMatchSlotView[]; error: string | null }> {
  const { data, error } = await supabase
    .from('tournament_matches')
    .select('id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, sort_order')
    .eq('tournament_event_id', tournamentEventId)
    .order('kickoff_at', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) return { data: [], error: normalizeTournamentDbError(error.message, error.code) };
  const rows = (data ?? []) as TournamentMatchSlot[];
  const enriched = await enrichTournamentMatchSlots(rows);
  return { data: enriched, error: null };
}

export async function createTournamentMatchSlot(params: {
  tournamentEventId: string;
  teamSeasonId: string;
  tournamentDayIso: string;
  location: string | null;
  opponentName: string;
  kickoffTimeHHmm: string;
  plannedMinutes: number;
  pitch?: string | null;
  groupLabel?: string | null;
}): Promise<{ slotId: string | null; matchId: string | null; error: string | null }> {
  const opponent = params.opponentName.trim();
  if (!opponent) return { slotId: null, matchId: null, error: 'Gegner fehlt.' };

  const kickoffIso = meetupUtcIsoOnViennaEventDay(params.tournamentDayIso, params.kickoffTimeHHmm);
  if (!kickoffIso) return { slotId: null, matchId: null, error: 'Ungültige Anstoßzeit.' };

  const kickoff = new Date(kickoffIso);
  const vienna = getDateTimePartsInTimeZone(kickoff, VIENNA_TZ);
  const matchDate = vienna
    ? `${vienna.year}-${String(vienna.month).padStart(2, '0')}-${String(vienna.day).padStart(2, '0')}`
    : kickoffIso.slice(0, 10);
  const matchTime = utcIsoToViennaTimeHHmm(kickoffIso);

  const locationParts = [params.location?.trim(), params.pitch?.trim()].filter(Boolean);
  const locationNote = locationParts.join(' · ') || '';

  const { matchId, error: matchErr } = await upsertMatchForSetup({
    matchId: null,
    teamSeasonId: params.teamSeasonId,
    opponent,
    matchDate,
    matchTime,
    locationNote,
  });

  if (matchErr || !matchId) {
    return {
      slotId: null,
      matchId: null,
      error: matchErr ? normalizeTournamentDbError(matchErr, null) : 'Spiel konnte nicht angelegt werden.',
    };
  }

  const planned = Math.max(
    1,
    Math.min(120, Math.trunc(params.plannedMinutes || TOURNAMENT_DEFAULT_PLANNED_MINUTES)),
  );
  const { error: minErr } = await updateMatchRow(matchId, { planned_match_minutes: planned });
  if (minErr) {
    await supabase.from('matches').delete().eq('id', matchId);
    return { slotId: null, matchId: null, error: normalizeTournamentDbError(minErr, null) };
  }

  const { count } = await supabase
    .from('tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_event_id', params.tournamentEventId);

  const { data: inserted, error: slotErr } = await supabase
    .from('tournament_matches')
    .insert({
      tournament_event_id: params.tournamentEventId,
      match_id: matchId,
      opponent_name: opponent,
      kickoff_at: kickoffIso,
      planned_minutes: planned,
      pitch: params.pitch?.trim() || null,
      group_label: params.groupLabel?.trim() || null,
      sort_order: (count ?? 0) + 1,
    })
    .select('id')
    .single();

  if (slotErr) {
    await supabase.from('matches').delete().eq('id', matchId);
    return { slotId: null, matchId: null, error: normalizeTournamentDbError(slotErr.message, slotErr.code) };
  }

  return {
    slotId: (inserted as { id?: string } | null)?.id ?? null,
    matchId,
    error: null,
  };
}

export async function removeTournamentMatchSlot(matchId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  return { error: error ? normalizeTournamentDbError(error.message, error.code) : null };
}

export function groupParticipantsByLabel(
  participants: TournamentParticipant[],
): { label: string | null; items: TournamentParticipant[] }[] {
  const map = new Map<string | null, TournamentParticipant[]>();
  for (const p of participants) {
    const key = p.group_label?.trim() || null;
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a == null) return 1;
    if (b == null) return -1;
    return a.localeCompare(b, 'de');
  });
  return keys.map((label) => ({ label, items: map.get(label) ?? [] }));
}
