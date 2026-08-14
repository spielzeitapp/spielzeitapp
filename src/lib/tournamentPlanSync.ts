/**
 * Throttled official tournament-plan sync for staging/test.
 * Trainer writes persist; on error local slots stay unchanged.
 */

import { analyzeTournamentUrl, importTournamentPlanFromAnalysis } from './tournamentPlanImport';
import { fetchTournamentImportRecognition } from './tournamentPlanImport';
import type { TournamentMatchSlotView, TournamentParticipant } from './tournamentPlan';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from './viennaTime';

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

export function markOfficialTournamentSynced(eventId: string): void {
  const id = eventId.trim();
  if (id) lastSyncAtByEvent.set(id, Date.now());
}

export function getOfficialTournamentSyncedAt(eventId: string): number | null {
  return lastSyncAtByEvent.get(eventId.trim()) ?? null;
}

export function formatTournamentPlanSyncAge(syncedAt: number | null, now = Date.now()): string | null {
  if (!syncedAt) return null;
  const minutes = Math.max(0, Math.floor((now - syncedAt) / 60_000));
  if (minutes <= 0) return 'Turnierplan aktualisiert gerade';
  if (minutes === 1) return 'Turnierplan aktualisiert vor 1 Min.';
  return `Turnierplan aktualisiert vor ${minutes} Min.`;
}

export function participantsToTeamNames(participants: TournamentParticipant[]): string[] {
  return participants.map((p) => p.team_name);
}
