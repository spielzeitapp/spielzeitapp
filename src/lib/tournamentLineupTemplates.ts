import { supabase } from "./supabaseClient";
import { resolveRotationForMatch, sameRotationSlots } from './tournamentRotation';
import { templateEmptySlots } from './tournamentLineupTemplate';
import { isDemoTournamentEventId } from "../demo/demoTournamentState";
import {
  readMatchLineupVariants,
  writeMatchLineupVariants,
  type StoredMatchLineupVariants,
} from "./matchLineupVariants";
export type TournamentTemplateRecord = {
  blocks: StoredMatchLineupVariants;
  updated_at: string;
};
const key = (id: string) => `sz:tournament-template:v1:${id}`;
export async function fetchTournamentLineupTemplate(
  eventId: string,
): Promise<TournamentTemplateRecord | null> {
  if (isDemoTournamentEventId(eventId)) {
    try {
      return JSON.parse(localStorage.getItem(key(eventId)) || "null");
    } catch {
      return null;
    }
  }
  const { data, error } = await supabase
    .from("tournament_lineup_templates")
    .select("blocks,updated_at")
    .eq("tournament_event_id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TournamentTemplateRecord | null;
}
export async function saveTournamentLineupTemplate(
  eventId: string,
  blocks: StoredMatchLineupVariants,
  stamp: string | null,
): Promise<string> {
  if (isDemoTournamentEventId(eventId)) {
    const current = await fetchTournamentLineupTemplate(eventId);
    if ((current?.updated_at ?? null) !== stamp)
      throw new Error("Grundaufstellung wurde geändert. Bitte neu laden.");
    const updated_at = new Date().toISOString();
    localStorage.setItem(key(eventId), JSON.stringify({ blocks, updated_at }));
    return updated_at;
  }
  const { data, error } = await supabase.rpc(
    "save_tournament_lineup_template",
    { p_event: eventId, p_blocks: blocks, p_expected_updated_at: stamp },
  );
  if (error) throw new Error(error.message);
  return data as string;
}
export async function applyTournamentLineupTemplate(
  eventId: string,
  matchId: string,
  record: TournamentTemplateRecord,
): Promise<void> {
  if (isDemoTournamentEventId(eventId))
    throw new Error(
      "Die Übernahme wird für echte, noch nicht vorbereitete Turnierspiele angeboten.",
    );
  // Validate the per-game plan before the RPC creates the canonical start lineup.
  const resolved = await resolveStoredRotation(record.blocks, matchId);
  const { error } = await supabase.rpc("apply_tournament_lineup_template", {
    p_event: eventId,
    p_match: matchId,
    p_expected_updated_at: record.updated_at,
  });
  if (error) throw new Error(error.message);
  writeMatchLineupVariants(matchId, resolved);
}
async function resolveStoredRotation(blocks: StoredMatchLineupVariants, matchId: string): Promise<StoredMatchLineupVariants> {
  if (!blocks.rotation || blocks.rotationMatch) return blocks;
  const { data, error } = await supabase.from('tournament_matches').select('phase,planned_minutes').eq('match_id', matchId).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'Spielphase konnte nicht geladen werden.');
  return resolveRotationForMatch(blocks, matchId, data.phase, data.planned_minutes);
}
export async function fetchRemoteMatchBlocks(
  matchId: string,
): Promise<StoredMatchLineupVariants | null> {
  if (matchId.includes("demo")) return readMatchLineupVariants(matchId);
  let hasRotation = false;
  try {
    const { data, error } = await supabase
      .from("matches")
      .select("tournament_lineup_blocks")
      .eq("id", matchId)
      .maybeSingle();
    if (error) return null;
    const value =
      data?.tournament_lineup_blocks as StoredMatchLineupVariants | null;
    hasRotation = Boolean(value?.rotation);
    return value?.version === 1 &&
      value.variants?.[1]?.slots &&
      value.variants?.[2]?.slots
      ? await resolveStoredRotation(value, matchId)
      : null;
  } catch (error) {
    // Never let an unresolved scheduled plan fall back to legacy A/B rotation.
    if (hasRotation || readMatchLineupVariants(matchId)?.rotation) throw error;
    return null;
  }
}
export async function saveRemoteMatchBlocks(
  matchId: string,
  blocks: StoredMatchLineupVariants,
): Promise<void> {
  if (matchId.includes("demo")) return;
  // The regular lineup editor reconstructs variants; preserve per-match policy.
  const previous = readMatchLineupVariants(matchId);
  blocks = { ...blocks, rotation: blocks.rotation ?? previous?.rotation, rotationMatch: blocks.rotationMatch ?? previous?.rotationMatch };
  const { error } = await supabase
    .from("matches")
    .update({ tournament_lineup_blocks: blocks })
    .eq("id", matchId)
    .eq("status", "upcoming");
  if (error) throw new Error(error.message);
}

/** Attach only the policy to an already prepared, upcoming match. Never replace its lineup. */
export async function savePreparedTournamentRotation(matchId: string, blocks: StoredMatchLineupVariants, phase: string | null | undefined, duration: number): Promise<void> {
  const resolved = resolveRotationForMatch(blocks, matchId, phase, duration);
  const [lineup, bench] = await Promise.all([
    supabase.from('match_lineup').select('slot,player_id').eq('match_id', matchId),
    supabase.from('match_bench').select('player_id').eq('match_id', matchId),
  ]);
  if (lineup.error || bench.error) throw new Error((lineup.error || bench.error)!.message);
  const actual = templateEmptySlots();
  for (const row of lineup.data ?? []) {
    if (row.slot in actual) actual[row.slot as keyof typeof actual] = row.player_id;
  }
  const actualSquad = new Set([...(lineup.data ?? []).map(row => row.player_id), ...(bench.data ?? []).map(row => row.player_id)]);
  const start = resolved.variants[resolved.startVariant];
  if (!sameRotationSlots(actual, start.slots) || actualSquad.size !== start.squadIds.length || [...actualSquad].some(id => !start.squadIds.includes(id))) throw new Error('Dieses Spiel hat eine andere Aufstellung oder einen anderen Kader. Zuerst im Spiel mit der geplanten Startaufstellung abgleichen.');
  const { data, error } = await supabase.from('matches').update({ tournament_lineup_blocks: resolved })
    .eq('id', matchId).eq('status', 'upcoming').is('live_started_at', null).select('id').maybeSingle();
  if (error || !data) throw new Error(error?.message ?? 'Spiel wurde bereits gestartet oder ist nicht bearbeitbar.');
  writeMatchLineupVariants(matchId, resolved);
}

/** Prepare empty tournament matches before the regular match editor loads defaults.
 * The existing RPC locks the match and protects started games and existing lineups.
 */
async function prepareTournamentMatchTemplateOnce(matchId: string): Promise<TournamentTemplateRecord | null> {
  const { fetchTournamentEventIdForMatch } = await import('./tournamentSquad');
  const eventId = await fetchTournamentEventIdForMatch(matchId);
  if (!eventId || isDemoTournamentEventId(eventId)) return null;
  const record = await fetchTournamentLineupTemplate(eventId);
  if (!record) return null;
  const { data: match, error: matchError } = await supabase.from('matches')
    .select('status,live_started_at,tournament_lineup_blocks').eq('id', matchId).maybeSingle();
  if (matchError) throw new Error(matchError.message);
  if (!match || match.status !== 'upcoming' || match.live_started_at || match.tournament_lineup_blocks) return record;
  const { data: lineup, error } = await supabase.from('match_lineup').select('player_id').eq('match_id', matchId).limit(1);
  if (error) throw new Error(error.message);
  if (lineup?.length) return record;
  const { tournamentTemplateReady } = await import('./tournamentLineupTemplate');
  const squad = record.blocks.variants[record.blocks.startVariant]?.squadIds ?? [];
  if (!tournamentTemplateReady(record.blocks, squad)) return record;
  const [{ data: bench, error: benchError }, { data: events, error: eventError }] = await Promise.all([
    supabase.from('match_bench').select('player_id').eq('match_id', matchId).limit(100),
    supabase.from('match_events').select('id').eq('match_id', matchId).limit(1),
  ]);
  if (benchError || eventError) throw new Error((benchError || eventError)!.message);
  // Preserve a deliberately changed roster (e.g. an injured player left out).
  if (events?.length || (bench?.length && (bench.length !== squad.length || bench.some(row => !squad.includes(row.player_id))))) return record;
  await applyTournamentLineupTemplate(eventId, matchId, record);
  return record;
}

const preparationInFlight = new Map<string, Promise<TournamentTemplateRecord | null>>();
export function prepareTournamentMatchFromTemplate(matchId: string): Promise<TournamentTemplateRecord | null> {
  const existing = preparationInFlight.get(matchId);
  if (existing) return existing;
  const task = prepareTournamentMatchTemplateOnce(matchId).finally(() => preparationInFlight.delete(matchId));
  preparationInFlight.set(matchId, task);
  return task;
}
