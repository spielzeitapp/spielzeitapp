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
  listFieldZones,
  listVenueFields,
  updateFieldZone,
  updateVenueField,
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
  suggestFreeZones,
  type FieldConflictCandidate,
} from '../lib/fieldScheduleConflicts';
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
    return assignments.map((a) => {
      const zone = a.zone_id ? (zonesByField[a.field_id] ?? []).find((z) => z.id === a.zone_id) : null;
      return {
        id: a.id,
        fieldId: a.field_id,
        zoneId: a.zone_id,
        blocksEntireField: !a.zone_id || Boolean(zone?.blocks_entire_field),
        startsAtMs: new Date(a.starts_at).getTime(),
        endsAtMs: new Date(a.ends_at).getTime(),
        eventId: a.event_id,
      };
    });
  }, [assignments, zonesByField]);

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
  const zones = (zonesByField[block.assignment.field_id] ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    blocksEntireField: z.blocks_entire_field,
    isActive: z.is_active,
  }));
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
  return [venue?.name, field?.name, zone?.name ?? 'Gesamter Platz'].filter(Boolean).join(' · ');
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

  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-slate-800">
          {props.field.name}
          <span className="ml-2 text-[11px] font-medium text-slate-400">
            {VENUE_FIELD_TYPE_LABELS[props.field.field_type]}
          </span>
          {!props.field.is_active ? (
            <span className="ml-2 text-[11px] text-slate-400">inaktiv</span>
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
          {props.field.is_active ? 'Deaktivieren' : 'Aktivieren'}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Teilflächen: {props.zones.length === 0 ? 'nur gesamter Platz' : props.zones.map((z) => z.name).join(', ')}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
          placeholder="Teilfläche (z. B. Hälfte Nord)"
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
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold"
          onClick={async () => {
            const res = await createFieldZone({
              fieldId: props.field.id,
              clubId: props.clubId,
              name: 'Gesamter Platz',
              blocksEntireField: true,
            });
            if (res.error) props.onToast(res.error);
            else {
              props.onToast('Zone „Gesamter Platz“ angelegt.');
              await props.onReload();
            }
          }}
        >
          + Gesamter Platz
        </button>
      </div>
      {props.zones.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {props.zones.map((z) => (
            <li key={z.id} className="flex items-center justify-between text-[11px] text-slate-600">
              <span>
                {z.name}
                {z.blocks_entire_field ? ' · blockiert alle Teilflächen' : ''}
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
  const [zoneId, setZoneId] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      setVenueId(a?.venue_id ?? props.event.venue_id ?? props.venues[0]?.id ?? '');
      setFieldId(a?.field_id ?? '');
      setZoneId(a?.zone_id ?? '');
      setStartLocal(toDatetimeLocalValue(starts));
      setEndLocal(toDatetimeLocalValue(ends));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.event, props.venues]);

  const fieldsForVenue = props.fields.filter((f) => f.venue_id === venueId);
  const zones = fieldId ? props.zonesByField[fieldId] ?? [] : [];

  useEffect(() => {
    if (!fieldId && fieldsForVenue[0]) setFieldId(fieldsForVenue[0].id);
  }, [venueId, fieldsForVenue, fieldId]);

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
      setError('Sportanlage und Platz sind Pflicht.');
      setSaving(false);
      return;
    }

    const zones = (props.zonesByField[fieldId] ?? []).map((z) => ({
      id: z.id,
      name: z.name,
      blocksEntireField: z.blocks_entire_field,
      isActive: z.is_active,
    }));
    const localConflicts = findLocalFieldConflicts(
      {
        id: existing?.id ?? 'new',
        fieldId,
        zoneId: zoneId || null,
        blocksEntireField: !zoneId || Boolean(zones.find((z) => z.id === zoneId)?.blocksEntireField),
        startsAtMs: new Date(startsAt).getTime(),
        endsAtMs: new Date(endsAt).getTime(),
      },
      props.assignmentCandidates,
    );
    if (localConflicts.length > 0) {
      const suggestion = suggestFreeZones({
        fieldId,
        startsAtMs: new Date(startsAt).getTime(),
        endsAtMs: new Date(endsAt).getTime(),
        zones,
        existing: props.assignmentCandidates,
        excludeAssignmentId: existing?.id ?? null,
      });
      const freeNames = [
        ...(suggestion.entireFieldFree ? ['Gesamter Platz'] : []),
        ...suggestion.freeZones.map((z) => z.name),
      ];
      setHint(
        freeNames.length
          ? `Noch frei in diesem Zeitraum: ${freeNames.join(', ')}`
          : 'In diesem Zeitraum ist der Platz vollständig ausgelastet.',
      );
    }

    const res = await upsertEventFieldAssignment({
      clubId: props.clubId,
      eventId: props.event.id,
      venueId,
      fieldId,
      zoneId: zoneId || null,
      startsAt,
      endsAt,
      existingId: existing?.id ?? null,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      if (res.conflicts?.length) {
        const suggestion = suggestFreeZones({
          fieldId,
          startsAtMs: new Date(startsAt).getTime(),
          endsAtMs: new Date(endsAt).getTime(),
          zones,
          existing: props.assignmentCandidates,
          excludeAssignmentId: existing?.id ?? null,
        });
        const freeNames = [
          ...(suggestion.entireFieldFree ? ['Gesamter Platz'] : []),
          ...suggestion.freeZones.map((z) => z.name),
        ];
        setHint(
          freeNames.length
            ? `Noch frei in diesem Zeitraum: ${freeNames.join(', ')}`
            : 'In diesem Zeitraum ist der Platz vollständig ausgelastet.',
        );
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
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5"
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
            Sichtbar für den Verein — Änderungen nur durch Staff dieser Mannschaft oder Vereinsadmin.
          </p>
        ) : null}
        {loading ? (
          <p className="mt-4 text-[13px] text-slate-400">Laden…</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-[12px] font-medium text-slate-600">
              Sportanlage
              <select
                value={venueId}
                onChange={(e) => {
                  setVenueId(e.target.value);
                  setFieldId('');
                  setZoneId('');
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] disabled:bg-slate-50"
              >
                {props.venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-medium text-slate-600">
              Platz
              <select
                value={fieldId}
                disabled={!props.canManage}
                onChange={(e) => {
                  setFieldId(e.target.value);
                  setZoneId('');
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
            <label className="block text-[12px] font-medium text-slate-600">
              Teilfläche (optional)
              <select
                value={zoneId}
                disabled={!props.canManage}
                onChange={(e) => setZoneId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] disabled:bg-slate-50"
              >
                <option value="">Gesamter Platz</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                    {z.blocks_entire_field ? ' (blockiert alles)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-[12px] font-medium text-slate-600">
                Beginn
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
