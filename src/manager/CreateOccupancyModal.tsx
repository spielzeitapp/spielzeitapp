/**
 * MANAGER-PLATZ.7 – Dialog „Belegung anlegen“ (Manager-exklusiv).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  checkOccupancyConflicts,
  createFacilityOccupancy,
  listVenuesForOccupancyCreate,
  occupancyPurposeForKind,
  type OccupancyKindForm,
} from '../lib/createFacilityOccupancy';
import type { EventFieldAssignmentConflict } from '../lib/eventFieldAssignments';
import {
  filterZonesForDemand,
  type FieldSplitDemand,
  SPLIT_DEMAND_LABELS,
} from '../lib/fieldZoneGeometry';
import { zoneRowToGeometry } from '../lib/venueFields';
import type { VenueFieldRow, VenueFieldZoneRow } from '../lib/venueFields';
import type { VenueRow } from '../lib/venues';
import { getDateTimePartsInTimeZone, VIENNA_TZ, zonedWallTimeToUtcMillis } from '../lib/viennaTime';

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

function defaultStartEndForDay(dayKey: string): { start: string; end: string } {
  // dayKey = YYYY-MM-DD (Vienna)
  const start = `${dayKey}T17:00`;
  const end = `${dayKey}T18:30`;
  return { start, end };
}

export type CreateOccupancyModalProps = {
  clubId: string;
  defaultTeamSeasonId: string;
  teamOptions: [string, string][];
  canCreateForTeamSeason: (teamSeasonId: string) => boolean;
  clubVenues: VenueRow[];
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  /** Vienna day key YYYY-MM-DD */
  initialDayKey?: string | null;
  /** PLATZ-UX.1: pre-fill from timeline slot click */
  initialHour?: number;
  initialVenueId?: string;
  initialFieldId?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

export function CreateOccupancyModal(props: CreateOccupancyModalProps): React.ReactElement {
  const { user } = useAuth();
  const creatableTeams = props.teamOptions.filter(([id]) => props.canCreateForTeamSeason(id));
  const initialTs =
    creatableTeams.find(([id]) => id === props.defaultTeamSeasonId)?.[0] ??
    creatableTeams[0]?.[0] ??
    props.defaultTeamSeasonId;

  const [teamSeasonId, setTeamSeasonId] = useState(initialTs);
  const [kind, setKind] = useState<OccupancyKindForm>('training');
  const [title, setTitle] = useState('Training');
  const [startLocal, setStartLocal] = useState(() => {
    const key = props.initialDayKey || new Date().toISOString().slice(0, 10);
    if (props.initialHour != null) {
      const h = String(props.initialHour).padStart(2, '0');
      return `${key}T${h}:00`;
    }
    return defaultStartEndForDay(key).start;
  });
  const [endLocal, setEndLocal] = useState(() => {
    const key = props.initialDayKey || new Date().toISOString().slice(0, 10);
    if (props.initialHour != null) {
      const endH = Math.min(props.initialHour + 1, 23);
      const h = String(endH).padStart(2, '0');
      return `${key}T${h}:30`;
    }
    return defaultStartEndForDay(key).end;
  });
  const [venueId, setVenueId] = useState(props.initialVenueId ?? '');
  const [fieldId, setFieldId] = useState(props.initialFieldId ?? '');
  const [demand, setDemand] = useState<FieldSplitDemand>('entire');
  const [zoneId, setZoneId] = useState('');
  const [note, setNote] = useState('');
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venueHint, setVenueHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkOk, setCheckOk] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<EventFieldAssignmentConflict[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setVenuesLoading(true);
      setVenueHint(null);
      const purpose = occupancyPurposeForKind(kind);
      const list = await listVenuesForOccupancyCreate({
        clubId: props.clubId,
        teamSeasonId,
        purpose,
        clubVenues: props.clubVenues,
      });
      if (cancelled) return;
      setVenues(list);
      setVenuesLoading(false);
      if (list.length === 0) {
        setVenueHint(
          kind === 'match'
            ? 'Keine Anlage mit Freigabe „Heimspiel“ verfügbar.'
            : 'Keine Anlage mit Freigabe „Training“ verfügbar.',
        );
        setVenueId('');
        setFieldId('');
      } else if (!list.some((v) => v.id === venueId)) {
        setVenueId(list[0].id);
        setFieldId('');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when kind/team change; venueId intentional
  }, [kind, teamSeasonId, props.clubId, props.clubVenues]);

  useEffect(() => {
    if (kind === 'training' && !title.trim()) setTitle('Training');
    if (kind === 'match' && (title === 'Training' || title === 'Turnier' || title === 'Belegung')) {
      setTitle('Heimspiel');
    }
    if (kind === 'tournament' && (title === 'Training' || title === 'Heimspiel' || title === 'Belegung')) {
      setTitle('Turnier');
    }
    if (kind === 'event' && (title === 'Training' || title === 'Heimspiel' || title === 'Turnier')) {
      setTitle('Belegung');
    }
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (zoneId && !demandZones.some((z) => z.id === zoneId)) setZoneId('');
  }, [demand, fieldId, zoneGeoms, demandZones, zoneId]);

  const startsAtIso = fromDatetimeLocalValue(startLocal);
  const endsAtIso = fromDatetimeLocalValue(endLocal);
  const selectedVenue = venues.find((v) => v.id === venueId) ?? null;

  const resolvedZoneId = useMemo(() => {
    if (demand === 'entire') {
      const entire = zoneGeoms.find((z) => z.layoutKind === 'entire' || z.blocksEntireField);
      return entire?.id ?? null;
    }
    return zoneId || null;
  }, [demand, zoneGeoms, zoneId]);

  const runCheck = async (): Promise<boolean> => {
    setChecking(true);
    setError(null);
    setCheckOk(null);
    setConflicts([]);
    if (!startsAtIso || !endsAtIso) {
      setError('Ungültige Zeitangabe.');
      setChecking(false);
      return false;
    }
    if (!venueId || !fieldId) {
      setError('Sportanlage und Platz sind Pflicht.');
      setChecking(false);
      return false;
    }
    if (demand !== 'entire' && !resolvedZoneId) {
      setError('Bitte einen konkreten Bereich auf dem Spielfeld wählen.');
      setChecking(false);
      return false;
    }
    const res = await checkOccupancyConflicts({
      clubId: props.clubId,
      fieldId,
      zoneId: resolvedZoneId,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
    });
    setChecking(false);
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.conflicts.length > 0) {
      setConflicts(res.conflicts);
      setError(res.conflicts[0]?.reason ?? 'Platzkonflikt');
      return false;
    }
    setCheckOk('Keine Konflikte — Zeitraum ist frei.');
    return true;
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setCheckOk(null);
    if (!selectedVenue || !startsAtIso || !endsAtIso) {
      setError('Bitte alle Pflichtfelder ausfüllen.');
      setSaving(false);
      return;
    }
    if (!props.canCreateForTeamSeason(teamSeasonId)) {
      setError('Keine Berechtigung für diese Mannschaft.');
      setSaving(false);
      return;
    }
    const ok = await runCheck();
    if (!ok) {
      setSaving(false);
      return;
    }
    const result = await createFacilityOccupancy({
      clubId: props.clubId,
      teamSeasonId,
      kind,
      title: title.trim() || (kind === 'match' ? 'Heimspiel' : kind === 'training' ? 'Training' : 'Belegung'),
      startsAtIso,
      endsAtIso,
      venue: selectedVenue,
      fieldId,
      zoneId: resolvedZoneId,
      createdByUserId: user?.id ?? null,
      note: note.trim() || null,
    });
    if (!result.ok) {
      setConflicts(result.conflicts ?? []);
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    await props.onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-occupancy-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700/80">Platzbelegung</p>
            <h2 id="create-occupancy-title" className="text-lg font-semibold text-slate-900">
              Belegung anlegen
            </h2>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full px-2 py-1 text-[12px] font-semibold text-slate-500 hover:bg-slate-100"
          >
            Schließen
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Mannschaft / Saison</span>
            <select
              value={teamSeasonId}
              onChange={(e) => setTeamSeasonId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800"
            >
              {creatableTeams.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Belegungsart</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as OccupancyKindForm)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800"
            >
              <option value="training">Training</option>
              <option value="match">Heimspiel</option>
              <option value="tournament">Turnier</option>
              <option value="event">Sonstige Belegung</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">
              {kind === 'match' ? 'Gegner / Titel' : 'Titel'}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-slate-800"
              placeholder={kind === 'match' ? 'Gegner' : 'Titel'}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Beginn</span>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-slate-800"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Ende</span>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-slate-800"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Sportanlage</span>
            <select
              value={venueId}
              onChange={(e) => {
                setVenueId(e.target.value);
                setFieldId('');
              }}
              disabled={venuesLoading || venues.length === 0}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 disabled:opacity-60"
            >
              {venues.length === 0 ? <option value="">Keine Anlage verfügbar</option> : null}
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {venueHint ? <p className="mt-1 text-[11px] text-amber-800">{venueHint}</p> : null}
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Platz</span>
            <select
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              disabled={!venueId || fieldsForVenue.length === 0}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 disabled:opacity-60"
            >
              {fieldsForVenue.length === 0 ? <option value="">Kein Platz</option> : null}
              {fieldsForVenue.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">Platzbedarf</span>
            <select
              value={demand}
              onChange={(e) => setDemand(e.target.value as FieldSplitDemand)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800"
            >
              {supported.map((d) => (
                <option key={d} value={d}>
                  {SPLIT_DEMAND_LABELS[d]}
                </option>
              ))}
            </select>
          </label>

          {demand !== 'entire' ? (
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-600">Teilfläche / Zone</span>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800"
              >
                <option value="">Bitte wählen</option>
                {demandZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-600">
              Interne Notiz (nur eigene Organisation)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-800"
              placeholder="Optional"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              {error}
              {conflicts.length > 0 ? (
                <ul className="mt-1 list-inside list-disc text-[11px]">
                  {conflicts.slice(0, 4).map((c) => (
                    <li key={c.assignment_id}>
                      {c.reason || 'Konflikt'} · {new Date(c.starts_at).toLocaleString('de-AT')}–
                      {new Date(c.ends_at).toLocaleTimeString('de-AT', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {checkOk ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
              {checkOk}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={saving || checking}
              onClick={() => void runCheck()}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-800 disabled:opacity-50"
            >
              {checking ? 'Prüfe…' : 'Belegung prüfen'}
            </button>
            <button
              type="button"
              disabled={saving || checking || venues.length === 0}
              onClick={() => void save()}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="w-full text-center text-[12px] font-semibold text-slate-500 hover:underline"
          >
            Abbrechen
          </button>
          <p className="text-[11px] text-slate-400">
            Auswärtsspiele gehören nicht hierher. Anlagen nur gemäß Freigabe (Training / Heimspiel).
          </p>
        </div>
      </div>
    </div>
  );
}
