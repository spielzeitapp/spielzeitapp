/**
 * APP-PLATZ.2 – Dark-Mode „Belegung anlegen“ (reuse createFacilityOccupancy).
 * Keine neue Persistenz: events + event_field_assignments + bestehende Grants/Conflicts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { Modal } from '../../app/ui/Modal';
import {
  checkOccupancyConflicts,
  createFacilityOccupancy,
  listVenuesForOccupancyCreate,
  occupancyPurposeForKind,
  type OccupancyKindForm,
} from '../../lib/createFacilityOccupancy';
import type { EventFieldAssignmentConflict } from '../../lib/eventFieldAssignments';
import {
  filterZonesForDemand,
  SPLIT_DEMAND_LABELS,
  type FieldSplitDemand,
} from '../../lib/fieldZoneGeometry';
import { zoneRowToGeometry, type VenueFieldRow, type VenueFieldZoneRow } from '../../lib/venueFields';
import type { VenueRow } from '../../lib/venues';
import { getDateTimePartsInTimeZone, VIENNA_TZ, zonedWallTimeToUtcMillis } from '../../lib/viennaTime';
import { FacilityFieldPitch } from '../facility/FacilityFieldPitch';

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

/** Start + 90 Minuten (Vienna wall clock). */
export function occupancyEndLocalFromStart(startLocal: string): string {
  const startIso = fromDatetimeLocalValue(startLocal);
  if (!startIso) return startLocal;
  const endIso = new Date(new Date(startIso).getTime() + 90 * 60 * 1000).toISOString();
  return toDatetimeLocalValue(endIso);
}

export function occupancyStartLocalFromMs(startMs: number): string {
  return toDatetimeLocalValue(new Date(startMs).toISOString());
}

export type AppCreateOccupancyPrefill = {
  dayKey: string;
  startMs: number;
  venueId: string;
  fieldId: string;
};

type Props = {
  open: boolean;
  clubId: string;
  teamSeasonId: string;
  teamLabel: string;
  canCreate: boolean;
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  prefill: AppCreateOccupancyPrefill;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

const APP_KINDS: { value: OccupancyKindForm; label: string }[] = [
  { value: 'training', label: 'Training' },
  { value: 'match', label: 'Heimspiel' },
];

export function AppCreateOccupancyModal(props: Props): React.ReactElement | null {
  const { user } = useAuth();
  const startInit = occupancyStartLocalFromMs(props.prefill.startMs);
  const [kind, setKind] = useState<OccupancyKindForm>('training');
  const [title, setTitle] = useState('Training');
  const [startLocal, setStartLocal] = useState(startInit);
  const [endLocal, setEndLocal] = useState(() => occupancyEndLocalFromStart(startInit));
  const [venueId, setVenueId] = useState(props.prefill.venueId);
  const [fieldId, setFieldId] = useState(props.prefill.fieldId);
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

  // Reset when opening a new free slot
  useEffect(() => {
    if (!props.open) return;
    const s = occupancyStartLocalFromMs(props.prefill.startMs);
    setKind('training');
    setTitle('Training');
    setStartLocal(s);
    setEndLocal(occupancyEndLocalFromStart(s));
    setVenueId(props.prefill.venueId);
    setFieldId(props.prefill.fieldId);
    setDemand('entire');
    setZoneId('');
    setNote('');
    setError(null);
    setCheckOk(null);
    setConflicts([]);
    setSaving(false);
  }, [props.open, props.prefill.startMs, props.prefill.venueId, props.prefill.fieldId]);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    void (async () => {
      setVenuesLoading(true);
      setVenueHint(null);
      const purpose = occupancyPurposeForKind(kind);
      const list = await listVenuesForOccupancyCreate({
        clubId: props.clubId,
        teamSeasonId: props.teamSeasonId,
        purpose,
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
        return;
      }
      if (!list.some((v) => v.id === venueId)) {
        const prefer = list.find((v) => v.id === props.prefill.venueId) ?? list[0];
        setVenueId(prefer.id);
        setFieldId(prefer.id === props.prefill.venueId ? props.prefill.fieldId : '');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload grants on kind/team; venueId intentional
  }, [props.open, kind, props.clubId, props.teamSeasonId]);

  useEffect(() => {
    if (kind === 'training') setTitle((t) => (t === 'Heimspiel' || !t.trim() ? 'Training' : t));
    if (kind === 'match') setTitle((t) => (t === 'Training' || !t.trim() ? 'Heimspiel' : t));
  }, [kind]);

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
      setError(res.conflicts[0]?.reason ?? 'Dieser Zeitraum ist bereits belegt.');
      return false;
    }
    setCheckOk('Keine Konflikte — Zeitraum ist frei.');
    return true;
  };

  const save = async () => {
    if (saving || checking) return;
    setSaving(true);
    setError(null);
    setCheckOk(null);
    if (!props.canCreate) {
      setError('Keine Berechtigung für diese Mannschaft.');
      setSaving(false);
      return;
    }
    if (!selectedVenue || !startsAtIso || !endsAtIso) {
      setError('Bitte alle Pflichtfelder ausfüllen.');
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
      teamSeasonId: props.teamSeasonId,
      kind,
      title: title.trim() || (kind === 'match' ? 'Heimspiel' : 'Training'),
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
      setError(
        result.rolledBack
          ? 'Platzzuordnung fehlgeschlagen — der Termin wurde nicht angelegt.'
          : result.error,
      );
      setSaving(false);
      return;
    }
    setSaving(false);
    await props.onCreated();
  };

  if (!props.open) return null;

  return (
    <Modal
      isOpen={props.open}
      title="Belegung anlegen"
      onClose={props.onClose}
      footer={
        <div className="flex w-full flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            disabled={saving || checking || venues.length === 0 || !props.canCreate}
            onClick={() => void save()}
            className="min-h-[46px] w-full rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={props.onClose}
            className="min-h-[44px] w-full rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white"
          >
            Abbrechen
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-2 text-[14px] text-white/85">
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/60">
          Mannschaft: <span className="font-semibold text-white">{props.teamLabel}</span>
        </p>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Belegungsart
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as OccupancyKindForm)}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white"
          >
            {APP_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            {kind === 'match' ? 'Gegner / Titel' : 'Titel'}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white"
            placeholder={kind === 'match' ? 'Gegner' : 'Titel'}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
              Beginn
            </span>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => {
                setStartLocal(e.target.value);
                setEndLocal(occupancyEndLocalFromStart(e.target.value));
              }}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
              Ende
            </span>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Sportanlage
          </span>
          <select
            value={venueId}
            onChange={(e) => {
              setVenueId(e.target.value);
              setFieldId('');
            }}
            disabled={venuesLoading || venues.length === 0}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white disabled:opacity-60"
          >
            {venues.length === 0 ? <option value="">Keine Anlage verfügbar</option> : null}
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {venueHint ? <p className="mt-1 text-[12px] text-amber-200">{venueHint}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Platz
          </span>
          <select
            value={fieldId}
            onChange={(e) => setFieldId(e.target.value)}
            disabled={!venueId || fieldsForVenue.length === 0}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white disabled:opacity-60"
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
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Platzbedarf
          </span>
          <select
            value={demand}
            onChange={(e) => setDemand(e.target.value as FieldSplitDemand)}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white"
          >
            {supported.map((d) => (
              <option key={d} value={d}>
                {SPLIT_DEMAND_LABELS[d]}
              </option>
            ))}
          </select>
        </label>

        {demand !== 'entire' ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
              Teilfläche wählen
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-2">
              <FacilityFieldPitch
                zones={zoneGeoms}
                demand={demand}
                selectedZoneId={zoneId || null}
                onSelectZone={(id) => setZoneId(id ?? '')}
                className="mx-auto max-h-40 w-full max-w-[280px] [&_svg]:!h-auto [&_svg]:max-h-36 [&_svg]:w-full"
                compact
              />
            </div>
            {!zoneId ? (
              <p className="text-[12px] text-amber-200">Bitte eine freie Teilfläche antippen.</p>
            ) : null}
          </div>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Interne Notiz (optional)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
            placeholder="Nur eigene Organisation"
          />
        </label>

        <button
          type="button"
          disabled={saving || checking || venues.length === 0}
          onClick={() => void runCheck()}
          className="min-h-[44px] w-full rounded-xl border border-white/20 bg-white/10 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {checking ? 'Prüfe…' : 'Belegung prüfen'}
        </button>

        {error ? (
          <div className="rounded-xl border border-red-400/35 bg-red-950/50 px-3 py-2 text-[12px] text-red-100" role="alert">
            {error}
            {conflicts.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-[11px] text-red-100/80">
                {conflicts.slice(0, 4).map((c) => (
                  <li key={c.assignment_id}>{c.reason || 'Konflikt'}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {checkOk ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/40 px-3 py-2 text-[12px] text-emerald-100">
            {checkOk}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
