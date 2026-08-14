/**
 * Saisonplan-Daten: Events einer team_season für den Saisonplan-PDF-Export.
 * events = Source of Truth; keine Twin-/Storage-PDFs.
 */
import { supabase } from './supabaseClient';
import { isInternalChampionshipFixture } from './championshipVisibility';
import { isTournamentEvent, normalizeEventKind } from './eventTypeUtils';
import { formatVisibleMatchEncounter } from './oefbTeamNameNormalize';
import { safeText } from './safeText';
import type { SeasonPlanEventKind, SeasonPlanRow } from './seasonPlanPdf';

function eventNotesTitle(notes: unknown): string | null {
  const t = safeText(notes)
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean)[0];
  return t || null;
}

export type SeasonPlanEventSource = {
  id: string;
  team_season_id: string;
  kind: string;
  type: string | null;
  match_type: string | null;
  opponent: string | null;
  is_home: boolean | null;
  location: string | null;
  venue_id: string | null;
  address: string | null;
  starts_at: string;
  meeting_at: string | null;
  status: string | null;
  notes: string | null;
  match_id: string | null;
  opponent_logo_url: string | null;
  fixture_status: string | null;
  competition: string | null;
  external_source: string | null;
};

const SEASON_PLAN_SELECT =
  'id, team_season_id, kind, type, match_type, opponent, is_home, location, venue_id, address, starts_at, meeting_at, status, notes, match_id, opponent_logo_url, fixture_status, competition, external_source';

const SEASON_PLAN_SELECT_CORE =
  'id, team_season_id, kind, type, match_type, opponent, is_home, location, starts_at, meeting_at, status, notes, match_id, opponent_logo_url, fixture_status, competition, external_source';

function isMissingColumnError(message: string): boolean {
  return /venue_id|address|opponent_logo_url|fixture_status|competition|external_source|column|schema cache/i.test(
    message,
  );
}

function formatEncounterTitle(
  isHome: boolean | null | undefined,
  ourTeamName: string,
  opponent: string | null | undefined,
): string {
  return formatVisibleMatchEncounter({
    isHome,
    ourTeamName,
    opponentName: opponent,
  }).line;
}

function tournamentTitle(ev: SeasonPlanEventSource): string {
  return (
    eventNotesTitle(ev.notes) ||
    String(ev.competition ?? '').trim() ||
    String(ev.opponent ?? '').trim() ||
    'Turnier'
  );
}

function venueLocationText(ev: SeasonPlanEventSource): string | null {
  const loc = String(ev.location ?? '').trim();
  if (loc) return loc;
  const addr = String(ev.address ?? '').trim();
  return addr || null;
}

/**
 * Klassifiziert ein Event für den Saisonplan.
 * null = ausschließen (Training, open/agreed, sonstige Events, abgesagt).
 */
export function classifySeasonPlanEvent(
  ev: Pick<
    SeasonPlanEventSource,
    'kind' | 'type' | 'match_type' | 'fixture_status' | 'status'
  >,
): SeasonPlanEventKind | null {
  const status = String(ev.status ?? '')
    .trim()
    .toLowerCase();
  if (status === 'canceled' || status === 'cancelled') return null;

  if (isInternalChampionshipFixture(ev.fixture_status)) return null;

  if (isTournamentEvent(ev)) return 'tournament';

  const kind = normalizeEventKind(ev.kind);
  if (kind === 'training') return null;
  if (kind === 'event') return null;

  if (kind === 'match') {
    const fs = String(ev.fixture_status ?? '')
      .trim()
      .toLowerCase();
    if (fs === 'published') return 'championship';
    if (!fs) return 'friendly';
    return null;
  }

  return null;
}

export function eventToSeasonPlanRow(
  ev: SeasonPlanEventSource,
  ourTeamName: string,
  kind: SeasonPlanEventKind,
): SeasonPlanRow {
  if (kind === 'tournament') {
    return {
      id: ev.id,
      kind,
      starts_at: ev.starts_at,
      meeting_at: ev.meeting_at,
      location: venueLocationText(ev),
      title: tournamentTitle(ev),
      is_home: null,
      opponent: null,
      opponent_logo_url: null,
      venue_id: ev.venue_id ?? null,
    };
  }

  return {
    id: ev.id,
    kind,
    starts_at: ev.starts_at,
    meeting_at: ev.meeting_at,
    location: venueLocationText(ev),
    title: formatEncounterTitle(ev.is_home, ourTeamName, ev.opponent),
    is_home: ev.is_home,
    opponent: ev.opponent,
    opponent_logo_url: ev.opponent_logo_url,
    venue_id: ev.venue_id ?? null,
  };
}

function sortKey(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Chronologisch: starts_at, bei Gleichstand meeting_at. */
export function sortSeasonPlanRows(rows: SeasonPlanRow[]): SeasonPlanRow[] {
  return [...rows].sort((a, b) => {
    const sa = sortKey(a.starts_at);
    const sb = sortKey(b.starts_at);
    if (sa !== sb) return sa - sb;
    return sortKey(a.meeting_at) - sortKey(b.meeting_at);
  });
}

/**
 * Lädt Saisonplan-Zeilen für eine team_season (aktiv oder später Archiv).
 * Dedupliziert nach Event-ID. Standard: keine Trainings.
 */
export async function loadSeasonPlanRows(opts: {
  teamSeasonId: string;
  ourTeamName: string;
  includeTrainings?: boolean;
}): Promise<{ rows: SeasonPlanRow[]; error: string | null }> {
  const id = opts.teamSeasonId?.trim();
  if (!id) return { rows: [], error: 'Keine Saison gewählt.' };

  let res = await supabase
    .from('events')
    .select(SEASON_PLAN_SELECT)
    .eq('team_season_id', id)
    .order('starts_at', { ascending: true });

  if (res.error && isMissingColumnError(res.error.message)) {
    res = await supabase
      .from('events')
      .select(SEASON_PLAN_SELECT_CORE)
      .eq('team_season_id', id)
      .order('starts_at', { ascending: true });
  }

  if (res.error) {
    return { rows: [], error: res.error.message };
  }

  const seen = new Set<string>();
  const rows: SeasonPlanRow[] = [];
  const ourName = (opts.ourTeamName || 'Mannschaft').trim() || 'Mannschaft';

  for (const raw of (res.data ?? []) as SeasonPlanEventSource[]) {
    const eventId = String(raw?.id ?? '').trim();
    if (!eventId || seen.has(eventId)) continue;
    seen.add(eventId);

    let kind = classifySeasonPlanEvent(raw);
    if (!kind) continue;
    if (kind === 'training' && !opts.includeTrainings) continue;

    rows.push(eventToSeasonPlanRow(raw, ourName, kind));
  }

  return { rows: sortSeasonPlanRows(rows), error: null };
}
