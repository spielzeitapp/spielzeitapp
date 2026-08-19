/**
 * PLATZ-UX.1 – Wochenansicht: 7-Tage-Übersicht mit Venue/Field-Gruppierung.
 */
import React, { useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { VenueRow } from '../../lib/venues';
import type { VenueFieldRow, VenueFieldZoneRow } from '../../lib/venueFields';
import { zoneRowToGeometry } from '../../lib/venueFields';
import type { FieldConflictCandidate, ZoneMeta } from '../../lib/fieldScheduleConflicts';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from '../../lib/viennaTime';
import { toViennaDayKey, addDays } from '../../pages/calendar/calendarUtils';
import {
  computeFieldDaySlots,
  STATUS_LABELS,
  type SlotStatus,
} from './availabilityHelpers';
import type { DayTimelineBlock } from './PlatzDayTimelineView';

type Props = {
  weekDays: Date[];
  todayKey: string;
  venues: VenueRow[];
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  candidates: FieldConflictCandidate[];
  blocks: DayTimelineBlock[];
  onSwitchToDay: (dayKey: string) => void;
  onSelectBlock: (block: DayTimelineBlock) => void;
};

function statusIcon(status: SlotStatus, size = 'h-3 w-3'): React.ReactNode {
  if (status === 'free') return <CheckCircle className={`${size} text-emerald-500`} aria-hidden />;
  if (status === 'partial') return <AlertTriangle className={`${size} text-amber-500`} aria-hidden />;
  return <XCircle className={`${size} text-red-500`} aria-hidden />;
}

function statusBgSubtle(status: SlotStatus): string {
  if (status === 'free') return '';
  if (status === 'partial') return 'bg-amber-50/50';
  return 'bg-red-50/50';
}

function blockKindDot(kindLabel: string): string {
  if (kindLabel === 'Spiel') return 'bg-red-600';
  if (kindLabel === 'Training') return 'bg-emerald-600';
  if (kindLabel === 'Turnier') return 'bg-amber-500';
  return 'bg-slate-500';
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

function peakStatusForFieldDay(
  fieldId: string,
  dayKey: string,
  candidates: readonly FieldConflictCandidate[],
  zones: readonly ZoneMeta[],
): SlotStatus {
  const slots = computeFieldDaySlots({
    fieldId,
    dayKey,
    candidates: candidates as FieldConflictCandidate[],
    zones,
    stepMinutes: 60,
    rangeStartHour: 8,
    rangeEndHour: 22,
  });
  let peak: SlotStatus = 'free';
  for (const s of slots) {
    if (s.status === 'full') return 'full';
    if (s.status === 'partial') peak = 'partial';
  }
  return peak;
}

export function PlatzWeekOverview(props: Props): React.ReactElement {
  const [selectedMobileDay, setSelectedMobileDay] = useState(() => props.todayKey);

  const venueGroups = useMemo(() => {
    const activeFields = props.fields.filter((f) => f.is_active);
    return props.venues
      .filter((v) => v.is_active)
      .map((v) => ({
        venue: v,
        fields: activeFields.filter((f) => f.venue_id === v.id).sort((a, b) => a.name.localeCompare(b.name, 'de')),
      }))
      .filter((g) => g.fields.length > 0);
  }, [props.venues, props.fields]);

  const dayKeys = useMemo(() => props.weekDays.map((d) => toViennaDayKey(d)), [props.weekDays]);

  // Desktop view
  return (
    <div className="space-y-4">
      {/* Desktop: full week grid */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        {/* Day header row */}
        <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
          <div className="border-r border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Platz
          </div>
          {props.weekDays.map((d, i) => {
            const key = dayKeys[i]!;
            const isToday = key === props.todayKey;
            const dp = getDateTimePartsInTimeZone(d, VIENNA_TZ);
            return (
              <button
                key={key}
                type="button"
                onClick={() => props.onSwitchToDay(key)}
                className={`border-l border-slate-100 px-2 py-2 text-center hover:bg-slate-50 ${isToday ? 'bg-red-50' : ''}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, weekday: 'short' }).format(d)}
                </p>
                <p className={`text-[14px] font-semibold ${isToday ? 'text-red-700' : 'text-slate-900'}`}>
                  {dp?.day ?? d.getDate()}
                </p>
              </button>
            );
          })}
        </div>

        {/* Venue groups + field rows */}
        {venueGroups.map((g) => (
          <React.Fragment key={g.venue.id}>
            <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[12px] font-semibold text-slate-700" style={{ gridColumn: '1 / -1' }}>
              {g.venue.name}
            </div>
            {g.fields.map((f) => {
              const zoneMetas = buildZoneMetas(props.zonesByField[f.id] ?? []);
              const fieldBlocks = props.blocks.filter((b) => b.fieldId === f.id);

              return (
                <div key={f.id} className="grid border-b border-slate-100" style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
                  <div className="flex items-center border-r border-slate-200 px-3 py-2">
                    <p className="truncate text-[12px] font-medium text-slate-700">{f.name}</p>
                  </div>
                  {dayKeys.map((dk, di) => {
                    const peak = peakStatusForFieldDay(f.id, dk, props.candidates, zoneMetas);
                    const dayBlocks = fieldBlocks.filter((b) => {
                      const p = getDateTimePartsInTimeZone(new Date(b.startsAtMs), VIENNA_TZ);
                      if (!p) return false;
                      const bdk = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
                      return bdk === dk;
                    });

                    return (
                      <button
                        key={dk}
                        type="button"
                        onClick={() => props.onSwitchToDay(dk)}
                        className={`border-l border-slate-100 px-1.5 py-1.5 text-left ${statusBgSubtle(peak)} hover:bg-slate-50/80 min-h-[60px]`}
                        aria-label={`${f.name} ${dk}: ${STATUS_LABELS[peak]}, ${dayBlocks.length} Belegung${dayBlocks.length !== 1 ? 'en' : ''}`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          {statusIcon(peak, 'h-2.5 w-2.5')}
                          <span className="text-[9px] text-slate-400">{STATUS_LABELS[peak]}</span>
                        </div>
                        {dayBlocks.slice(0, 3).map((b) => (
                          <div
                            key={b.id}
                            className="mb-0.5 flex items-center gap-1 text-[10px] leading-tight text-slate-700 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); props.onSelectBlock(b); }}
                          >
                            <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${blockKindDot(b.kindLabel)}`} />
                            <span className="truncate">{b.timeLabel}</span>
                          </div>
                        ))}
                        {dayBlocks.length > 3 ? (
                          <p className="text-[9px] text-slate-400">+{dayBlocks.length - 3} weitere</p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: day selector + list */}
      <div className="lg:hidden space-y-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {props.weekDays.map((d, i) => {
            const key = dayKeys[i]!;
            const active = key === selectedMobileDay;
            const dp = getDateTimePartsInTimeZone(d, VIENNA_TZ);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedMobileDay(key)}
                className={[
                  'min-w-[3rem] rounded-xl px-2 py-2 text-center text-[11px] font-semibold',
                  active ? 'bg-red-700 text-white' : 'border border-slate-200 bg-white text-slate-700',
                ].join(' ')}
              >
                <div>{new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, weekday: 'short' }).format(d)}</div>
                <div className="text-[14px]">{dp?.day}</div>
              </button>
            );
          })}
        </div>

        {venueGroups.map((g) => (
          <div key={g.venue.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[13px] font-semibold text-slate-800 mb-2">{g.venue.name}</p>
            {g.fields.map((f) => {
              const zoneMetas = buildZoneMetas(props.zonesByField[f.id] ?? []);
              const peak = peakStatusForFieldDay(f.id, selectedMobileDay, props.candidates, zoneMetas);
              const dayBlocks = props.blocks.filter((b) => {
                if (b.fieldId !== f.id) return false;
                const p = getDateTimePartsInTimeZone(new Date(b.startsAtMs), VIENNA_TZ);
                if (!p) return false;
                const bdk = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
                return bdk === selectedMobileDay;
              });

              return (
                <div key={f.id} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {statusIcon(peak, 'h-3 w-3')}
                    <span className="text-[12px] font-medium text-slate-700">{f.name}</span>
                    <span className="text-[11px] text-slate-400">{STATUS_LABELS[peak]}</span>
                  </div>
                  {dayBlocks.length === 0 ? (
                    <p className="pl-5 text-[11px] text-slate-400">Keine Belegungen</p>
                  ) : (
                    <ul className="pl-5 space-y-1">
                      {dayBlocks.map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => props.onSelectBlock(b)}
                            className="flex items-center gap-1.5 text-[11px] text-slate-700 hover:text-red-700"
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${blockKindDot(b.kindLabel)}`} />
                            <span>{b.timeLabel} · {b.kindLabel} · {b.teamLabel}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => props.onSwitchToDay(selectedMobileDay)}
              className="mt-2 text-[11px] font-semibold text-red-700 hover:underline"
            >
              Tagesansicht öffnen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
