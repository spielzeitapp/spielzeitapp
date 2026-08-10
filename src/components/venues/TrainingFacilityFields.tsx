/**
 * PLATZ.5: Konkreter Platz + Fläche für Training (nach Anlage).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { listVenueFields, listFieldZones, zoneRowToGeometry, type VenueFieldRow } from '../../lib/venueFields';
import {
  SPLIT_DEMAND_LABELS,
  filterZonesForDemand,
  inferDemandFromZone,
  type FieldSplitDemand,
} from '../../lib/fieldZoneGeometry';
import { FacilityFieldPitch } from '../facility/FacilityFieldPitch';

export type TrainingFacilitySelection = {
  fieldId: string | null;
  zoneId: string | null;
};

type Props = {
  venueId: string | null;
  value: TrainingFacilitySelection;
  onChange: (next: TrainingFacilitySelection) => void;
  labelClass?: string;
  inputClass?: string;
  disabled?: boolean;
};

export function TrainingFacilityFields(props: Props): React.ReactElement | null {
  const {
    venueId,
    value,
    onChange,
    labelClass = 'mb-1 block text-sm font-medium text-white/80',
    inputClass = 'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white focus:border-red-500/45 focus:outline-none',
    disabled = false,
  } = props;

  const [fields, setFields] = useState<VenueFieldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [demand, setDemand] = useState<FieldSplitDemand>('entire');
  const [zoneGeoms, setZoneGeoms] = useState<ReturnType<typeof zoneRowToGeometry>[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!venueId) {
      setFields([]);
      setZoneGeoms([]);
      onChange({ fieldId: null, zoneId: null });
      return;
    }
    setLoading(true);
    void (async () => {
      const res = await listVenueFields(venueId);
      if (cancelled) return;
      const active = res.data.filter((f) => f.is_active);
      setFields(active);
      setLoading(false);
      if (active.length === 1 && !value.fieldId) {
        onChange({ fieldId: active[0].id, zoneId: null });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  useEffect(() => {
    let cancelled = false;
    if (!value.fieldId) {
      setZoneGeoms([]);
      return;
    }
    void (async () => {
      const zRes = await listFieldZones(value.fieldId!);
      if (cancelled) return;
      const geoms = zRes.data.map(zoneRowToGeometry);
      setZoneGeoms(geoms);
      if (value.zoneId) {
        const z = geoms.find((g) => g.id === value.zoneId);
        if (z) setDemand(inferDemandFromZone(z));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value.fieldId, value.zoneId]);

  const demandZones = useMemo(() => filterZonesForDemand(zoneGeoms, demand), [zoneGeoms, demand]);

  if (!venueId) return null;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass} htmlFor="training-field-select">
          Konkreter Platz
        </label>
        <select
          id="training-field-select"
          className={inputClass}
          disabled={disabled || loading}
          value={value.fieldId ?? ''}
          onChange={(e) => {
            onChange({ fieldId: e.target.value || null, zoneId: null });
            setDemand('entire');
          }}
        >
          <option value="">— Platz wählen —</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        {!loading && fields.length === 0 ? (
          <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Für diese Sportanlage sind noch keine Plätze eingerichtet.
          </p>
        ) : null}
      </div>

      {value.fieldId ? (
        <>
          <fieldset disabled={disabled}>
            <legend className={labelClass}>Platzbedarf</legend>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['entire', 'half', 'third', 'quarter'] as FieldSplitDemand[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDemand(d);
                    onChange({ fieldId: value.fieldId, zoneId: null });
                  }}
                  className={[
                    'rounded-lg border px-2 py-2 text-[12px] font-semibold',
                    demand === d
                      ? 'border-red-500 bg-red-700 text-white'
                      : 'border-white/15 bg-white/[0.04] text-white/85',
                  ].join(' ')}
                >
                  {SPLIT_DEMAND_LABELS[d]}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <p className={labelClass}>Bereich auf dem Spielfeld</p>
            <FacilityFieldPitch
              zones={zoneGeoms}
              demand={demand}
              selectedZoneId={value.zoneId}
              onSelectZone={(id) => onChange({ fieldId: value.fieldId, zoneId: id })}
              disabled={disabled}
            />
            <select
              className={`mt-2 ${inputClass}`}
              disabled={disabled}
              value={value.zoneId ?? ''}
              onChange={(e) => onChange({ fieldId: value.fieldId, zoneId: e.target.value || null })}
            >
              <option value="">{demand === 'entire' ? 'Ganzer Platz' : 'Bitte Bereich wählen'}</option>
              {demandZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
    </div>
  );
}
