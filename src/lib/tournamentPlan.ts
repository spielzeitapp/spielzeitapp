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
  /** Optional: Migration 20260616120000 — group | placement | semifinal | final | unknown */
  phase?: string | null;
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
  | { kind: 'planned'; label: 'GEPLANT' }
  | { kind: 'preparation'; label: 'VORBEREITUNG' }
  | { kind: 'live'; label: 'LIVE' }
  | { kind: 'result'; label: 'BEENDET'; ourGoals: number; oppGoals: number };

export function tournamentMatchDisplayStatus(slot: TournamentMatchSlotView): TournamentMatchDisplayStatus {
  const st = (slot.match_status ?? 'upcoming').toLowerCase();
  if (st === 'live') return { kind: 'live', label: 'LIVE' };
  if (st === 'finished') {
    return {
      kind: 'result',
      label: 'BEENDET',
      ourGoals: slot.score_home,
      oppGoals: slot.score_away,
    };
  }
  if (slot.has_lineup || slot.has_squad) {
    return { kind: 'preparation', label: 'VORBEREITUNG' };
  }
  return { kind: 'planned', label: 'GEPLANT' };
}

export type TournamentHeroSummary = {
  teamCount: number;
  groupCount: number;
  matchCount: number;
  nextMatch: TournamentMatchSlotView | null;
  allFinished: boolean;
};

export type TournamentTeamBalance = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isCompleted: boolean;
};

/** Bilanz aus eigenen Turnierspielen (score_home = wir, nur status finished). */
export function computeTournamentTeamBalance(slots: TournamentMatchSlotView[]): TournamentTeamBalance {
  let played = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const slot of slots) {
    if ((slot.match_status ?? '').toLowerCase() !== 'finished') continue;
    played += 1;
    const ourGoals = Number(slot.score_home ?? 0);
    const oppGoals = Number(slot.score_away ?? 0);
    goalsFor += ourGoals;
    goalsAgainst += oppGoals;
    if (ourGoals > oppGoals) wins += 1;
    else if (ourGoals < oppGoals) losses += 1;
    else draws += 1;
  }

  const points = wins * 3 + draws;
  const goalDifference = goalsFor - goalsAgainst;
  const isCompleted =
    slots.length > 0 &&
    slots.every((slot) => (slot.match_status ?? '').toLowerCase() === 'finished');

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference,
    points,
    isCompleted,
  };
}

export function formatTournamentGoalDifference(diff: number): string {
  if (diff > 0) return `+${diff}`;
  return String(diff);
}

export function sortTournamentMatchSlots(slots: TournamentMatchSlotView[]): TournamentMatchSlotView[] {
  return [...slots].sort((a, b) => {
    const diff = new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();
    if (diff !== 0) return diff;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export function isTournamentSlotPreparable(slot: TournamentMatchSlotView): boolean {
  const st = (slot.match_status ?? '').toLowerCase();
  return st !== 'live' && st !== 'finished';
}

/** Nächster vorbereitbarer Slot (nach kickoff_at/sort_order), optional nach aktuellem Match. */
export function pickNextPlannedTournamentSlot(
  slots: TournamentMatchSlotView[],
  options?: { afterMatchId?: string | null },
): TournamentMatchSlotView | null {
  const afterMatchId = options?.afterMatchId?.trim() ?? '';
  const sorted = sortTournamentMatchSlots(slots);

  if (afterMatchId) {
    const currentIdx = sorted.findIndex((s) => s.match_id === afterMatchId);
    if (currentIdx >= 0) {
      for (let i = currentIdx + 1; i < sorted.length; i++) {
        const slot = sorted[i]!;
        if (isTournamentSlotPreparable(slot)) return slot;
      }
      return null;
    }
  }

  for (const slot of sorted) {
    if (afterMatchId && slot.match_id === afterMatchId) continue;
    if (isTournamentSlotPreparable(slot)) return slot;
  }
  return null;
}

export function computeTournamentHeroSummary(
  participants: TournamentParticipant[],
  slots: TournamentMatchSlotView[],
): TournamentHeroSummary {
  const teamCount = participants.length;
  const distinctGroups = new Set(
    participants
      .map((p) => p.group_label?.trim())
      .filter((label): label is string => Boolean(label))
      .map((label) => label.toLowerCase()),
  );
  const groupCount = distinctGroups.size;
  const matchCount = slots.length;

  if (matchCount === 0) {
    return { teamCount, groupCount, matchCount, nextMatch: null, allFinished: false };
  }

  const allFinished = slots.every((s) => (s.match_status ?? '').toLowerCase() === 'finished');
  if (allFinished) {
    return { teamCount, groupCount, matchCount, nextMatch: null, allFinished: true };
  }

  const live = slots.find((s) => (s.match_status ?? '').toLowerCase() === 'live');
  if (live) {
    return { teamCount, groupCount, matchCount, nextMatch: live, allFinished: false };
  }

  const nextMatch =
    slots.find((s) => (s.match_status ?? '').toLowerCase() !== 'finished') ?? null;

  return { teamCount, groupCount, matchCount, nextMatch, allFinished: false };
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

/** Text-Import: Zeilen parsen, Leerzeilen weg, trimmen, keine Duplikate (Batch + bestehende Liste). */
export function parseTournamentParticipantImportLines(
  raw: string,
  existingTeamNames: string[] = [],
): string[] {
  const existing = new Set(existingTeamNames.map((n) => n.trim().toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const name = line.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key) || existing.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function tournamentImportSuccessMessage(importedCount: number): string {
  if (importedCount === 1) return '1 Mannschaft importiert';
  return `${importedCount} Mannschaften importiert`;
}

export async function importTournamentParticipantsBulk(params: {
  tournamentEventId: string;
  groupLabel?: string | null;
  teamNames: string[];
}): Promise<{ imported: number; error: string | null }> {
  const names = params.teamNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) {
    return { imported: 0, error: 'Keine gültigen Mannschaften zum Importieren.' };
  }

  const { count, error: countErr } = await supabase
    .from('tournament_participants')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_event_id', params.tournamentEventId);

  if (countErr) return { imported: 0, error: normalizeTournamentDbError(countErr.message, countErr.code) };

  const groupLabel = params.groupLabel?.trim() || null;
  const baseOrder = count ?? 0;
  const rows = names.map((team_name, index) => ({
    tournament_event_id: params.tournamentEventId,
    team_name,
    group_label: groupLabel,
    sort_order: baseOrder + index + 1,
  }));

  const { error } = await supabase.from('tournament_participants').insert(rows);
  if (error) return { imported: 0, error: normalizeTournamentDbError(error.message, error.code) };
  return { imported: names.length, error: null };
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
  let res = await supabase
    .from('tournament_matches')
    .select('id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, phase, sort_order')
    .eq('tournament_event_id', tournamentEventId)
    .order('kickoff_at', { ascending: true })
    .order('sort_order', { ascending: true });

  let data = res.data;
  let error = res.error;
  if (error && /phase|column/i.test(String(error.message ?? ''))) {
    const fallback = await supabase
      .from('tournament_matches')
      .select('id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, sort_order')
      .eq('tournament_event_id', tournamentEventId)
      .order('kickoff_at', { ascending: true })
      .order('sort_order', { ascending: true });
    data = (fallback.data ?? []).map((row) => ({ ...row, phase: null }));
    error = fallback.error;
  }

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
  phase?: string | null;
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

  const slotRow: Record<string, unknown> = {
    tournament_event_id: params.tournamentEventId,
    match_id: matchId,
    opponent_name: opponent,
    kickoff_at: kickoffIso,
    planned_minutes: planned,
    pitch: params.pitch?.trim() || null,
    group_label: params.groupLabel?.trim() || null,
    sort_order: (count ?? 0) + 1,
  };
  const phaseValue = params.phase?.trim();
  if (phaseValue) slotRow.phase = phaseValue;

  let insertRes = await supabase.from('tournament_matches').insert(slotRow).select('id').single();

  if (insertRes.error && /phase|column/i.test(String(insertRes.error.message ?? '')) && 'phase' in slotRow) {
    delete slotRow.phase;
    insertRes = await supabase.from('tournament_matches').insert(slotRow).select('id').single();
  }

  const { data: inserted, error: slotErr } = insertRes;

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

/** Ergebnis aus Turnierplan-Import — nur leere/ungefüllte Matches, kein Live-Override. */
export async function applyTournamentMatchResultIfEmpty(params: {
  matchId: string;
  ourGoals: number;
  oppGoals: number;
  currentStatus?: string | null;
  currentScoreHome?: number;
  currentScoreAway?: number;
}): Promise<{ applied: boolean; error: string | null }> {
  const st = (params.currentStatus ?? 'upcoming').toLowerCase();
  if (st === 'live') {
    return { applied: false, error: null };
  }

  const scoreHome = Number(params.currentScoreHome ?? 0);
  const scoreAway = Number(params.currentScoreAway ?? 0);
  if (st === 'finished' && (scoreHome > 0 || scoreAway > 0)) {
    return { applied: false, error: null };
  }

  const ourGoals = Math.max(0, Math.trunc(params.ourGoals));
  const oppGoals = Math.max(0, Math.trunc(params.oppGoals));

  const { error } = await updateMatchRow(params.matchId, {
    score_home: ourGoals,
    score_away: oppGoals,
    status: 'finished',
  });

  if (error) {
    return { applied: false, error: normalizeTournamentDbError(error, null) };
  }
  return { applied: true, error: null };
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
