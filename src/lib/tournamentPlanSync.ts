/**
 * Throttled official tournament-plan sync for staging/test.
 * Trainer writes persist; on error local slots stay unchanged.
 */

import { analyzeTournamentUrl, importTournamentPlanFromAnalysis } from './tournamentPlanImport';
import { fetchTournamentImportRecognition } from './tournamentPlanImport';
import {
  fetchTournamentMatchSlots,
  fetchTournamentParticipants,
  type TournamentMatchSlotView,
  type TournamentParticipant,
} from './tournamentPlan';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from './viennaTime';
import { supabase } from './supabaseClient';
import { safeOptionalText, safeText } from './safeText';

const SYNC_COOLDOWN_MS = 60 * 1000;
const lastSyncAtByEvent = new Map<string, number>();

export function isViennaTournamentDay(tournamentDayIso: string, now = new Date()): boolean {
  const eventParts = getDateTimePartsInTimeZone(new Date(tournamentDayIso), VIENNA_TZ);
  const nowParts = getDateTimePartsInTimeZone(now, VIENNA_TZ);
  if (!eventParts || !nowParts) return false;
  return (
    eventParts.year === nowParts.year &&
    eventParts.month === nowParts.month &&
    eventParts.day === nowParts.day
  );
}

export function isOfficialTournamentSyncActive(params: {
  tournamentArchived?: boolean;
  tournamentDayIso: string;
  hasUnfinishedOwnMatch?: boolean;
  now?: Date;
}): boolean {
  if (params.tournamentArchived) return false;
  if (params.hasUnfinishedOwnMatch) return true;
  return isViennaTournamentDay(params.tournamentDayIso, params.now);
}

export type OfficialTournamentSyncResult = {
  ok: boolean;
  skipped: boolean;
  changed: boolean;
  error: string | null;
  syncedAt: number | null;
};

export async function syncOfficialTournamentPlan(params: {
  tournamentEventId: string;
  teamSeasonId: string;
  tournamentDayIso: string;
  location: string | null;
  officialUrl: string;
  existingTeamNames: string[];
  existingSlots: TournamentMatchSlotView[];
  force?: boolean;
}): Promise<OfficialTournamentSyncResult> {
  const eventId = params.tournamentEventId.trim();
  const url = params.officialUrl.trim();
  if (!eventId || !url) {
    return { ok: false, skipped: true, changed: false, error: null, syncedAt: lastSyncAtByEvent.get(eventId) ?? null };
  }

  const now = Date.now();
  const last = lastSyncAtByEvent.get(eventId) ?? 0;
  if (!params.force && now - last < SYNC_COOLDOWN_MS) {
    return { ok: true, skipped: true, changed: false, error: null, syncedAt: last || null };
  }

  try {
    const recognition = await fetchTournamentImportRecognition(params.teamSeasonId);
    const analyzed = await analyzeTournamentUrl(url);
    if (!analyzed.ok) {
      return {
        ok: false,
        skipped: false,
        changed: false,
        error: analyzed.error,
        syncedAt: last || null,
      };
    }

    const result = await importTournamentPlanFromAnalysis({
      tournamentEventId: eventId,
      teamSeasonId: params.teamSeasonId,
      tournamentDayIso: params.tournamentDayIso,
      location: params.location,
      analysis: analyzed.analysis,
      existingTeamNames: params.existingTeamNames,
      existingSlots: params.existingSlots,
      knownNames: recognition.knownNames,
    });

    lastSyncAtByEvent.set(eventId, Date.now());
    if (result.error) {
      return { ok: false, skipped: false, changed: false, error: result.error, syncedAt: lastSyncAtByEvent.get(eventId) ?? null };
    }

    const changed =
      result.importedTeams > 0 || result.importedMatches > 0 || result.updatedResults > 0;
    return { ok: true, skipped: false, changed, error: null, syncedAt: lastSyncAtByEvent.get(eventId) ?? null };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      changed: false,
      error: err instanceof Error ? err.message : 'Turnierplan-Sync fehlgeschlagen.',
      syncedAt: lastSyncAtByEvent.get(eventId) ?? null,
    };
  }
}

/**
 * Nach eigenem Turnierspiel-Ende: TURNIERlive forcen.
 * Eigene App-Ergebnisse bleiben Source of Truth (Import überschreibt sie nicht).
 */
export async function syncOfficialPlanAfterTournamentMatchFinish(
  matchId: string,
): Promise<OfficialTournamentSyncResult & { tournamentEventId: string | null }> {
  const mid = safeText(matchId);
  if (!mid) {
    return { ok: false, skipped: true, changed: false, error: null, syncedAt: null, tournamentEventId: null };
  }

  const { data: link, error: linkErr } = await supabase
    .from('tournament_matches')
    .select('tournament_event_id')
    .eq('match_id', mid)
    .maybeSingle();

  if (linkErr || !link?.tournament_event_id) {
    return { ok: false, skipped: true, changed: false, error: null, syncedAt: null, tournamentEventId: null };
  }

  const tournamentEventId = String(link.tournament_event_id);
  const { data: eventRow, error: eventErr } = await supabase
    .from('events')
    .select('id, team_season_id, starts_at, location, official_tournament_url, kind')
    .eq('id', tournamentEventId)
    .maybeSingle();

  if (eventErr || !eventRow || String(eventRow.kind ?? '') !== 'tournament') {
    return { ok: false, skipped: true, changed: false, error: null, syncedAt: null, tournamentEventId };
  }

  const officialUrl = safeOptionalText(
    (eventRow as { official_tournament_url?: string | null }).official_tournament_url,
  );
  const teamSeasonId = safeText((eventRow as { team_season_id?: string | null }).team_season_id);
  const tournamentDayIso =
    safeOptionalText((eventRow as { starts_at?: string | null }).starts_at) || new Date().toISOString();
  const location = safeOptionalText((eventRow as { location?: string | null }).location);

  if (!officialUrl || !teamSeasonId) {
    return { ok: true, skipped: true, changed: false, error: null, syncedAt: null, tournamentEventId };
  }

  const [slotsRes, participantsRes] = await Promise.all([
    fetchTournamentMatchSlots(tournamentEventId),
    fetchTournamentParticipants(tournamentEventId),
  ]);

  const result = await syncOfficialTournamentPlan({
    tournamentEventId,
    teamSeasonId,
    tournamentDayIso,
    location,
    officialUrl,
    existingTeamNames: (participantsRes.data ?? []).map((p) => p.team_name),
    existingSlots: slotsRes.data ?? [],
    force: true,
  });

  return { ...result, tournamentEventId };
}

export function markOfficialTournamentSynced(eventId: string): void {
  const id = eventId.trim();
  if (id) lastSyncAtByEvent.set(id, Date.now());
}

export function getOfficialTournamentSyncedAt(eventId: string): number | null {
  return lastSyncAtByEvent.get(eventId.trim()) ?? null;
}

export function formatTournamentPlanSyncAge(syncedAt: number | null, now = Date.now()): string | null {
  if (!syncedAt) return null;
  const seconds = Math.max(0, Math.floor((now - syncedAt) / 1000));
  if (seconds < 45) return 'Turnierplan aktualisiert vor wenigen Sekunden';
  const minutes = Math.floor(seconds / 60);
  if (minutes <= 1) return 'Turnierplan aktualisiert vor 1 Min.';
  return `Turnierplan aktualisiert vor ${minutes} Min.`;
}

export function participantsToTeamNames(participants: TournamentParticipant[]): string[] {
  return participants.map((p) => p.team_name);
}
