/**
 * PLATZ-UX.1E – Wochenansicht: 7-Tage-Grid mit Karten und Mini-Spielfeld.
 */
import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { VenueRow } from '../../lib/venues';
import type { VenueFieldRow, VenueFieldZoneRow } from '../../lib/venueFields';
import { zoneRowToGeometry } from '../../lib/venueFields';
import type { FieldConflictCandidate, ZoneMeta } from '../../lib/fieldScheduleConflicts';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from '../../lib/viennaTime';
import { toViennaDayKey } from '../../pages/calendar/calendarUtils';
import {
  computeFieldDaySlots,
  STATUS_LABELS,
  type SlotStatus,
} from './availabilityHelpers';
import { FieldOccupancyMiniMap } from './FieldOccupancyMiniMap';
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

function statusDot(status: SlotStatus): string {
  if (status === 'free') return 'bg-emerald-400';
  if (status === 'partial') return 'bg-amber-400';
  return 'bg-red-500';
}

function buildZoneMetas(zones: VenueFieldZoneRow[]): ZoneMeta[] {
  return zones.map((z) => {
    const geom = zoneRowToGeometry(z);
    return { id: z.id, name: z.name, blocksEntireField: z.blocks_entire_field || geom.layoutKind === 'entire', isActive: z.is_active, zone: geom, layoutKind: geom.layoutKind, rect: geom.rect };
  });
}

function peakStatusForFieldDay(
  fieldId: string,
  dayKey: string,
  candidates: FieldConflictCandidate[],
  zoneMetas: ZoneMeta[],
): SlotStatus {
  const slots = computeFieldDaySlots({
    fieldId,
    dayKey,
    candidates,
    zones: zoneMetas,
  });
  let hasFull = false;
  let hasPartial = false;
  for (const s of slots) {
    if (s.status === 'full') hasFull = true;
    else if (s.status === 'partial') hasPartial = true;
  }
  if (hasFull) return 'full';
  if (hasPartial) return 'partial';
  return 'free';
}

export function PlatzWeekOverview(props: Props): React.ReactElement {
  const [selectedMobileDay, setSelectedMobileDay] = useState(() => props.todayKey);

  const weekDays = props.weekDays ?? [];
  const venues = props.venues ?? [];
  const fields = props.fields ?? [];
  const blocks = props.blocks ?? [];

  const dayKeys = useMemo(
    () => weekDays.map((d) => toViennaDayKey(d)),
    [weekDays],
  );

  const venueGroups = useMemo(() => {
    return venues.map((v) => ({
      venue: v,
      fields: fields.filter((f) => f.venue_id === v.id && f.is_active),
    })).filter((g) => g.fields.length > 0);
  }, [venues, fields]);

  return (
    <div className="space-y-4">
      {/* Desktop 7-day grid */}
      <div className="hidden lg:block overflow-x-auto">
        {/* Day headers */}
        <div className="grid border-b border-slate-200 sticky top-0 bg-white z-10" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
          <div className="border-r border-slate-200 px-3 py-2" />
          {weekDays.map((d, i) => {
            const dk = dayKeys[i]!;
            const isToday = dk === props.todayKey;
            const dp = getDateTimePartsInTimeZone(d, VIENNA_TZ);
            return (
              <button
                key={dk}
                type="button"
                onClick={() => props.onSwitchToDay(dk)}
                className={`border-l border-slate-100 px-2 py-2 text-center text-[11px] font-semibold hover:bg-slate-50 ${isToday ? 'bg-red-50/50 text-red-700' : 'text-slate-600'}`}
              >
                <div>{new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, weekday: 'short' }).format(d)}</div>
                <div className="text-[14px]">{dp?.day}</div>
              </button>
            );
          })}
        </div>

        {/* Venue/field rows */}
        {venueGroups.map((g) => (
          <React.Fragment key={g.venue.id}>
            <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wide" style={{ gridColumn: '1 / -1' }}>
                {g.venue.name}
              </div>
            </div>
            {g.fields.map((f) => {
              const zoneMetas = buildZoneMetas(props.zonesByField[f.id] ?? []);
              const fieldBlocks = blocks.filter((b) => b.fieldId === f.id);

              return (
                <div key={f.id} className="grid border-b border-slate-100" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
                  <div className="flex items-center border-r border-slate-200 px-3 py-2">
                    <p className="truncate text-[12px] font-medium text-slate-700">{f.name}</p>
                  </div>
                  {dayKeys.map((dk) => {
                    const peak = peakStatusForFieldDay(f.id, dk, props.candidates, zoneMetas);
                    const dayBlocks = fieldBlocks.filter((b) => {
                      const p = getDateTimePartsInTimeZone(new Date(b.startsAtMs), VIENNA_TZ);
                      if (!p) return false;
                      return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}` === dk;
                    });

                    return (
                      <div
                        key={dk}
                        className="border-l border-slate-100 px-1.5 py-1.5 min-h-[80px]"
                      >
                        {dayBlocks.length === 0 ? (
                          <div className="flex items-center gap-1 text-[9px] text-slate-400">
                            <span className={`h-2 w-2 rounded-full ${statusDot('free')}`} />
                            Frei
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {dayBlocks.slice(0, 2).map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); props.onSelectBlock(b); }}
                                className="w-full rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-sm hover:shadow-md transition-shadow"
                                title={`${b.timeLabel} · ${b.teamLabel || 'Andere Mannschaft'} · ${b.kindLabel} · ${b.spatial.fractionLabel}`}
                              >
                                <div className="flex items-start gap-1">
                                  {b.spatial.segments.length > 0 ? (
                                    <FieldOccupancyMiniMap
                                      segments={b.spatial.segments}
                                      className="h-[24px] w-[36px] shrink-0"
                                    />
                                  ) : b.spatial.status === 'full' ? (
                                    <div className="h-[24px] w-[36px] shrink-0 rounded bg-red-300 border border-red-400" />
                                  ) : null}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[9px] font-semibold text-slate-800">{b.timeLabel}</p>
                                    <p className="truncate text-[8px] text-slate-600">{b.teamLabel || 'Andere Mannschaft'}</p>
                                    <p className="truncate text-[8px] text-slate-500">{b.kindLabel}</p>
                                  </div>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between">
                                  <span className={`text-[8px] font-semibold ${b.spatial.status === 'full' ? 'text-red-600' : b.spatial.status === 'partial' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {b.spatial.fractionLabel}
                                  </span>
                                  {!b.canEdit ? (
                                    <span className="flex items-center gap-0.5 text-[7px] text-slate-400">
                                      <Lock className="h-2 w-2" />
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            ))}
                            {dayBlocks.length > 2 ? (
                              <button
                                type="button"
                                onClick={() => props.onSwitchToDay(dk)}
                                className="w-full text-[9px] font-semibold text-red-700 hover:underline text-center"
                              >
                                + {dayBlocks.length - 2} weitere
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: day selector + cards */}
      <div className="lg:hidden space-y-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {weekDays.map((d, i) => {
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
              const dayBlocks = blocks.filter((b) => {
                if (b.fieldId !== f.id) return false;
                const p = getDateTimePartsInTimeZone(new Date(b.startsAtMs), VIENNA_TZ);
                if (!p) return false;
                return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}` === selectedMobileDay;
              });

              return (
                <div key={f.id} className="mb-3 last:mb-0">
                  <p className="text-[11px] font-medium text-slate-600 mb-1">{f.name}</p>
                  {dayBlocks.length === 0 ? (
                    <p className="text-[10px] text-slate-400 pl-2">Keine Belegungen</p>
                  ) : (
                    <div className="space-y-1.5 pl-2">
                      {dayBlocks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => props.onSelectBlock(b)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left shadow-sm"
                        >
                          <div className="flex items-start gap-2">
                            {b.spatial.segments.length > 0 ? (
                              <FieldOccupancyMiniMap
                                segments={b.spatial.segments}
                                className="h-[28px] w-[42px] shrink-0"
                              />
                            ) : b.spatial.status === 'full' ? (
                              <div className="h-[28px] w-[42px] shrink-0 rounded bg-red-300 border border-red-400" />
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-slate-800">{b.timeLabel} · {b.kindLabel}</p>
                              <p className="text-[10px] text-slate-600">{b.teamLabel || 'Andere Mannschaft'}</p>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className={`text-[9px] font-semibold ${b.spatial.status === 'full' ? 'text-red-600' : b.spatial.status === 'partial' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {b.spatial.fractionLabel}
                                </span>
                                {!b.canEdit ? (
                                  <span className="flex items-center gap-0.5 text-[8px] text-slate-400">
                                    <Lock className="h-2.5 w-2.5" /> Nur ansehen
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
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
