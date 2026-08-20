import { safeOptionalText, safeText } from './safeText';
import { supabase } from './supabaseClient';
import { upsertMatchForSetup, updateMatchRow } from './liveMatchService';
import {
  getDateTimePartsInTimeZone,
  meetupUtcIsoOnViennaEventDay,
  utcIsoToViennaTimeHHmm,
  VIENNA_TZ,
} from './viennaTime';
import {
  addDemoTournamentParticipant,
  applyDemoTournamentMatchResult,
  createDemoTournamentMatchSlot,
  getDemoTournamentMatchSlots,
  getDemoTournamentParticipants,
  importDemoTournamentParticipants,
  isDemoTournamentEventId,
  removeDemoTournamentMatchSlot,
  removeDemoTournamentParticipant,
} from '../demo/demoTournamentState';
import {
  looksLikeUnresolvedTournamentTeamName,
  slotLooksUnresolvedPairing,
} from './tournamentUnresolvedTeam';

export { looksLikeUnresolvedTournamentTeamName, slotLooksUnresolvedPairing };

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
  match_id: string | null;
  opponent_name: string;
  kickoff_at: string;
  planned_minutes: number;
  pitch: string | null;
  group_label: string | null;
  /** Optional: Migration 20260616120000 — group | placement | semifinal | final | unknown */
  phase?: string | null;
  sort_order: number;
  home_team?: string | null;
  away_team?: string | null;
  is_own_team?: boolean;
  source?: 'spielzeitapp' | 'official' | string | null;
  provider?: string | null;
  external_match_id?: string | null;
  official_status?: string | null;
  official_home_goals?: number | null;
  official_away_goals?: number | null;
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

export function isOwnPlayableTournamentSlot(slot: {
  is_own_team?: boolean | null;
  match_id?: string | null;
}): boolean {
  if (slot.is_own_team === false) return false;
  return Boolean(safeText(slot.match_id));
}

export function ownPlayableTournamentSlots<T extends { is_own_team?: boolean | null; match_id?: string | null }>(
  slots: T[],
): T[] {
  return slots.filter((slot) => isOwnPlayableTournamentSlot(slot));
}

/** Spielplan-Filter „Unsere Spiele“: eigene Mannschaft (auch noch nicht promotete Official-Slots). */
export function isOurTournamentScheduleSlot(slot: {
  is_own_team?: boolean | null;
  match_id?: string | null;
}): boolean {
  if (slot.is_own_team === false) return false;
  if (slot.is_own_team === true) return true;
  return Boolean(safeText(slot.match_id));
}

export function ourTournamentScheduleSlots<T extends { is_own_team?: boolean | null; match_id?: string | null }>(
  slots: T[],
): T[] {
  return slots.filter((slot) => isOurTournamentScheduleSlot(slot));
}

function normalizeSlotPhase(phase: unknown): string {
  const raw = String(phase ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!raw) return 'group';
  if (raw.includes('final') && !raw.includes('semi') && !raw.includes('halb')) return 'final';
  if (raw.includes('semi') || raw.includes('halb')) return 'semi';
  if (
    raw.includes('platz') ||
    raw.includes('third') ||
    raw.includes('place_3') ||
    raw.includes('3rd') ||
    raw.includes('bronze')
  ) {
    return 'placement';
  }
  if (raw.includes('ko') || raw.includes('knock') || raw.includes('viertel') || raw.includes('quarter')) {
    return 'knockout';
  }
  if (raw.includes('group') || raw.includes('gruppe') || raw.includes('vorrunde')) return 'group';
  return raw;
}

function isKnockoutLikePhase(phase: unknown): boolean {
  const p = normalizeSlotPhase(phase);
  return p === 'final' || p === 'semi' || p === 'placement' || p === 'knockout';
}

function slotIsFinished(slot: { match_status?: string | null; official_status?: string | null }): boolean {
  const ms = String(slot.match_status ?? '').trim().toLowerCase();
  if (ms === 'finished' || ms === 'ended' || ms === 'completed') return true;
  const os = String(slot.official_status ?? '').trim().toLowerCase();
  return os === 'finished' || os === 'ended' || os === 'completed';
}

export type OwnTournamentMatchCounts = {
  group: number;
  total: number;
  knockout: number;
};

/** Kompakte Zählung für Trainer-Übersicht (dynamisch, inkl. späterer KO-Spiele). */
export function countOwnTournamentMatchesByPhase(
  slots: Array<{ is_own_team?: boolean | null; match_id?: string | null; phase?: string | null }>,
): OwnTournamentMatchCounts {
  const ours = ourTournamentScheduleSlots(slots);
  let group = 0;
  let knockout = 0;
  for (const slot of ours) {
    if (isKnockoutLikePhase(slot.phase)) knockout += 1;
    else group += 1;
  }
  return { group, knockout, total: ours.length };
}

/**
 * Alle eigenen spielbaren Spiele finished, aber nächste Phase noch nicht sicher /
 * noch nicht veröffentlicht → kein vorschneller Turnierabschluss.
 *
 * Konservativ: Nach reiner Vorrunde warten wir, solange Official-KO fehlt,
 * Platzhalter-Paarungen offen sind oder wir noch beteiligt sein könnten.
 */
export function isAwaitingFurtherTournamentPhase(params: {
  ownSlots: TournamentMatchSlotView[];
  allSlots: TournamentMatchSlotView[];
}): boolean {
  const { ownSlots, allSlots } = params;
  if (ownSlots.length === 0) return false;
  const allOwnFinished = ownSlots.every((slot) => slotIsFinished(slot));
  if (!allOwnFinished) return false;

  const ownOnlyGroup = ownSlots.every((slot) => !isKnockoutLikePhase(slot.phase));
  const knockoutSlots = allSlots.filter((slot) => isKnockoutLikePhase(slot.phase));
  const planHasAnyKnockout = knockoutSlots.length > 0;

  const openCouldInvolveUs = (slot: TournamentMatchSlotView): boolean => {
    if (slotIsFinished(slot)) return false;
    if (slot.is_own_team === true || isOwnPlayableTournamentSlot(slot)) return true;
    // Noch nicht aufgelöste Paarungen (1. Gruppe A, Gewinner HF1, …)
    if (slotLooksUnresolvedPairing(slot)) return true;
    return false;
  };

  if (knockoutSlots.some((slot) => openCouldInvolveUs(slot))) return true;

  // Noch gar keine KO-/Finalslots im Plan → nach Vorrunde weiter warten
  if (ownOnlyGroup && !planHasAnyKnockout) return true;

  // Unfertige Official-Slots ohne Gruppe (oft spätere Runden ohne phase-Tag)
  if (ownOnlyGroup) {
    const openUngrouped = allSlots.filter((slot) => {
      if (slotIsFinished(slot)) return false;
      if (isKnockoutLikePhase(slot.phase)) return false;
      if (safeOptionalText(slot.group_label)) return false;
      return openCouldInvolveUs(slot) || slotLooksUnresolvedPairing(slot);
    });
    if (openUngrouped.length > 0) return true;
  }

  return false;
}

/** Alias / Statusname für Orchestrator & UI. */
export function isAwaitingNextTournamentRound(params: {
  ownSlots: TournamentMatchSlotView[];
  allSlots: TournamentMatchSlotView[];
}): boolean {
  return isAwaitingFurtherTournamentPhase(params);
}

export function tournamentSlotDisplayTitle(slot: TournamentMatchSlot): string {
  const home = safeOptionalText(slot.home_team);
  const away = safeOptionalText(slot.away_team);
  if (home && away) return `${home} vs ${away}`;
  return safeText(slot.opponent_name);
}

/** Ergebniszeile passend zum Titel: bei Fremdspielen Heim:Gast, bei eigenen ggf. gedreht. */
export function tournamentSlotScoreDisplay(slot: TournamentMatchSlotView): string | null {
  const st = (slot.match_status ?? '').toLowerCase();
  if (st !== 'finished' && st !== 'live') return null;
  const ourOrHome = Number(slot.score_home ?? 0);
  const oppOrAway = Number(slot.score_away ?? 0);
  if (!isOwnPlayableTournamentSlot(slot)) {
    return `${ourOrHome}:${oppOrAway}`;
  }
  const home = safeOptionalText(slot.home_team);
  const away = safeOptionalText(slot.away_team);
  const opponent = safeText(slot.opponent_name).toLowerCase();
  if (home && away && opponent) {
    if (opponent === away.toLowerCase()) return `${ourOrHome}:${oppOrAway}`;
    if (opponent === home.toLowerCase()) return `${oppOrAway}:${ourOrHome}`;
  }
  return `${ourOrHome}:${oppOrAway}`;
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
  if (!isOwnPlayableTournamentSlot(slot)) return false;
  const st = (slot.match_status ?? '').toLowerCase();
  return st !== 'live' && st !== 'finished';
}

/** Nächster vorbereitbarer Slot (nach kickoff_at/sort_order), optional nach aktuellem Match. */
export function pickNextPlannedTournamentSlot(
  slots: TournamentMatchSlotView[],
  options?: { afterMatchId?: string | null },
): TournamentMatchSlotView | null {
  const afterMatchId = safeText(options?.afterMatchId);
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
      .map((p) => safeOptionalText(p.group_label))
      .filter((label): label is string => Boolean(label))
      .map((label) => label.toLowerCase()),
  );
  const groupCount = distinctGroups.size;
  const matchCount = slots.length;
  const ownSlots = ownPlayableTournamentSlots(slots);

  if (ownSlots.length === 0 && matchCount === 0) {
    return { teamCount, groupCount, matchCount, nextMatch: null, allFinished: false };
  }

  const allFinished =
    ownSlots.length > 0 &&
    ownSlots.every((s) => (s.match_status ?? '').toLowerCase() === 'finished');
  if (allFinished) {
    return { teamCount, groupCount, matchCount, nextMatch: null, allFinished: true };
  }

  const live = ownSlots.find((s) => (s.match_status ?? '').toLowerCase() === 'live');
  if (live) {
    return { teamCount, groupCount, matchCount, nextMatch: live, allFinished: false };
  }

  const nextMatch =
    ownSlots.find((s) => (s.match_status ?? '').toLowerCase() !== 'finished') ?? null;

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

function normalizeParticipantRow(row: TournamentParticipant): TournamentParticipant {
  return {
    ...row,
    team_name: safeText(row.team_name),
    group_label: safeOptionalText(row.group_label),
  };
}

function normalizeMatchSlotRow(row: TournamentMatchSlot): TournamentMatchSlot {
  const matchId = safeOptionalText(row.match_id);
  return {
    ...row,
    match_id: matchId,
    opponent_name: safeText(row.opponent_name),
    pitch: safeOptionalText(row.pitch),
    group_label: safeOptionalText(row.group_label),
    phase: safeOptionalText(row.phase),
    home_team: safeOptionalText(row.home_team),
    away_team: safeOptionalText(row.away_team),
    is_own_team: typeof row.is_own_team === 'boolean' ? row.is_own_team : Boolean(matchId),
    source: safeOptionalText(row.source) ?? (matchId ? 'spielzeitapp' : 'official'),
    provider: safeOptionalText(row.provider),
    external_match_id: safeOptionalText(row.external_match_id),
    official_status: safeOptionalText(row.official_status),
    official_home_goals:
      row.official_home_goals == null ? null : Number(row.official_home_goals),
    official_away_goals:
      row.official_away_goals == null ? null : Number(row.official_away_goals),
  };
}

export async function fetchTournamentParticipants(
  tournamentEventId: string,
): Promise<{ data: TournamentParticipant[]; error: string | null }> {
  if (isDemoTournamentEventId(tournamentEventId)) {
    return { data: getDemoTournamentParticipants(tournamentEventId), error: null };
  }

  const { data, error } = await supabase
    .from('tournament_participants')
    .select('id, tournament_event_id, team_name, group_label, sort_order')
    .eq('tournament_event_id', tournamentEventId)
    .order('group_label', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('team_name', { ascending: true });

  if (error) return { data: [], error: normalizeTournamentDbError(error.message, error.code) };
  return {
    data: ((data ?? []) as TournamentParticipant[]).map(normalizeParticipantRow),
    error: null,
  };
}

/** Text-Import: Zeilen parsen, Leerzeilen weg, trimmen, keine Duplikate (Batch + bestehende Liste). */
export function parseTournamentParticipantImportLines(
  raw: string,
  existingTeamNames: string[] = [],
): string[] {
  const existing = new Set(existingTeamNames.map((n) => safeText(n).toLowerCase()).filter(Boolean));
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

  if (isDemoTournamentEventId(params.tournamentEventId)) {
    return importDemoTournamentParticipants({
      tournamentEventId: params.tournamentEventId,
      groupLabel: params.groupLabel,
      teamNames: names,
    });
  }

  const { count, error: countErr } = await supabase
    .from('tournament_participants')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_event_id', params.tournamentEventId);

  if (countErr) return { imported: 0, error: normalizeTournamentDbError(countErr.message, countErr.code) };

  const groupLabel = safeOptionalText(params.groupLabel);
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

  if (isDemoTournamentEventId(params.tournamentEventId)) {
    return addDemoTournamentParticipant({
      tournamentEventId: params.tournamentEventId,
      teamName: name,
      groupLabel: params.groupLabel,
    });
  }

  const { count, error: countErr } = await supabase
    .from('tournament_participants')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_event_id', params.tournamentEventId);

  if (countErr) return { error: normalizeTournamentDbError(countErr.message, countErr.code) };

  const { error } = await supabase.from('tournament_participants').insert({
    tournament_event_id: params.tournamentEventId,
    team_name: name,
    group_label: safeOptionalText(params.groupLabel),
    sort_order: (count ?? 0) + 1,
  });

  return { error: error ? normalizeTournamentDbError(error.message, error.code) : null };
}

export async function removeTournamentParticipant(participantId: string): Promise<{ error: string | null }> {
  if (String(participantId ?? '').startsWith('00000000-demo-5000-')) {
    const ok = removeDemoTournamentParticipant(participantId);
    return { error: ok ? null : 'Teilnehmer nicht gefunden.' };
  }
  const { error } = await supabase.from('tournament_participants').delete().eq('id', participantId);
  return { error: error ? normalizeTournamentDbError(error.message, error.code) : null };
}

const TOURNAMENT_MATCH_SELECT_FULL =
  'id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, phase, sort_order, home_team, away_team, is_own_team, source, provider, external_match_id, official_status, home_goals, away_goals';
const TOURNAMENT_MATCH_SELECT_PHASE =
  'id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, phase, sort_order';
const TOURNAMENT_MATCH_SELECT_BASE =
  'id, tournament_event_id, match_id, opponent_name, kickoff_at, planned_minutes, pitch, group_label, sort_order';

function mapFetchedMatchSlotRow(row: Record<string, unknown>): TournamentMatchSlot {
  return normalizeMatchSlotRow({
    id: String(row.id ?? ''),
    tournament_event_id: String(row.tournament_event_id ?? ''),
    match_id: (row.match_id as string | null) ?? null,
    opponent_name: String(row.opponent_name ?? ''),
    kickoff_at: String(row.kickoff_at ?? ''),
    planned_minutes: Number(row.planned_minutes ?? TOURNAMENT_DEFAULT_PLANNED_MINUTES),
    pitch: (row.pitch as string | null) ?? null,
    group_label: (row.group_label as string | null) ?? null,
    phase: (row.phase as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    home_team: (row.home_team as string | null) ?? null,
    away_team: (row.away_team as string | null) ?? null,
    is_own_team: typeof row.is_own_team === 'boolean' ? row.is_own_team : Boolean(row.match_id),
    source: (row.source as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    external_match_id: (row.external_match_id as string | null) ?? null,
    official_status: (row.official_status as string | null) ?? null,
    official_home_goals: row.home_goals == null ? null : Number(row.home_goals),
    official_away_goals: row.away_goals == null ? null : Number(row.away_goals),
  });
}

async function enrichTournamentMatchSlots(
  rows: TournamentMatchSlot[],
): Promise<TournamentMatchSlotView[]> {
  if (rows.length === 0) return [];

  const matchIds = rows.map((r) => r.match_id).filter((id): id is string => Boolean(id));
  if (matchIds.length === 0) {
    return rows.map((r) => enrichOfficialOnlySlot(r));
  }

  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, status, score_home, score_away')
    .in('id', matchIds);

  if (matchErr) {
    return rows.map((r) => enrichOfficialOnlySlot(r));
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
    const matchId = r.match_id;
    if (!matchId || r.is_own_team === false) {
      return enrichOfficialOnlySlot(r);
    }
    const m = matchById.get(matchId);
    return {
      ...r,
      match_status: m?.status ?? null,
      score_home: Number(m?.score_home ?? 0),
      score_away: Number(m?.score_away ?? 0),
      has_lineup: (lineupCounts.get(matchId) ?? 0) > 0,
      has_squad: (benchCounts.get(matchId) ?? 0) > 0,
    };
  });
}

function enrichOfficialOnlySlot(row: TournamentMatchSlot): TournamentMatchSlotView {
  const hasOfficialResult = row.official_home_goals != null && row.official_away_goals != null;
  const officialStatus = (row.official_status ?? '').toLowerCase();
  const matchStatus =
    officialStatus === 'live' || officialStatus === 'finished'
      ? officialStatus
      : hasOfficialResult
        ? 'finished'
        : 'upcoming';
  return {
    ...row,
    match_status: matchStatus,
    score_home: Number(row.official_home_goals ?? 0),
    score_away: Number(row.official_away_goals ?? 0),
    has_lineup: false,
    has_squad: false,
  };
}

export async function fetchTournamentMatchSlots(
  tournamentEventId: string,
): Promise<{ data: TournamentMatchSlotView[]; error: string | null }> {
  if (isDemoTournamentEventId(tournamentEventId)) {
    return { data: getDemoTournamentMatchSlots(tournamentEventId), error: null };
  }

  const selects = [TOURNAMENT_MATCH_SELECT_FULL, TOURNAMENT_MATCH_SELECT_PHASE, TOURNAMENT_MATCH_SELECT_BASE];
  let data: Record<string, unknown>[] | null = null;
  let error: { message?: string; code?: string } | null = null;

  for (const columns of selects) {
    const res = await supabase
      .from('tournament_matches')
      .select(columns)
      .eq('tournament_event_id', tournamentEventId)
      .order('kickoff_at', { ascending: true })
      .order('sort_order', { ascending: true });
    data = (res.data as Record<string, unknown>[] | null) ?? null;
    error = res.error;
    if (!error) break;
    if (!/column|schema cache|does not exist/i.test(String(error.message ?? ''))) break;
  }

  if (error) return { data: [], error: normalizeTournamentDbError(error.message ?? '', error.code) };
  const rows = (data ?? []).map((row) => mapFetchedMatchSlotRow(row));
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
  homeTeam?: string | null;
  awayTeam?: string | null;
  provider?: string | null;
  externalMatchId?: string | null;
}): Promise<{ slotId: string | null; matchId: string | null; error: string | null }> {
  const opponent = params.opponentName.trim();
  if (!opponent) return { slotId: null, matchId: null, error: 'Gegner fehlt.' };

  const kickoffIso = meetupUtcIsoOnViennaEventDay(params.tournamentDayIso, params.kickoffTimeHHmm);
  if (!kickoffIso) return { slotId: null, matchId: null, error: 'Ungültige Anstoßzeit.' };

  if (isDemoTournamentEventId(params.tournamentEventId)) {
    const created = createDemoTournamentMatchSlot({
      tournamentEventId: params.tournamentEventId,
      opponentName: opponent,
      kickoffAt: kickoffIso,
      pitch: params.pitch,
      groupLabel: params.groupLabel,
      phase: params.phase,
    });
    if (created.error || !created.matchId) {
      return { slotId: null, matchId: null, error: created.error ?? 'Spiel konnte nicht angelegt werden.' };
    }
    return { slotId: created.matchId, matchId: created.matchId, error: null };
  }

  const kickoff = new Date(kickoffIso);
  const vienna = getDateTimePartsInTimeZone(kickoff, VIENNA_TZ);
  const matchDate = vienna
    ? `${vienna.year}-${String(vienna.month).padStart(2, '0')}-${String(vienna.day).padStart(2, '0')}`
    : kickoffIso.slice(0, 10);
  const matchTime = utcIsoToViennaTimeHHmm(kickoffIso);

  const locationParts = [safeOptionalText(params.location), safeOptionalText(params.pitch)].filter(Boolean);
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
    pitch: safeOptionalText(params.pitch),
    group_label: safeOptionalText(params.groupLabel),
    sort_order: (count ?? 0) + 1,
    home_team: safeOptionalText(params.homeTeam) ?? null,
    away_team: safeOptionalText(params.awayTeam) ?? null,
    is_own_team: true,
    source: 'spielzeitapp',
    provider: safeOptionalText(params.provider),
    external_match_id: safeOptionalText(params.externalMatchId),
  };
  const phaseValue = safeOptionalText(params.phase);
  if (phaseValue) slotRow.phase = phaseValue;

  let insertRes = await supabase.from('tournament_matches').insert(slotRow).select('id').single();

  if (insertRes.error && /column|schema cache/i.test(String(insertRes.error.message ?? ''))) {
    const retryRow = { ...slotRow };
    delete retryRow.home_team;
    delete retryRow.away_team;
    delete retryRow.is_own_team;
    delete retryRow.source;
    delete retryRow.provider;
    delete retryRow.external_match_id;
    if (/phase/i.test(String(insertRes.error.message ?? ''))) delete retryRow.phase;
    insertRes = await supabase.from('tournament_matches').insert(retryRow).select('id').single();
  }

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
  if (String(matchId ?? '').startsWith('00000000-demo-5000-')) {
    const ok = removeDemoTournamentMatchSlot(matchId);
    return { error: ok ? null : 'Spiel nicht gefunden.' };
  }
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  return { error: error ? normalizeTournamentDbError(error.message, error.code) : null };
}

function sameNullableInt(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Number(a) === Number(b);
}

export async function upsertOfficialTournamentMatch(params: {
  tournamentEventId: string;
  existingSlotId?: string | null;
  homeTeam: string;
  awayTeam: string;
  opponentName: string;
  kickoffAtIso: string;
  plannedMinutes: number;
  pitch?: string | null;
  groupLabel?: string | null;
  phase?: string | null;
  provider: string;
  externalMatchId: string;
  officialStatus: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
}): Promise<{ slotId: string | null; created: boolean; updated: boolean; error: string | null }> {
  const homeTeam = params.homeTeam.trim();
  const awayTeam = params.awayTeam.trim();
  if (!homeTeam || !awayTeam) {
    return { slotId: null, created: false, updated: false, error: 'Teams fehlen.' };
  }

  const planned = Math.max(
    1,
    Math.min(120, Math.trunc(params.plannedMinutes || TOURNAMENT_DEFAULT_PLANNED_MINUTES)),
  );
  const payload: Record<string, unknown> = {
    tournament_event_id: params.tournamentEventId,
    match_id: null,
    opponent_name: params.opponentName.trim() || `${homeTeam} vs ${awayTeam}`,
    kickoff_at: params.kickoffAtIso,
    planned_minutes: planned,
    pitch: safeOptionalText(params.pitch),
    group_label: safeOptionalText(params.groupLabel),
    phase: safeOptionalText(params.phase),
    home_team: homeTeam,
    away_team: awayTeam,
    is_own_team: false,
    source: 'official',
    provider: params.provider,
    external_match_id: params.externalMatchId,
    official_status: safeOptionalText(params.officialStatus),
    home_goals: params.homeGoals,
    away_goals: params.awayGoals,
  };

  if (params.existingSlotId) {
    const { data: current } = await supabase
      .from('tournament_matches')
      .select('home_team, away_team, kickoff_at, pitch, group_label, phase, official_status, home_goals, away_goals')
      .eq('id', params.existingSlotId)
      .maybeSingle();
    const unchanged =
      current &&
      String(current.home_team ?? '') === homeTeam &&
      String(current.away_team ?? '') === awayTeam &&
      String(current.kickoff_at ?? '') === params.kickoffAtIso &&
      String(current.pitch ?? '') === String(payload.pitch ?? '') &&
      String(current.group_label ?? '') === String(payload.group_label ?? '') &&
      String(current.phase ?? '') === String(payload.phase ?? '') &&
      String(current.official_status ?? '') === String(payload.official_status ?? '') &&
      sameNullableInt(current.home_goals, params.homeGoals) &&
      sameNullableInt(current.away_goals, params.awayGoals);

    if (unchanged) {
      return { slotId: params.existingSlotId, created: false, updated: false, error: null };
    }

    const { error } = await supabase.from('tournament_matches').update(payload).eq('id', params.existingSlotId);
    if (error) {
      return {
        slotId: params.existingSlotId,
        created: false,
        updated: false,
        error: normalizeTournamentDbError(error.message, error.code),
      };
    }
    return { slotId: params.existingSlotId, created: false, updated: true, error: null };
  }

  const { count } = await supabase
    .from('tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_event_id', params.tournamentEventId);
  payload.sort_order = (count ?? 0) + 1;

  const { data, error } = await supabase.from('tournament_matches').insert(payload).select('id').single();
  if (error) {
    const isUnique =
      error.code === '23505' || /duplicate|unique/i.test(String(error.message ?? ''));
    if (isUnique && params.externalMatchId) {
      const { data: existing } = await supabase
        .from('tournament_matches')
        .select('id')
        .eq('tournament_event_id', params.tournamentEventId)
        .eq('external_match_id', params.externalMatchId)
        .maybeSingle();
      if (existing?.id) {
        return upsertOfficialTournamentMatch({ ...params, existingSlotId: String(existing.id) });
      }
    }
    return { slotId: null, created: false, updated: false, error: normalizeTournamentDbError(error.message, error.code) };
  }
  return {
    slotId: (data as { id?: string } | null)?.id ?? null,
    created: true,
    updated: false,
    error: null,
  };
}

export async function convertOfficialSlotToOwnMatch(params: {
  slotId: string;
  teamSeasonId: string;
  tournamentDayIso: string;
  location: string | null;
  opponentName: string;
  kickoffTimeHHmm: string;
  plannedMinutes: number;
  pitch?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  provider?: string | null;
  externalMatchId?: string | null;
}): Promise<{ matchId: string | null; error: string | null }> {
  const kickoffIso = meetupUtcIsoOnViennaEventDay(params.tournamentDayIso, params.kickoffTimeHHmm);
  if (!kickoffIso) return { matchId: null, error: 'Ungültige Anstoßzeit.' };

  const kickoff = new Date(kickoffIso);
  const vienna = getDateTimePartsInTimeZone(kickoff, VIENNA_TZ);
  const matchDate = vienna
    ? `${vienna.year}-${String(vienna.month).padStart(2, '0')}-${String(vienna.day).padStart(2, '0')}`
    : kickoffIso.slice(0, 10);
  const matchTime = utcIsoToViennaTimeHHmm(kickoffIso);
  const locationParts = [safeOptionalText(params.location), safeOptionalText(params.pitch)].filter(Boolean);

  const { matchId, error: matchErr } = await upsertMatchForSetup({
    matchId: null,
    teamSeasonId: params.teamSeasonId,
    opponent: params.opponentName.trim(),
    matchDate,
    matchTime,
    locationNote: locationParts.join(' · ') || '',
  });
  if (matchErr || !matchId) {
    return { matchId: null, error: matchErr ? normalizeTournamentDbError(matchErr, null) : 'Spiel konnte nicht angelegt werden.' };
  }

  const planned = Math.max(1, Math.min(120, Math.trunc(params.plannedMinutes || TOURNAMENT_DEFAULT_PLANNED_MINUTES)));
  await updateMatchRow(matchId, { planned_match_minutes: planned });

  const { error } = await attachMatchToExistingSlot({
    slotId: params.slotId,
    matchId,
    opponentName: params.opponentName,
    homeTeam: params.homeTeam,
    awayTeam: params.awayTeam,
    provider: params.provider,
    externalMatchId: params.externalMatchId,
  });
  if (error) {
    await supabase.from('matches').delete().eq('id', matchId);
    return { matchId: null, error };
  }
  return { matchId, error: null };
}

export async function attachMatchToExistingSlot(params: {
  slotId: string;
  matchId: string;
  opponentName: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
  provider?: string | null;
  externalMatchId?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tournament_matches')
    .update({
      match_id: params.matchId,
      opponent_name: params.opponentName,
      is_own_team: true,
      source: 'spielzeitapp',
      home_team: safeOptionalText(params.homeTeam),
      away_team: safeOptionalText(params.awayTeam),
      provider: safeOptionalText(params.provider),
      external_match_id: safeOptionalText(params.externalMatchId),
    })
    .eq('id', params.slotId);
  return { error: error ? normalizeTournamentDbError(error.message, error.code) : null };
}

export async function updateOwnTournamentSlotSchedule(params: {
  slotId: string;
  kickoffAtIso: string;
  pitch?: string | null;
  groupLabel?: string | null;
  phase?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  opponentName?: string | null;
  provider?: string | null;
  externalMatchId?: string | null;
}): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {
    kickoff_at: params.kickoffAtIso,
    pitch: safeOptionalText(params.pitch),
    group_label: safeOptionalText(params.groupLabel),
    phase: safeOptionalText(params.phase),
    home_team: safeOptionalText(params.homeTeam),
    away_team: safeOptionalText(params.awayTeam),
    provider: safeOptionalText(params.provider),
    external_match_id: safeOptionalText(params.externalMatchId),
  };
  const opponentName = safeOptionalText(params.opponentName);
  if (opponentName) payload.opponent_name = opponentName;

  const { error } = await supabase.from('tournament_matches').update(payload).eq('id', params.slotId);
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

  if (String(params.matchId ?? '').startsWith('00000000-demo-5000-')) {
    return applyDemoTournamentMatchResult({
      matchId: params.matchId,
      ourGoals,
      oppGoals,
    });
  }

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
    const key = safeOptionalText(p.group_label);
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
