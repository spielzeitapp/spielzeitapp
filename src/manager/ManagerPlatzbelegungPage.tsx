import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Plus } from 'lucide-react';
import { useSession } from '../auth/useSession';
import {
  createVenue,
  formatVenueAddressLine,
  listVenuesForClub,
  resolveClubIdForTeamSeason,
  updateVenue,
  type VenueRow,
} from '../lib/venues';
import { normalizeOefbImportedTeamName } from '../lib/oefbTeamNameNormalize';
import {
  createFieldZone,
  createVenueField,
  ensureStandardFieldZones,
  listFieldZones,
  listVenueFields,
  updateFieldZone,
  updateVenueField,
  zoneRowToGeometry,
  VENUE_FIELD_TYPE_LABELS,
  type VenueFieldRow,
  type VenueFieldType,
  type VenueFieldZoneRow,
} from '../lib/venueFields';
import {
  defaultEventEndsAt,
  deleteEventFieldAssignment,
  getAssignmentForEvent,
  listAssignmentsInRange,
  listClubEventsInRange,
  listClubTeamSeasonIds,
  upsertEventFieldAssignment,
  type EventFieldAssignmentRow,
} from '../lib/eventFieldAssignments';
import {
  canManageFacilityAssignmentForEvent,
  fieldUtilizationInInterval,
  findLocalFieldConflicts,
  suggestFreeSiblingFields,
  suggestFreeZones,
  type FieldConflictCandidate,
} from '../lib/fieldScheduleConflicts';
import {
  SPLIT_DEMAND_LABELS,
  SPLIT_DEMAND_SHORT,
  filterZonesForDemand,
  inferDemandFromZone,
  type FieldSplitDemand,
} from '../lib/fieldZoneGeometry';
import { listAllowedTrainingVenueRows } from '../lib/teamSeasonTrainingVenues';
import { FacilityFieldPitch, type PitchOccupancy } from '../components/facility/FacilityFieldPitch';
import {
  addDays,
  formatWeekRangeLabel,
  startOfWeekMonday,
  toViennaDayKey,
} from '../pages/calendar/calendarUtils';
import { getDateTimePartsInTimeZone, VIENNA_TZ, zonedWallTimeToUtcMillis } from '../lib/viennaTime';

/** PLATZ.3: Serienbuchungen von Platzzuordnungen sind Folgepunkt — Events-Serie existiert separat. */

type TabId = 'calendar' | 'facilities';

type ClubEvent = Awaited<ReturnType<typeof listClubEventsInRange>>['data'][number];

type ScheduleBlock = {
  event: ClubEvent;
  assignment: EventFieldAssignmentRow | null;
  startsAt: string;
  endsAt: string;
  unassigned: boolean;
};

function viennaRangeIso(day: Date, hour: number, minute = 0): string {
  const p = getDateTimePartsInTimeZone(day, VIENNA_TZ);
  if (!p) return day.toISOString();
  const ms = zonedWallTimeToUtcMillis(
    { year: p.year, month: p.month, day: p.day, hour, minute },
    VIENNA_TZ,
  );
  return new Date(ms).toISOString();
}

function formatHm(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: VIENNA_TZ,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function eventKindLabel(kind: string): string {
  if (kind === 'match') return 'Spiel';
  if (kind === 'training') return 'Training';
  if (kind === 'tournament') return 'Turnier';
  return 'Termin';
}

function eventTitle(e: ClubEvent): string {
  if (e.kind === 'match') {
    const opp = normalizeOefbImportedTeamName(e.opponent);
    return opp ? `vs. ${opp}` : 'Spiel';
  }
  if (e.kind === 'training') return 'Training';
  if (e.kind === 'tournament') return 'Turnier';
  return 'Termin';
}

function kindColor(kind: string): string {
  if (kind === 'match') return 'bg-red-700 text-white';
  if (kind === 'training') return 'bg-emerald-700 text-white';
  if (kind === 'tournament') return 'bg-amber-600 text-white';
  return 'bg-slate-600 text-white';
}

/**
 * Manager STEP 2: Sportanlagen, Plätze und Wochen-Platzbelegung.
 */
export function ManagerPlatzbelegungPage(): React.ReactElement {
  const { selectedTeamSeasonId, selectedTeamSeason, viewTeamSeason, memberships } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const contextSeason = viewTeamSeason ?? selectedTeamSeason;
  const teamSeasonId = contextSeason?.id ?? selectedTeamSeasonId;

  const tab: TabId = searchParams.get('tab') === 'facilities' ? 'facilities' : 'calendar';
  const setTab = (next: TabId) => {
    if (next === 'facilities') setSearchParams({ tab: 'facilities' });
    else setSearchParams({});
  };
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubError, setClubError] = useState<string | null>(null);
  const [clubTeamSeasonIds, setClubTeamSeasonIds] = useState<string[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [fields, setFields] = useState<VenueFieldRow[]>([]);
  const [zonesByField, setZonesByField] = useState<Record<string, VenueFieldZoneRow[]>>({});
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [filterVenueId, setFilterVenueId] = useState<string>('');
  const [filterFieldId, setFilterFieldId] = useState<string>('');
  const [filterTeamSeasonId, setFilterTeamSeasonId] = useState<string>('');
  const [filterKind, setFilterKind] = useState<string>('');
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [assignments, setAssignments] = useState<EventFieldAssignmentRow[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState(() => toViennaDayKey(new Date()));

  const [assignEvent, setAssignEvent] = useState<ClubEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWeekMonday(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekLabel = useMemo(() => formatWeekRangeLabel(weekStart, weekEnd), [weekStart, weekEnd]);
  const todayKey = toViennaDayKey(new Date());

  const reloadMeta = useCallback(async () => {
    if (!teamSeasonId) {
      setClubId(null);
      setVenues([]);
      setFields([]);
      setLoadingMeta(false);
      return;
    }
    setLoadingMeta(true);
    setMetaError(null);
    const clubRes = await resolveClubIdForTeamSeason(teamSeasonId);
    if (clubRes.error || !clubRes.clubId) {
      setClubError(clubRes.error ?? 'Kein Verein zum Team gefunden.');
      setClubId(null);
      setLoadingMeta(false);
      return;
    }
    setClubId(clubRes.clubId);
    setClubError(null);
    const seasonsRes = await listClubTeamSeasonIds(clubRes.clubId);
    setClubTeamSeasonIds(seasonsRes.data);
    const vRes = await listVenuesForClub(clubRes.clubId, { includeInactive: true });
    if (vRes.error) setMetaError(vRes.error);
    setVenues(vRes.data);
    const activeVenues = vRes.data.filter((v) => v.is_active);
    const allFields: VenueFieldRow[] = [];
    const zoneMap: Record<string, VenueFieldZoneRow[]> = {};
    for (const v of activeVenues) {
      const fRes = await listVenueFields(v.id, { includeInactive: true });
      if (fRes.error && !metaError) setMetaError(fRes.error);
      allFields.push(...fRes.data);
      for (const f of fRes.data) {
        const zRes = await listFieldZones(f.id);
        zoneMap[f.id] = zRes.data;
      }
    }
    setFields(allFields);
    setZonesByField(zoneMap);
    setLoadingMeta(false);
  }, [teamSeasonId]);

  const reloadWeek = useCallback(async () => {
    if (!clubId) {
      setEvents([]);
      setAssignments([]);
      return;
    }
    setLoadingWeek(true);
    setWeekError(null);
    const rangeStart = viennaRangeIso(weekStart, 0, 0);
    const rangeEnd = viennaRangeIso(addDays(weekEnd, 1), 0, 0);
    const [eRes, aRes] = await Promise.all([
      listClubEventsInRange(clubId, rangeStart, rangeEnd),
      listAssignmentsInRange(clubId, rangeStart, rangeEnd),
    ]);
    if (eRes.error) setWeekError(eRes.error);
    if (aRes.error && !/migriert/i.test(aRes.error)) setWeekError(aRes.error);
    else if (aRes.error) setMetaError(aRes.error);
    setEvents(eRes.data);
    setAssignments(aRes.data);
    setLoadingWeek(false);
  }, [clubId, weekStart, weekEnd]);

  useEffect(() => {
    void reloadMeta();
  }, [reloadMeta]);

  useEffect(() => {
    void reloadWeek();
  }, [reloadWeek]);

  const assignmentByEvent = useMemo(() => {
    const m = new Map<string, EventFieldAssignmentRow>();
    for (const a of assignments) m.set(a.event_id, a);
    return m;
  }, [assignments]);

  const blocks: ScheduleBlock[] = useMemo(() => {
    return events.map((event) => {
      const assignment = assignmentByEvent.get(event.id) ?? null;
      const startsAt = assignment?.starts_at ?? event.starts_at;
      const endsAt =
        assignment?.ends_at ??
        defaultEventEndsAt({
          startsAtIso: event.starts_at,
          kind: event.kind,
          type: event.type,
          notes: event.notes,
        });
      return {
        event,
        assignment,
        startsAt,
        endsAt,
        unassigned: !assignment,
      };
    });
  }, [events, assignmentByEvent]);

  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (filterTeamSeasonId && b.event.team_season_id !== filterTeamSeasonId) return false;
      if (filterKind && b.event.kind !== filterKind) return false;
      if (filterFieldId) {
        return b.assignment?.field_id === filterFieldId;
      }
      if (filterVenueId) {
        if (b.assignment) return b.assignment.venue_id === filterVenueId;
        return true;
      }
      return true;
    });
  }, [blocks, filterVenueId, filterFieldId, filterTeamSeasonId, filterKind]);

  const teamFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      if (!map.has(e.team_season_id)) {
        const label = [e.age_group, e.team_name].filter(Boolean).join(' · ') || 'Mannschaft';
        map.set(e.team_season_id, label);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }, [events]);

  const canManageEvent = useCallback(
    (event: ClubEvent) =>
      canManageFacilityAssignmentForEvent({
        eventTeamSeasonId: event.team_season_id,
        memberships,
        clubTeamSeasonIds,
      }),
    [memberships, clubTeamSeasonIds],
  );

  const assignmentCandidates = useMemo((): FieldConflictCandidate[] => {
    const eventById = new Map(events.map((e) => [e.id, e]));
    return assignments.map((a) => {
      const zone = a.zone_id ? (zonesByField[a.field_id] ?? []).find((z) => z.id === a.zone_id) : null;
      const geom = zone ? zoneRowToGeometry(zone) : null;
      const ev = eventById.get(a.event_id);
      const label = ev
        ? [ev.age_group, ev.team_name].filter(Boolean).join(' ') || 'Mannschaft'
        : 'Mannschaft';
      return {
        id: a.id,
        fieldId: a.field_id,
        zoneId: a.zone_id,
        blocksEntireField: !a.zone_id || Boolean(zone?.blocks_entire_field) || geom?.layoutKind === 'entire',
        startsAtMs: new Date(a.starts_at).getTime(),
        endsAtMs: new Date(a.ends_at).getTime(),
        eventId: a.event_id,
        zone: geom,
        label,
      };
    });
  }, [assignments, zonesByField, events]);

  const blocksByDay = useMemo(() => {
    const m = new Map<string, ScheduleBlock[]>();
    for (const d of weekDays) m.set(toViennaDayKey(d), []);
    for (const b of filteredBlocks) {
      const key = toViennaDayKey(b.startsAt);
      const list = m.get(key);
      if (list) list.push(b);
      else m.set(key, [b]);
    }
    for (const list of m.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return m;
  }, [filteredBlocks, weekDays]);

  const fieldsForFilter = useMemo(() => {
    if (!filterVenueId) return fields.filter((f) => f.is_active);
    return fields.filter((f) => f.venue_id === filterVenueId && f.is_active);
  }, [fields, filterVenueId]);

  const activeVenues = venues.filter((v) => v.is_active);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  if (!teamSeasonId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[14px] text-amber-950">
        Bitte wähle im Header eine Mannschaftssaison.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700/80">Sport</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Platzbelegung</h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Vereinsweite Übersicht aller Mannschaften — Sportanlagen und Plätze gemeinsam nutzen.
          </p>
        </div>
        <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab('calendar')}
            className={[
              'rounded-full px-3 py-1.5 text-[12px] font-semibold',
              tab === 'calendar' ? 'bg-red-700 text-white' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            Wochenkalender
          </button>
          <button
            type="button"
            onClick={() => setTab('facilities')}
            className={[
              'rounded-full px-3 py-1.5 text-[12px] font-semibold',
              tab === 'facilities' ? 'bg-red-700 text-white' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            Sportanlagen
          </button>
        </div>
      </header>

      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] text-emerald-900">
          {toast}
        </div>
      ) : null}
      {clubError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {clubError}
        </div>
      ) : null}
      {metaError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          {metaError}
        </div>
      ) : null}

      {tab === 'calendar' ? (
        <CalendarPanel
          loading={loadingMeta || loadingWeek}
          weekError={weekError}
          weekLabel={weekLabel}
          weekDays={weekDays}
          todayKey={todayKey}
          selectedDayKey={selectedDayKey}
          onSelectDay={setSelectedDayKey}
          blocksByDay={blocksByDay}
          venues={activeVenues}
          fields={fields}
          zonesByField={zonesByField}
          filterVenueId={filterVenueId}
          filterFieldId={filterFieldId}
          filterTeamSeasonId={filterTeamSeasonId}
          filterKind={filterKind}
          teamFilterOptions={teamFilterOptions}
          fieldsForFilter={fieldsForFilter}
          onFilterVenue={(id) => {
            setFilterVenueId(id);
            setFilterFieldId('');
          }}
          onFilterField={setFilterFieldId}
          onFilterTeam={setFilterTeamSeasonId}
          onFilterKind={setFilterKind}
          onPrev={() => setWeekAnchor((d) => addDays(d, -7))}
          onNext={() => setWeekAnchor((d) => addDays(d, 7))}
          onToday={() => {
            const now = new Date();
            setWeekAnchor(now);
            setSelectedDayKey(toViennaDayKey(now));
          }}
          onOpenAssign={setAssignEvent}
          canManageEvent={canManageEvent}
          assignmentCandidates={assignmentCandidates}
          hasVenues={activeVenues.length > 0}
          hasFields={fields.some((f) => f.is_active)}
          onGoFacilities={() => setTab('facilities')}
        />
      ) : (
        <FacilitiesPanel
          clubId={clubId}
          venues={venues}
          fields={fields}
          zonesByField={zonesByField}
          loading={loadingMeta}
          onReload={async () => {
            await reloadMeta();
            await reloadWeek();
          }}
          onToast={showToast}
        />
      )}

      {assignEvent && clubId ? (
        <AssignModal
          clubId={clubId}
          event={assignEvent}
          venues={activeVenues}
          fields={fields.filter((f) => f.is_active)}
          zonesByField={zonesByField}
          assignmentCandidates={assignmentCandidates}
          canManage={canManageEvent(assignEvent)}
          onClose={() => setAssignEvent(null)}
          onSaved={async () => {
            setAssignEvent(null);
            showToast('Platzzuordnung gespeichert.');
            await reloadWeek();
          }}
          onRemoved={async () => {
            setAssignEvent(null);
            showToast('Platzzuordnung entfernt. Der Termin bleibt bestehen.');
            await reloadWeek();
          }}
        />
      ) : null}
    </div>
  );
}

function CalendarPanel(props: {
  loading: boolean;
  weekError: string | null;
  weekLabel: string;
  weekDays: Date[];
  todayKey: string;
  selectedDayKey: string;
  onSelectDay: (key: string) => void;
  blocksByDay: Map<string, ScheduleBlock[]>;
  venues: VenueRow[];
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  filterVenueId: string;
  filterFieldId: string;
  filterTeamSeasonId: string;
  filterKind: string;
  teamFilterOptions: [string, string][];
  fieldsForFilter: VenueFieldRow[];
  onFilterVenue: (id: string) => void;
  onFilterField: (id: string) => void;
  onFilterTeam: (id: string) => void;
  onFilterKind: (kind: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenAssign: (e: ClubEvent) => void;
  canManageEvent: (e: ClubEvent) => boolean;
  assignmentCandidates: FieldConflictCandidate[];
  hasVenues: boolean;
  hasFields: boolean;
  onGoFacilities: () => void;
}): React.ReactElement {
  const selectedBlocks = props.blocksByDay.get(props.selectedDayKey) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={props.onPrev}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
          aria-label="Vorherige Woche"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={props.onToday}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Heute
        </button>
        <button
          type="button"
          onClick={props.onNext}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
          aria-label="Nächste Woche"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 text-[14px] font-semibold text-slate-800">{props.weekLabel}</p>
        <select
          value={props.filterVenueId}
          onChange={(e) => props.onFilterVenue(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-2 text-[12px]"
          aria-label="Sportanlage filtern"
        >
          <option value="">Alle Sportanlagen</option>
          {props.venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={props.filterFieldId}
          onChange={(e) => props.onFilterField(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-2 text-[12px]"
          aria-label="Platz filtern"
        >
          <option value="">Alle Plätze</option>
          {props.fieldsForFilter.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          value={props.filterTeamSeasonId}
          onChange={(e) => props.onFilterTeam(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-2 text-[12px]"
          aria-label="Mannschaft filtern"
        >
          <option value="">Alle Mannschaften</option>
          {props.teamFilterOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={props.filterKind}
          onChange={(e) => props.onFilterKind(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-2 text-[12px]"
          aria-label="Terminart filtern"
        >
          <option value="">Alle Terminarten</option>
          <option value="training">Training</option>
          <option value="match">Spiel</option>
          <option value="tournament">Turnier</option>
          <option value="event">Sonstiges</option>
        </select>
      </div>

      {!props.hasVenues ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-[14px] text-slate-600">
          Noch keine Sportanlage angelegt.{' '}
          <button type="button" onClick={props.onGoFacilities} className="font-semibold text-red-700">
            Sportanlage anlegen
          </button>
        </div>
      ) : !props.hasFields ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-[14px] text-slate-600">
          Noch keine Plätze angelegt.{' '}
          <button type="button" onClick={props.onGoFacilities} className="font-semibold text-red-700">
            Platz anlegen
          </button>
        </div>
      ) : null}

      {props.weekError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {props.weekError}
        </div>
      ) : null}
      {props.loading ? <p className="text-[13px] text-slate-400">Kalender wird geladen…</p> : null}

      {/* Desktop week grid */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <div className="grid min-w-[880px] grid-cols-7 border-b border-slate-100">
          {props.weekDays.map((d) => {
            const key = toViennaDayKey(d);
            const isToday = key === props.todayKey;
            const dp = getDateTimePartsInTimeZone(d, VIENNA_TZ);
            return (
              <div
                key={key}
                className={[
                  'border-l border-slate-100 px-2 py-2 text-center first:border-l-0',
                  isToday ? 'bg-red-50' : '',
                ].join(' ')}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, weekday: 'short' }).format(d)}
                </p>
                <p className="text-[15px] font-semibold text-slate-900">{dp?.day ?? d.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="grid min-w-[880px] grid-cols-7">
          {props.weekDays.map((d) => {
            const key = toViennaDayKey(d);
            const dayBlocks = props.blocksByDay.get(key) ?? [];
            return (
              <div key={key} className="min-h-[280px] border-l border-slate-100 p-2 first:border-l-0">
                {dayBlocks.length === 0 ? (
                  <p className="px-1 py-2 text-[11px] text-slate-300">Keine Termine</p>
                ) : (
                  <ul className="space-y-1.5">
                    {dayBlocks.map((b) => {
                      const manageable = props.canManageEvent(b.event);
                      const util = utilizationLabel(b, props.zonesByField, props.assignmentCandidates);
                      return (
                      <li key={b.event.id}>
                        <button
                          type="button"
                          onClick={() => props.onOpenAssign(b.event)}
                          className={[
                            'w-full rounded-lg px-2 py-1.5 text-left text-[11px] leading-snug shadow-sm',
                            b.unassigned
                              ? 'border border-dashed border-amber-300 bg-amber-50 text-amber-950'
                              : kindColor(b.event.kind),
                          ].join(' ')}
                        >
                          <p className="font-semibold">
                            {formatHm(b.startsAt)}–{formatHm(b.endsAt)}
                          </p>
                          <p className="opacity-95">
                            {eventKindLabel(b.event.kind)} · {eventTitle(b.event)}
                          </p>
                          <p className="opacity-80">
                            {[b.event.age_group, b.event.team_name].filter(Boolean).join(' · ') || 'Mannschaft'}
                          </p>
                          <p className="mt-0.5 opacity-80">
                            {b.unassigned
                              ? 'Platz noch nicht zugeordnet'
                              : fieldLabel(b.assignment, props.fields, props.zonesByField, props.venues)}
                          </p>
                          {util ? <p className="mt-0.5 text-[10px] font-semibold opacity-90">{util}</p> : null}
                          {!manageable ? (
                            <p className="mt-0.5 text-[10px] opacity-75">Nur Ansehen</p>
                          ) : null}
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact day list (tablet/mobile) */}
      <div className="space-y-3 lg:hidden">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {props.weekDays.map((d) => {
            const key = toViennaDayKey(d);
            const active = key === props.selectedDayKey;
            const dp = getDateTimePartsInTimeZone(d, VIENNA_TZ);
            return (
              <button
                key={key}
                type="button"
                onClick={() => props.onSelectDay(key)}
                className={[
                  'min-w-[3rem] rounded-xl px-2 py-2 text-center text-[11px] font-semibold',
                  active ? 'bg-red-700 text-white' : 'border border-slate-200 bg-white text-slate-700',
                ].join(' ')}
              >
                <div>
                  {new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, weekday: 'short' }).format(d)}
                </div>
                <div className="text-[14px]">{dp?.day}</div>
              </button>
            );
          })}
        </div>
        {selectedBlocks.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-[13px] text-slate-400">
            Keine Termine an diesem Tag.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedBlocks.map((b) => {
              const manageable = props.canManageEvent(b.event);
              const util = utilizationLabel(b, props.zonesByField, props.assignmentCandidates);
              return (
              <li key={b.event.id}>
                <button
                  type="button"
                  onClick={() => props.onOpenAssign(b.event)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm"
                >
                  <p className="text-[13px] font-semibold text-slate-900">
                    {formatHm(b.startsAt)}–{formatHm(b.endsAt)} · {eventKindLabel(b.event.kind)}
                  </p>
                  <p className="text-[13px] text-slate-600">{eventTitle(b.event)}</p>
                  <p className="text-[12px] text-slate-500">
                    {[b.event.age_group, b.event.team_name].filter(Boolean).join(' · ') || 'Mannschaft'}
                  </p>
                  <p className="text-[12px] text-slate-500">
                    {b.unassigned
                      ? 'Platz noch nicht zugeordnet'
                      : fieldLabel(b.assignment, props.fields, props.zonesByField, props.venues)}
                  </p>
                  {util ? <p className="text-[11px] font-semibold text-slate-600">{util}</p> : null}
                  {!manageable ? (
                    <p className="text-[11px] text-slate-400">Nur Ansehen — Bearbeitung durch die zuständige Mannschaft</p>
                  ) : null}
                </button>
              </li>
              );
            })}
          </ul>
        )}
        {props.filterFieldId ? (
          <FieldDayPitchPanel
            fieldId={props.filterFieldId}
            dayBlocks={selectedBlocks}
            fields={props.fields}
            venues={props.venues}
            zonesByField={props.zonesByField}
            canManageEvent={props.canManageEvent}
          />
        ) : props.filterVenueId ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[13px] font-semibold text-slate-800">Plätze dieser Sportanlage</p>
            <ul className="mt-2 space-y-2">
              {props.fieldsForFilter.map((f) => {
                const count = selectedBlocks.filter((b) => b.assignment?.field_id === f.id).length;
                return (
                  <li key={f.id} className="flex items-center justify-between text-[12px] text-slate-600">
                    <span className="font-medium text-slate-800">{f.name}</span>
                    <span>{count === 0 ? 'frei / keine Buchung' : `${count} Belegung${count === 1 ? '' : 'en'}`}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldDayPitchPanel(props: {
  fieldId: string;
  dayBlocks: ScheduleBlock[];
  fields: VenueFieldRow[];
  venues: VenueRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  canManageEvent: (e: ClubEvent) => boolean;
}): React.ReactElement | null {
  const field = props.fields.find((f) => f.id === props.fieldId);
  if (!field) return null;
  const venue = props.venues.find((v) => v.id === field.venue_id);
  const zones = props.zonesByField[field.id] ?? [];
  const geoms = zones.map(zoneRowToGeometry);
  const assigned = props.dayBlocks.filter((b) => b.assignment?.field_id === field.id && !b.unassigned);
  const occ: PitchOccupancy[] = assigned.map((b) => {
    const z = b.assignment?.zone_id ? zones.find((x) => x.id === b.assignment!.zone_id) : null;
    const geom = z ? zoneRowToGeometry(z) : null;
    return {
      zoneId: b.assignment?.zone_id ?? null,
      zone: geom,
      teamLabel: [b.event.age_group, b.event.team_name].filter(Boolean).join(' ') || 'Mannschaft',
      timeLabel: `${formatHm(b.startsAt)}–${formatHm(b.endsAt)}`,
      kindLabel: eventKindLabel(b.event.kind),
      demandLabel: zoneDemandLabel(z),
      own: props.canManageEvent(b.event),
      readOnly: !props.canManageEvent(b.event),
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[13px] font-semibold text-slate-800">
        {venue?.name ?? 'Sportanlage'} · {field.name}
      </p>
      <p className="text-[12px] text-slate-500">Grafischer Belegungsplan für den gewählten Tag</p>
      <div className="mt-3 max-w-xs">
        <FacilityFieldPitch zones={geoms} demand="half" occupancies={occ} compact />
      </div>
    </div>
  );
}

function utilizationLabel(
  block: ScheduleBlock,
  zonesByField: Record<string, VenueFieldZoneRow[]>,
  candidates: FieldConflictCandidate[],
): string | null {
  if (!block.assignment) return null;
  const zones = (zonesByField[block.assignment.field_id] ?? []).map((z) => {
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
  const util = fieldUtilizationInInterval({
    fieldId: block.assignment.field_id,
    startsAtMs: new Date(block.startsAt).getTime(),
    endsAtMs: new Date(block.endsAt).getTime(),
    zones,
    existing: candidates,
  });
  if (util === 'full') return 'Platz vollständig ausgelastet';
  if (util === 'partial') return 'Teilfläche belegt';
  return null;
}

function zoneDemandLabel(zone: VenueFieldZoneRow | null | undefined): string {
  if (!zone) return SPLIT_DEMAND_SHORT.entire;
  const geom = zoneRowToGeometry(zone);
  const demand = inferDemandFromZone(geom);
  return SPLIT_DEMAND_SHORT[demand];
}

function fieldLabel(
  assignment: EventFieldAssignmentRow | null,
  fields: VenueFieldRow[],
  zonesByField: Record<string, VenueFieldZoneRow[]>,
  venues: VenueRow[],
): string {
  if (!assignment) return '—';
  const venue = venues.find((v) => v.id === assignment.venue_id);
  const field = fields.find((f) => f.id === assignment.field_id);
  const zone = assignment.zone_id
    ? (zonesByField[assignment.field_id] ?? []).find((z) => z.id === assignment.zone_id)
    : null;
  return [venue?.name, field?.name, zone?.name ?? 'Gesamter Platz', zone ? zoneDemandLabel(zone) : null]
    .filter(Boolean)
    .join(' · ');
}

function FacilitiesPanel(props: {
  clubId: string | null;
  venues: VenueRow[];
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  loading: boolean;
  onReload: () => Promise<void>;
  onToast: (msg: string) => void;
}): React.ReactElement {
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);

  const createFacility = async () => {
    if (!props.clubId) return;
    setSaving(true);
    setError(null);
    const res = await createVenue({
      clubId: props.clubId,
      name: venueName,
      address: venueAddress,
      city: venueCity,
      isHome: true,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setVenueName('');
    setVenueAddress('');
    setVenueCity('');
    props.onToast('Sportanlage angelegt.');
    await props.onReload();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-slate-800">
          <Plus className="h-4 w-4 text-red-700" /> Neue Sportanlage
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="Name"
            className="rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
          />
          <input
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
            placeholder="Adresse"
            className="rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
          />
          <input
            value={venueCity}
            onChange={(e) => setVenueCity(e.target.value)}
            placeholder="Ort"
            className="rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
          />
        </div>
        {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={saving || !venueName.trim() || !props.clubId}
          onClick={() => void createFacility()}
          className="mt-3 inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          Anlegen
        </button>
      </section>

      {props.loading ? <p className="text-[13px] text-slate-400">Lade Sportanlagen…</p> : null}
      {props.venues.length === 0 && !props.loading ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-[14px] text-slate-500">
          Noch keine Sportanlage angelegt.
        </p>
      ) : null}

      <ul className="space-y-3">
        {props.venues.map((v) => {
          const venueFields = props.fields.filter((f) => f.venue_id === v.id);
          const open = expandedVenueId === v.id;
          return (
            <li key={v.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedVenueId(open ? null : v.id)}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {v.name}
                    {!v.is_active ? (
                      <span className="ml-2 text-[11px] font-medium text-slate-400">(inaktiv)</span>
                    ) : null}
                  </p>
                  <p className="text-[12px] text-slate-500">
                    {formatVenueAddressLine(v) || 'Keine Adresse'} · {venueFields.length} Platz
                    {venueFields.length === 1 ? '' : 'e'}
                  </p>
                </div>
                <MapPin className="mt-1 h-4 w-4 text-slate-400" />
              </button>
              {open && props.clubId ? (
                <VenueDetail
                  clubId={props.clubId}
                  venue={v}
                  fields={venueFields}
                  zonesByField={props.zonesByField}
                  onReload={props.onReload}
                  onToast={props.onToast}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function VenueDetail(props: {
  clubId: string;
  venue: VenueRow;
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  onReload: () => Promise<void>;
  onToast: (msg: string) => void;
}): React.ReactElement {
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<VenueFieldType>('main');
  const [busy, setBusy] = useState(false);

  const addField = async () => {
    setBusy(true);
    const res = await createVenueField({
      venueId: props.venue.id,
      clubId: props.clubId,
      name: fieldName,
      fieldType,
    });
    setBusy(false);
    if (res.error) {
      props.onToast(res.error);
      return;
    }
    setFieldName('');
    props.onToast('Platz angelegt.');
    await props.onReload();
  };

  return (
    <div className="space-y-3 border-t border-slate-100 px-4 py-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700"
          onClick={async () => {
            await updateVenue(props.venue.id, { isActive: !props.venue.is_active });
            props.onToast(props.venue.is_active ? 'Sportanlage deaktiviert.' : 'Sportanlage aktiviert.');
            await props.onReload();
          }}
        >
          {props.venue.is_active ? 'Deaktivieren' : 'Aktivieren'}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
        <input
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
          placeholder="Neuer Platz (z. B. Hauptfeld)"
          className="rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
        />
        <select
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value as VenueFieldType)}
          className="rounded-lg border border-slate-200 px-2 py-2 text-[12px]"
        >
          {(Object.keys(VENUE_FIELD_TYPE_LABELS) as VenueFieldType[]).map((k) => (
            <option key={k} value={k}>
              {VENUE_FIELD_TYPE_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !fieldName.trim()}
          onClick={() => void addField()}
          className="rounded-full bg-red-700 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
        >
          Platz +
        </button>
      </div>

      <ul className="space-y-2">
        {props.fields.map((f) => (
          <FieldRow
            key={f.id}
            clubId={props.clubId}
            field={f}
            zones={props.zonesByField[f.id] ?? []}
            onReload={props.onReload}
            onToast={props.onToast}
          />
        ))}
      </ul>
    </div>
  );
}

function FieldRow(props: {
  clubId: string;
  field: VenueFieldRow;
  zones: VenueFieldZoneRow[];
  onReload: () => Promise<void>;
  onToast: (msg: string) => void;
}): React.ReactElement {
  const [zoneName, setZoneName] = useState('');
  const [seeding, setSeeding] = useState(false);
  const geoms = props.zones.map(zoneRowToGeometry);
  const previewDemand: FieldSplitDemand =
    geoms.some((z) => z.layoutKind === 'half')
      ? 'half'
      : geoms.some((z) => z.layoutKind === 'third')
        ? 'third'
        : geoms.some((z) => z.layoutKind === 'quarter')
          ? 'quarter'
          : 'entire';

  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-slate-800">
          {props.field.name}
          <span className="ml-2 text-[11px] font-medium text-slate-400">
            {VENUE_FIELD_TYPE_LABELS[props.field.field_type]}
          </span>
          {!props.field.is_active ? (
            <span className="ml-2 text-[11px] text-slate-400">archiviert</span>
          ) : null}
        </p>
        <button
          type="button"
          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
          onClick={async () => {
            await updateVenueField(props.field.id, { isActive: !props.field.is_active });
            await props.onReload();
          }}
        >
          {props.field.is_active ? 'Archivieren' : 'Reaktivieren'}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Aufteilungen:{' '}
        {(props.field.supported_splits ?? ['entire', 'half', 'third', 'quarter'])
          .map((s) => SPLIT_DEMAND_LABELS[s])
          .join(' · ')}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Zonen: {props.zones.length === 0 ? 'noch keine Standardzonen' : props.zones.map((z) => z.name).join(', ')}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={seeding}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-800 disabled:opacity-40"
          onClick={async () => {
            setSeeding(true);
            const res = await ensureStandardFieldZones(props.field.id);
            setSeeding(false);
            if (res.error) props.onToast(res.error);
            else {
              props.onToast('Standardzonen (Ganz/½/⅓/¼) angelegt bzw. aktualisiert.');
              await props.onReload();
            }
          }}
        >
          Standardzonen erzeugen
        </button>
        <input
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
          placeholder="Eigene Teilfläche (Name)"
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]"
        />
        <button
          type="button"
          disabled={!zoneName.trim()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40"
          onClick={async () => {
            const res = await createFieldZone({
              fieldId: props.field.id,
              clubId: props.clubId,
              name: zoneName,
            });
            if (res.error) props.onToast(res.error);
            else {
              setZoneName('');
              props.onToast('Teilfläche angelegt.');
              await props.onReload();
            }
          }}
        >
          Teilfläche +
        </button>
      </div>
      {geoms.length > 0 ? (
        <div className="mt-3 max-w-xs">
          <p className="mb-1 text-[11px] font-semibold text-slate-600">Vorschau Aufteilung ({SPLIT_DEMAND_LABELS[previewDemand]})</p>
          <FacilityFieldPitch zones={geoms} demand={previewDemand} compact />
        </div>
      ) : null}
      {props.zones.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {props.zones.map((z) => (
            <li key={z.id} className="flex items-center justify-between text-[11px] text-slate-600">
              <span>
                {z.name}
                {z.blocks_entire_field ? ' · blockiert alle Teilflächen' : ''}
                {z.layout_kind && z.layout_kind !== 'named' ? ` · ${z.layout_kind}` : ''}
              </span>
              <button
                type="button"
                className="font-semibold text-slate-400 hover:text-slate-700"
                onClick={async () => {
                  await updateFieldZone(z.id, { isActive: false });
                  await props.onReload();
                }}
              >
                Deaktivieren
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function AssignModal(props: {
  clubId: string;
  event: ClubEvent;
  venues: VenueRow[];
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  assignmentCandidates: FieldConflictCandidate[];
  canManage: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onRemoved: () => Promise<void>;
}): React.ReactElement {
  const [existing, setExisting] = useState<EventFieldAssignmentRow | null>(null);
  const [venueId, setVenueId] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [demand, setDemand] = useState<FieldSplitDemand>('entire');
  const [zoneId, setZoneId] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainingVenues, setTrainingVenues] = useState<VenueRow[] | null>(null);
  const [trainingVenueHint, setTrainingVenueHint] = useState<string | null>(null);

  const isTrainingEvent =
    String(props.event.kind ?? '').toLowerCase() === 'training' ||
    String(props.event.type ?? '').toLowerCase() === 'training';

  useEffect(() => {
    let cancelled = false;
    if (!isTrainingEvent) {
      setTrainingVenues(null);
      setTrainingVenueHint(null);
      return;
    }
    void (async () => {
      const res = await listAllowedTrainingVenueRows(props.event.team_season_id);
      if (cancelled) return;
      setTrainingVenues(res.data);
      if (res.emptyReason === 'none_assigned') {
        setTrainingVenueHint(
          'Für diese Mannschaft ist noch keine Trainingsanlage freigegeben. Bitte den Jugendleiter oder Vereinsadmin kontaktieren.',
        );
      } else if (res.emptyReason === 'migration') {
        setTrainingVenueHint('Trainingsanlagen-Zuordnung noch nicht verfügbar.');
      } else {
        setTrainingVenueHint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTrainingEvent, props.event.team_season_id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getAssignmentForEvent(props.event.id);
      if (cancelled) return;
      const a = res.data;
      setExisting(a);
      const starts = a?.starts_at ?? props.event.starts_at;
      const ends =
        a?.ends_at ??
        defaultEventEndsAt({
          startsAtIso: props.event.starts_at,
          kind: props.event.kind,
          type: props.event.type,
          notes: props.event.notes,
        });
      const vId = a?.venue_id ?? props.event.venue_id ?? props.venues[0]?.id ?? '';
      const fId = a?.field_id ?? '';
      setVenueId(vId);
      setFieldId(fId);
      const zoneRow = a?.zone_id
        ? (props.zonesByField[fId] ?? []).find((z) => z.id === a.zone_id)
        : null;
      const geom = zoneRow ? zoneRowToGeometry(zoneRow) : null;
      setDemand(inferDemandFromZone(geom));
      setZoneId(a?.zone_id ?? '');
      setStartLocal(toDatetimeLocalValue(starts));
      setEndLocal(toDatetimeLocalValue(ends));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.event, props.venues, props.zonesByField]);

  const pickerVenues = trainingVenues ?? props.venues;
  const fieldsForVenue = props.fields.filter((f) => f.venue_id === venueId && f.is_active !== false);
  const zoneRows = fieldId ? props.zonesByField[fieldId] ?? [] : [];
  const zoneGeoms = zoneRows.map(zoneRowToGeometry);
  const fieldRow = props.fields.find((f) => f.id === fieldId);
  const supported = fieldRow?.supported_splits ?? (['entire', 'half', 'third', 'quarter'] as FieldSplitDemand[]);
  const demandZones = filterZonesForDemand(zoneGeoms, demand);

  useEffect(() => {
    if (!fieldId && fieldsForVenue[0]) setFieldId(fieldsForVenue[0].id);
  }, [venueId, fieldsForVenue, fieldId]);

  useEffect(() => {
    if (demand === 'entire') {
      const entire = zoneGeoms.find((z) => z.layoutKind === 'entire' || z.blocksEntireField);
      if (entire?.id && zoneId !== entire.id) setZoneId(entire.id);
      return;
    }
    if (zoneId && !demandZones.some((z) => z.id === zoneId)) {
      setZoneId('');
    }
  }, [demand, fieldId, zoneGeoms, demandZones, zoneId]);

  const startsAtIso = fromDatetimeLocalValue(startLocal);
  const endsAtIso = fromDatetimeLocalValue(endLocal);

  const liveConflicts = useMemo(() => {
    if (!fieldId || !startsAtIso || !endsAtIso) return [];
    const selected = zoneId ? zoneGeoms.find((z) => z.id === zoneId) : null;
    const blocksEntire = demand === 'entire' || !selected || selected.blocksEntireField;
    return findLocalFieldConflicts(
      {
        id: existing?.id ?? 'new',
        fieldId,
        zoneId: zoneId || null,
        blocksEntireField: blocksEntire,
        startsAtMs: new Date(startsAtIso).getTime(),
        endsAtMs: new Date(endsAtIso).getTime(),
        zone: selected ?? (blocksEntire
          ? {
              name: 'Ganzer Platz',
              layoutKind: 'entire',
              blocksEntireField: true,
              rect: { x: 0, y: 0, w: 1, h: 1 },
            }
          : null),
      },
      props.assignmentCandidates,
    );
  }, [fieldId, zoneId, demand, startsAtIso, endsAtIso, existing, zoneGeoms, props.assignmentCandidates]);

  const pitchOccupancies: PitchOccupancy[] = useMemo(() => {
    if (!fieldId || !startsAtIso || !endsAtIso) return [];
    const startMs = new Date(startsAtIso).getTime();
    const endMs = new Date(endsAtIso).getTime();
    return props.assignmentCandidates
      .filter(
        (c) =>
          c.fieldId === fieldId &&
          (!existing || c.id !== existing.id) &&
          c.startsAtMs < endMs &&
          c.endsAtMs > startMs,
      )
      .map((c) => {
        const zRow = c.zoneId ? zoneRows.find((z) => z.id === c.zoneId) : null;
        const geom = c.zone ?? (zRow ? zoneRowToGeometry(zRow) : null);
        const conflict = liveConflicts.some((x) => x.id === c.id);
        return {
          zoneId: c.zoneId,
          zone: geom,
          teamLabel: c.label ?? 'Mannschaft',
          timeLabel: `${formatHm(new Date(c.startsAtMs).toISOString())}–${formatHm(new Date(c.endsAtMs).toISOString())}`,
          demandLabel: geom ? SPLIT_DEMAND_SHORT[inferDemandFromZone(geom)] : 'Ganz',
          own: false,
          readOnly: true,
          conflict,
        };
      });
  }, [fieldId, startsAtIso, endsAtIso, props.assignmentCandidates, zoneRows, existing, liveConflicts]);

  const buildHint = (fieldIdArg: string, startsAt: string, endsAt: string, excludeId: string | null) => {
    const zones = (props.zonesByField[fieldIdArg] ?? []).map((z) => {
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
    const suggestion = suggestFreeZones({
      fieldId: fieldIdArg,
      startsAtMs: new Date(startsAt).getTime(),
      endsAtMs: new Date(endsAt).getTime(),
      zones,
      existing: props.assignmentCandidates,
      excludeAssignmentId: excludeId,
    });
    const siblings = suggestFreeSiblingFields({
      venueId,
      fieldId: fieldIdArg,
      startsAtMs: new Date(startsAt).getTime(),
      endsAtMs: new Date(endsAt).getTime(),
      fields: props.fields,
      existing: props.assignmentCandidates,
      excludeAssignmentId: excludeId,
    });
    const freeNames = [
      ...(suggestion.entireFieldFree ? ['Ganzer Platz'] : []),
      ...suggestion.freeZones.map((z) => z.name),
      ...siblings.map((s) => s.name),
    ];
    return freeNames.length
      ? `Noch frei: ${freeNames.join(' · ')}`
      : 'In diesem Zeitraum ist der Platz vollständig ausgelastet.';
  };

  const save = async () => {
    if (!props.canManage) {
      setError('Diese Belegung gehört einer anderen Mannschaft und kann nicht geändert werden.');
      return;
    }
    setSaving(true);
    setError(null);
    setHint(null);
    const startsAt = fromDatetimeLocalValue(startLocal);
    const endsAt = fromDatetimeLocalValue(endLocal);
    if (!startsAt || !endsAt) {
      setError('Ungültige Zeitangabe.');
      setSaving(false);
      return;
    }
    if (!venueId || !fieldId) {
      setError('Sportanlage und konkreter Platz sind Pflicht.');
      setSaving(false);
      return;
    }
    if (demand !== 'entire' && !zoneId) {
      setError('Bitte einen konkreten Bereich auf dem Spielfeld wählen.');
      setSaving(false);
      return;
    }

    let resolvedZoneId: string | null = zoneId || null;
    if (demand === 'entire') {
      const entire = zoneGeoms.find((z) => z.layoutKind === 'entire' || z.blocksEntireField);
      resolvedZoneId = entire?.id ?? null;
    }

    if (liveConflicts.length > 0) {
      const reason = liveConflicts
        .map((c) => c.label ?? 'bestehende Belegung')
        .slice(0, 2)
        .join('; ');
      setError(
        `Konflikt: ${reason || 'Fläche bereits belegt'}. Bitte anderen Bereich oder Platz wählen.`,
      );
      setHint(buildHint(fieldId, startsAt, endsAt, existing?.id ?? null));
      setSaving(false);
      return;
    }

    const res = await upsertEventFieldAssignment({
      clubId: props.clubId,
      eventId: props.event.id,
      venueId,
      fieldId,
      zoneId: resolvedZoneId,
      startsAt,
      endsAt,
      existingId: existing?.id ?? null,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      if (res.conflicts?.length) {
        setHint(buildHint(fieldId, startsAt, endsAt, existing?.id ?? null));
      }
      return;
    }
    await props.onSaved();
  };

  const remove = async () => {
    if (!props.canManage) {
      setError('Diese Belegung gehört einer anderen Mannschaft und kann nicht geändert werden.');
      return;
    }
    if (!existing) return;
    if (!window.confirm('Platzzuordnung entfernen? Der Termin bleibt erhalten.')) return;
    setSaving(true);
    const res = await deleteEventFieldAssignment(existing.id);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    await props.onRemoved();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-3 pb-4 pt-10 sm:items-center" role="presentation" onClick={props.onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="assign-title" className="text-[16px] font-semibold text-slate-900">
          {props.canManage ? 'Platz zuordnen' : 'Platzbelegung ansehen'}
        </h2>
        <p className="mt-1 text-[13px] text-slate-500">
          {eventKindLabel(props.event.kind)} · {eventTitle(props.event)} ·{' '}
          {[props.event.age_group, props.event.team_name].filter(Boolean).join(' · ')}
        </p>
        {!props.canManage ? (
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            Nur ansehen — Änderungen nur durch Staff dieser Mannschaft oder Vereinsadmin.
          </p>
        ) : null}
        {loading ? (
          <p className="mt-4 text-[13px] text-slate-400">Laden…</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-[12px] font-medium text-slate-600">
              1. Sportanlage
              <select
                value={venueId}
                disabled={!props.canManage}
                onChange={(e) => {
                  setVenueId(e.target.value);
                  setFieldId('');
                  setZoneId('');
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] disabled:bg-slate-50"
              >
                {pickerVenues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            {trainingVenueHint ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                {trainingVenueHint}
              </p>
            ) : null}
            <label className="block text-[12px] font-medium text-slate-600">
              2. Konkreter Platz
              <select
                value={fieldId}
                disabled={!props.canManage}
                onChange={(e) => {
                  setFieldId(e.target.value);
                  setZoneId('');
                  setDemand('entire');
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] disabled:bg-slate-50"
              >
                <option value="">Bitte wählen</option>
                {fieldsForVenue.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset disabled={!props.canManage || !fieldId}>
              <legend className="text-[12px] font-medium text-slate-600">3. Platzbedarf</legend>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['entire', 'half', 'third', 'quarter'] as FieldSplitDemand[])
                  .filter((d) => supported.includes(d))
                  .map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDemand(d);
                        setZoneId('');
                      }}
                      className={[
                        'rounded-lg border px-2 py-2 text-[12px] font-semibold',
                        demand === d
                          ? 'border-red-700 bg-red-700 text-white'
                          : 'border-slate-200 bg-white text-slate-700',
                      ].join(' ')}
                    >
                      {SPLIT_DEMAND_LABELS[d]}
                    </button>
                  ))}
              </div>
            </fieldset>
            {fieldId ? (
              <div>
                <p className="text-[12px] font-medium text-slate-600">4. Bereich auf dem Spielfeld</p>
                <FacilityFieldPitch
                  zones={zoneGeoms}
                  demand={demand}
                  selectedZoneId={zoneId || null}
                  onSelectZone={(id) => {
                    if (!props.canManage) return;
                    setZoneId(id ?? '');
                  }}
                  occupancies={pitchOccupancies}
                  disabled={!props.canManage}
                />
                <label className="mt-2 block text-[12px] font-medium text-slate-600">
                  Bereich (Auswahlfeld)
                  <select
                    value={zoneId}
                    disabled={!props.canManage}
                    onChange={(e) => setZoneId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] disabled:bg-slate-50"
                  >
                    <option value="">{demand === 'entire' ? 'Ganzer Platz' : 'Bitte Bereich wählen'}</option>
                    {demandZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-[12px] font-medium text-slate-600">
                5. Beginn
                <input
                  type="datetime-local"
                  value={startLocal}
                  disabled={!props.canManage}
                  onChange={(e) => setStartLocal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] disabled:bg-slate-50"
                />
              </label>
              <label className="block text-[12px] font-medium text-slate-600">
                Ende
                <input
                  type="datetime-local"
                  value={endLocal}
                  disabled={!props.canManage}
                  onChange={(e) => setEndLocal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] disabled:bg-slate-50"
                />
              </label>
            </div>
            {liveConflicts.length > 0 ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                Konflikt in Echtzeit: Fläche überschneidet sich mit bestehender Belegung.
              </p>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                {error}
              </p>
            ) : null}
            {hint ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
                {hint}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              {props.canManage ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Speichern
                </button>
              ) : null}
              <button
                type="button"
                onClick={props.onClose}
                className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full border border-slate-200 px-4 text-[12px] font-semibold text-slate-700"
              >
                {props.canManage ? 'Abbrechen' : 'Schließen'}
              </button>
            </div>
            {existing && props.canManage ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove()}
                className="w-full text-center text-[12px] font-semibold text-red-700 hover:underline"
              >
                Platzzuordnung entfernen
              </button>
            ) : null}
            <p className="text-[11px] text-slate-400">
              Öffentlicher Spielort und interne Platzreservierung bleiben fachlich getrennt. Der Termin wird nicht
              dupliziert.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function toDatetimeLocalValue(iso: string): string {
  const p = getDateTimePartsInTimeZone(new Date(iso), VIENNA_TZ);
  if (!p) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function fromDatetimeLocalValue(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const ms = zonedWallTimeToUtcMillis(
    {
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: Number(m[4]),
      minute: Number(m[5]),
    },
    VIENNA_TZ,
  );
  return new Date(ms).toISOString();
}
