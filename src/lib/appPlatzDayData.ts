/**
 * APP-PLATZ.1 – Tagesdaten für mobile Platzbelegung (reuse Manager-Datenpfade).
 * Keine zweite Occupancy-Logik: Grants + Shared-RPC + event_field_assignments.
 */
import {
  defaultEventEndsAt,
  listAssignmentsInRange,
  listClubEventsInRange,
  listClubTeamSeasonIds,
  listSharedAssignmentsViaOccupancy,
  type EventFieldAssignmentRow,
} from './eventFieldAssignments';
import { canManageFacilityAssignmentForEvent, type FieldConflictCandidate } from './fieldScheduleConflicts';
import { mergeSharedOccupancyIntoSchedule } from './sharedVenueOccupancy';
import { listAllowedVenueRowsForPurpose } from './teamSeasonTrainingVenues';
import {
  listFieldZones,
  listVenueFields,
  zoneRowToGeometry,
  type VenueFieldRow,
  type VenueFieldZoneRow,
} from './venueFields';
import { resolveClubIdForTeamSeason, type VenueRow } from './venues';
import {
  computeBlockSpatialInfo,
  type BlockSpatialInfo,
} from '../manager/platz/availabilityHelpers';
import { addDays, toViennaDayKey } from '../pages/calendar/calendarUtils';
import { getDateTimePartsInTimeZone, VIENNA_TZ, zonedWallTimeToUtcMillis } from './viennaTime';
import { normalizeOefbImportedTeamName } from './oefbTeamNameNormalize';

export type AppPlatzClubEvent = Awaited<ReturnType<typeof listClubEventsInRange>>['data'][number];

export type AppPlatzDayBlock = {
  id: string;
  eventId: string;
  fieldId: string;
  venueId: string;
  zoneId: string | null;
  startsAtMs: number;
  endsAtMs: number;
  label: string;
  teamLabel: string;
  kindLabel: string;
  timeLabel: string;
  zoneLabel: string;
  venueName: string;
  fieldName: string;
  dayLabel: string;
  canEdit: boolean;
  isSharedForeign: boolean;
  spatial: BlockSpatialInfo;
};

export type AppPlatzDayPayload = {
  clubId: string | null;
  venues: VenueRow[];
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  candidates: FieldConflictCandidate[];
  blocks: AppPlatzDayBlock[];
  clubTeamSeasonIds: string[];
  error: string | null;
};

function viennaRangeIso(day: Date, hour: number, minute = 0): string {
  const parts = getDateTimePartsInTimeZone(day, VIENNA_TZ);
  if (!parts) return day.toISOString();
  const ms = zonedWallTimeToUtcMillis(
    { year: parts.year, month: parts.month, day: parts.day, hour, minute },
    VIENNA_TZ,
  );
  return new Date(ms).toISOString();
}

function formatHm(iso: string): string {
  const parts = getDateTimePartsInTimeZone(new Date(iso), VIENNA_TZ);
  if (!parts) return '';
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function eventKindLabel(kind: string): string {
  const k = (kind ?? '').trim().toLowerCase();
  if (k === 'training') return 'Training';
  if (k === 'match') return 'Spiel';
  if (k === 'tournament') return 'Turnier';
  if (k === 'event') return 'Event';
  return 'Termin';
}

function eventTitle(e: AppPlatzClubEvent): string {
  if (e.kind === 'match') {
    const opp = normalizeOefbImportedTeamName(e.opponent ?? '') || e.opponent;
    return opp ? `vs ${opp}` : 'Spiel';
  }
  if (e.kind === 'training') return 'Training';
  return e.opponent?.trim() || eventKindLabel(e.kind);
}

function formatDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat('de-AT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

export async function loadAppPlatzDay(opts: {
  teamSeasonId: string;
  dayKey: string;
  memberships: readonly { team_season_id?: string | null; role?: string | null }[];
  isPlatformAdmin?: boolean;
}): Promise<AppPlatzDayPayload> {
  const empty: AppPlatzDayPayload = {
    clubId: null,
    venues: [],
    fields: [],
    zonesByField: {},
    candidates: [],
    blocks: [],
    clubTeamSeasonIds: [],
    error: null,
  };

  const teamSeasonId = String(opts.teamSeasonId ?? '').trim();
  const dayKey = String(opts.dayKey ?? '').trim();
  if (!teamSeasonId || !dayKey) {
    return { ...empty, error: 'Keine aktive Mannschaftssaison.' };
  }

  try {
    const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
    if (clubRes.error || !clubRes.clubId) {
      return { ...empty, error: clubRes.error ?? 'Kein Verein zum Team gefunden.' };
    }
    const clubId = clubRes.clubId;
    const seasonsRes = await listClubTeamSeasonIds(clubId);
    const clubTeamSeasonIds = seasonsRes.data ?? [];

    const [trainAllow, homeAllow] = await Promise.all([
      listAllowedVenueRowsForPurpose(teamSeasonId, 'training'),
      listAllowedVenueRowsForPurpose(teamSeasonId, 'home_match'),
    ]);
    if (trainAllow.error && homeAllow.error) {
      return {
        ...empty,
        clubId,
        clubTeamSeasonIds,
        error: trainAllow.error ?? homeAllow.error,
      };
    }

    const byId = new Map<string, VenueRow>();
    for (const v of [...(trainAllow.data ?? []), ...(homeAllow.data ?? [])]) {
      if (v.is_active !== false) byId.set(v.id, v);
    }
    const venues = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));

    const fields: VenueFieldRow[] = [];
    const zonesByField: Record<string, VenueFieldZoneRow[]> = {};
    for (const v of venues) {
      const fRes = await listVenueFields(v.id, { includeInactive: false });
      for (const f of fRes.data ?? []) {
        if (f.is_active === false) continue;
        fields.push(f);
        const zRes = await listFieldZones(f.id);
        zonesByField[f.id] = zRes.data ?? [];
      }
    }

    const [y, m, d] = dayKey.split('-').map(Number);
    const dayDate = y && m && d ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
    const rangeStart = viennaRangeIso(dayDate, 0, 0);
    const rangeEnd = viennaRangeIso(addDays(dayDate, 1), 0, 0);

    const [eRes, aRes] = await Promise.all([
      listClubEventsInRange(clubId, rangeStart, rangeEnd),
      listAssignmentsInRange(clubId, rangeStart, rangeEnd),
    ]);
    let error: string | null = eRes.error ?? null;
    if (aRes.error && !/migriert/i.test(aRes.error)) error = error ?? aRes.error;

    const venueIds = venues.map((v) => v.id);
    const sharedRes = await listSharedAssignmentsViaOccupancy(
      venueIds,
      rangeStart,
      rangeEnd,
      { excludeAssignmentIds: new Set((aRes.data ?? []).map((a) => a.id)) },
    );
    if (sharedRes.error) error = error ?? sharedRes.error;

    const clubEventsAsShared = (eRes.data ?? []).map((e) => ({
      ...e,
      org_name: null as string | null,
    }));
    const merged = mergeSharedOccupancyIntoSchedule({
      events: clubEventsAsShared,
      assignments: aRes.data ?? [],
      occupancy: sharedRes.occupancy ?? [],
      clubId,
    });

    const events = merged.events;
    const assignments = merged.assignments as EventFieldAssignmentRow[];
    const sharedMeta = merged.sharedMeta;

    const eventById = new Map(events.map((e) => [e.id, e]));
    const fieldById = new Map(fields.map((f) => [f.id, f]));
    const venueById = new Map(venues.map((v) => [v.id, v]));

    const candidates: FieldConflictCandidate[] = assignments.map((a) => {
      const zone = a.zone_id
        ? (zonesByField[a.field_id] ?? []).find((z) => z.id === a.zone_id)
        : null;
      const geom = zone ? zoneRowToGeometry(zone) : null;
      const ev = eventById.get(a.event_id);
      const label = ev
        ? [ev.age_group, ev.team_name].filter(Boolean).join(' ') || 'Mannschaft'
        : 'Mannschaft';
      return {
        id: a.id,
        fieldId: a.field_id,
        zoneId: a.zone_id,
        blocksEntireField:
          !a.zone_id || Boolean(zone?.blocks_entire_field) || geom?.layoutKind === 'entire',
        startsAtMs: new Date(a.starts_at).getTime(),
        endsAtMs: new Date(a.ends_at).getTime(),
        eventId: a.event_id,
        zone: geom,
        label,
      };
    });

    const dayLabel = formatDayLabel(dayKey);
    const blocks: AppPlatzDayBlock[] = [];

    for (const a of assignments) {
      if (!venueById.has(a.venue_id) || !fieldById.has(a.field_id)) continue;
      const ev = eventById.get(a.event_id);
      if (!ev) continue;
      const startsAt = a.starts_at;
      const endsAt =
        a.ends_at ||
        defaultEventEndsAt({
          startsAtIso: ev.starts_at,
          kind: ev.kind,
          type: ev.type,
          notes: ev.notes,
        });
      if (toViennaDayKey(startsAt) !== dayKey) continue;

      const meta = sharedMeta.get(ev.id);
      const isSharedForeign = Boolean(meta && !meta.is_own);
      const canEdit = meta
        ? Boolean(meta.can_edit)
        : opts.isPlatformAdmin
          ? true
          : canManageFacilityAssignmentForEvent({
              eventTeamSeasonId: ev.team_season_id,
              memberships: (opts.memberships ?? [])
                .filter((m) => m.team_season_id)
                .map((m) => ({
                  team_season_id: String(m.team_season_id),
                  role: String(m.role ?? ''),
                })),
              clubTeamSeasonIds,
            });

      const zone = a.zone_id
        ? (zonesByField[a.field_id] ?? []).find((z) => z.id === a.zone_id)
        : null;
      const startsAtMs = new Date(startsAt).getTime();
      const endsAtMs = new Date(endsAt).getTime();
      const fieldZones = (zonesByField[a.field_id] ?? []).map((z) => {
        const geom = zoneRowToGeometry(z);
        return {
          id: z.id,
          name: z.name,
          blocksEntireField: z.blocks_entire_field || geom.layoutKind === 'entire',
          isActive: z.is_active,
          zone: geom,
          layoutKind: geom.layoutKind,
          rect: geom.rect,
        };
      });
      const kindLabel = eventKindLabel(ev.kind);
      const teamLabel =
        [ev.age_group, ev.team_name].filter(Boolean).join(' ') ||
        (isSharedForeign ? meta?.org_name || 'Andere Mannschaft' : 'Mannschaft');
      const timeLabel = `${formatHm(startsAt)}–${formatHm(endsAt)}`;
      const spatial = computeBlockSpatialInfo({
        fieldId: a.field_id,
        startsAtMs,
        endsAtMs,
        candidates,
        zones: fieldZones,
        blockLabel: kindLabel,
        teamLabel,
        timeLabel,
      });

      blocks.push({
        id: a.id,
        eventId: a.event_id,
        fieldId: a.field_id,
        venueId: a.venue_id,
        zoneId: a.zone_id,
        startsAtMs,
        endsAtMs,
        label: eventTitle(ev),
        teamLabel,
        kindLabel,
        timeLabel,
        zoneLabel: zone?.name ?? 'Gesamter Platz',
        venueName: venueById.get(a.venue_id)?.name ?? 'Sportanlage',
        fieldName: fieldById.get(a.field_id)?.name ?? 'Platz',
        dayLabel,
        canEdit,
        isSharedForeign,
        spatial,
      });
    }

    blocks.sort((a, b) => a.startsAtMs - b.startsAtMs);

    return {
      clubId,
      venues,
      fields,
      zonesByField,
      candidates,
      blocks,
      clubTeamSeasonIds,
      error,
    };
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : 'Platzbelegung konnte nicht geladen werden.',
    };
  }
}
