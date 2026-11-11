import { supabase } from "./supabaseClient";
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
  const { error } = await supabase.rpc("apply_tournament_lineup_template", {
    p_event: eventId,
    p_match: matchId,
    p_expected_updated_at: record.updated_at,
  });
  if (error) throw new Error(error.message);
  writeMatchLineupVariants(matchId, record.blocks);
}
export async function fetchRemoteMatchBlocks(
  matchId: string,
): Promise<StoredMatchLineupVariants | null> {
  if (matchId.includes("demo")) return readMatchLineupVariants(matchId);
  try {
    const { data, error } = await supabase
      .from("matches")
      .select("tournament_lineup_blocks")
      .eq("id", matchId)
      .maybeSingle();
    if (error) return null;
    const value =
      data?.tournament_lineup_blocks as StoredMatchLineupVariants | null;
    return value?.version === 1 &&
      value.variants?.[1]?.slots &&
      value.variants?.[2]?.slots
      ? value
      : null;
  } catch {
    return null;
  }
}
export async function saveRemoteMatchBlocks(
  matchId: string,
  blocks: StoredMatchLineupVariants,
): Promise<void> {
  if (matchId.includes("demo")) return;
  const { error } = await supabase
    .from("matches")
    .update({ tournament_lineup_blocks: blocks })
    .eq("id", matchId)
    .eq("status", "upcoming")
    .not("tournament_lineup_blocks", "is", null);
  if (error) throw new Error(error.message);
}
