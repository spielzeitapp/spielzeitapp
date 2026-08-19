/**
 * PLATZ-UX.1 – Monatsansicht: Auslastungsüberblick mit Klick auf Tag → Tagesansicht.
 */
import React, { useMemo } from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { VenueFieldRow, VenueFieldZoneRow } from '../../lib/venueFields';
import { zoneRowToGeometry } from '../../lib/venueFields';
import type { FieldConflictCandidate, ZoneMeta } from '../../lib/fieldScheduleConflicts';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from '../../lib/viennaTime';
import { computeFieldMonthSummary, STATUS_LABELS, type SlotStatus } from './availabilityHelpers';

type Props = {
  monthAnchor: Date;
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  candidates: FieldConflictCandidate[];
  todayKey: string;
  onSwitchToDay: (dayKey: string) => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getDaysInMonth(anchor: Date): string[] {
  const p = getDateTimePartsInTimeZone(anchor, VIENNA_TZ);
  if (!p) return [];
  const y = p.year;
  const m = p.month;
  const daysCount = new Date(y, m, 0).getDate();
  const keys: string[] = [];
  for (let d = 1; d <= daysCount; d++) {
    keys.push(`${y}-${pad2(m)}-${pad2(d)}`);
  }
  return keys;
}

function firstDayOfWeek(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dow = new Date(y!, m! - 1, d!).getDay();
  return (dow + 6) % 7;
}

function statusIcon(status: SlotStatus): React.ReactNode {
  if (status === 'free') return <CheckCircle className="h-3 w-3 text-emerald-500" aria-hidden />;
  if (status === 'partial') return <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden />;
  return <XCircle className="h-3 w-3 text-red-500" aria-hidden />;
}

function statusBg(status: SlotStatus): string {
  if (status === 'free') return '';
  if (status === 'partial') return 'bg-amber-50/60';
  return 'bg-red-50/60';
}

function buildZoneMetas(zones: VenueFieldZoneRow[]): ZoneMeta[] {
  return zones.map((z) => {
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
}

export function PlatzMonthOverview(props: Props): React.ReactElement {
  const dayKeys = useMemo(() => getDaysInMonth(props.monthAnchor), [props.monthAnchor]);
  const leadingBlanks = useMemo(() => (dayKeys[0] ? firstDayOfWeek(dayKeys[0]) : 0), [dayKeys]);

  const activeFields = useMemo(
    () => props.fields.filter((f) => f.is_active),
    [props.fields],
  );

  const daySummaries = useMemo(() => {
    const merged = new Map<string, { count: number; peak: SlotStatus }>();
    for (const dk of dayKeys) merged.set(dk, { count: 0, peak: 'free' });

    for (const f of activeFields) {
      const zoneMetas = buildZoneMetas(props.zonesByField[f.id] ?? []);
      const summaries = computeFieldMonthSummary({
        fieldId: f.id,
        dayKeys,
        candidates: props.candidates,
        zones: zoneMetas,
      });
      for (const s of summaries) {
        const existing = merged.get(s.dayKey);
        if (!existing) continue;
        existing.count += s.occupancyCount;
        if (s.peakStatus === 'full') existing.peak = 'full';
        else if (s.peakStatus === 'partial' && existing.peak !== 'full') existing.peak = 'partial';
      }
    }
    return merged;
  }, [dayKeys, activeFields, props.candidates, props.zonesByField]);

  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const monthLabel = useMemo(() => {
    const p = getDateTimePartsInTimeZone(props.monthAnchor, VIENNA_TZ);
    if (!p) return '';
    return new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, month: 'long', year: 'numeric' }).format(props.monthAnchor);
  }, [props.monthAnchor]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-[14px] font-semibold text-slate-900">{monthLabel}</h3>
        <p className="text-[12px] text-slate-500">Klicke auf einen Tag für die Tagesansicht</p>
      </div>

      <div className="p-3">
        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdays.map((wd) => (
            <div key={wd} className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 py-1">
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {dayKeys.map((dk) => {
            const day = Number(dk.split('-')[2]);
            const isToday = dk === props.todayKey;
            const summary = daySummaries.get(dk);
            const peak = summary?.peak ?? 'free';
            const count = summary?.count ?? 0;

            return (
              <button
                key={dk}
                type="button"
                onClick={() => props.onSwitchToDay(dk)}
                className={[
                  'flex flex-col items-center rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-slate-100',
                  statusBg(peak),
                  isToday ? 'ring-2 ring-red-500/40' : '',
                ].join(' ')}
                aria-label={`${dk}: ${STATUS_LABELS[peak]}, ${count} Belegung${count !== 1 ? 'en' : ''}`}
              >
                <span className={`text-[13px] font-semibold ${isToday ? 'text-red-700' : 'text-slate-800'}`}>
                  {day}
                </span>
                {count > 0 ? (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {statusIcon(peak)}
                    <span className="text-[9px] text-slate-500">{count}</span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" /> Frei</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> Teilweise</span>
        <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" /> Stark</span>
      </div>
    </div>
  );
}
