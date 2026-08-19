/**
 * PLATZ-UX.1E – Monatsansicht: Auslastungsüberblick mit Mini-Spielfeld und Tageszusammenfassung.
 */
import React, { useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Lock, ChevronRight } from 'lucide-react';
import type { VenueFieldRow, VenueFieldZoneRow } from '../../lib/venueFields';
import { zoneRowToGeometry } from '../../lib/venueFields';
import type { FieldConflictCandidate, ZoneMeta } from '../../lib/fieldScheduleConflicts';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from '../../lib/viennaTime';
import { computeFieldMonthSummary, STATUS_LABELS, type SlotStatus } from './availabilityHelpers';
import { FieldOccupancyMiniMap } from './FieldOccupancyMiniMap';
import type { DayTimelineBlock } from './PlatzDayTimelineView';

type Props = {
  monthAnchor: Date;
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  candidates: FieldConflictCandidate[];
  blocks: DayTimelineBlock[];
  todayKey: string;
  onSwitchToDay: (dayKey: string) => void;
  onSelectBlock: (block: DayTimelineBlock) => void;
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

function statusBg(status: SlotStatus): string {
  if (status === 'free') return '';
  if (status === 'partial') return 'bg-amber-50/60';
  return 'bg-red-50/60';
}

function statusDot(status: SlotStatus): string {
  if (status === 'free') return 'bg-emerald-400';
  if (status === 'partial') return 'bg-amber-400';
  return 'bg-red-500';
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

function blockDayKey(b: DayTimelineBlock): string {
  const p = getDateTimePartsInTimeZone(new Date(b.startsAtMs), VIENNA_TZ);
  if (!p) return '';
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function PlatzMonthOverview(props: Props): React.ReactElement {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const dayKeys = useMemo(() => getDaysInMonth(props.monthAnchor), [props.monthAnchor]);
  const leadingBlanks = useMemo(() => (dayKeys[0] ? firstDayOfWeek(dayKeys[0]) : 0), [dayKeys]);

  const fieldsArr = props.fields ?? [];
  const blocksArr = props.blocks ?? [];
  const candidates = props.candidates ?? [];

  const activeFields = useMemo(
    () => fieldsArr.filter((f) => f.is_active),
    [fieldsArr],
  );

  const blocksByDay = useMemo(() => {
    const map = new Map<string, DayTimelineBlock[]>();
    for (const b of blocksArr) {
      const dk = blockDayKey(b);
      if (!dk) continue;
      const list = map.get(dk) ?? [];
      list.push(b);
      map.set(dk, list);
    }
    return map;
  }, [blocksArr]);

  const daySummaries = useMemo(() => {
    const merged = new Map<string, { count: number; peak: SlotStatus }>();
    for (const dk of dayKeys) merged.set(dk, { count: 0, peak: 'free' });

    for (const f of activeFields) {
      const zoneMetas = buildZoneMetas(props.zonesByField[f.id] ?? []);
      const summaries = computeFieldMonthSummary({
        fieldId: f.id,
        dayKeys,
        candidates,
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
  }, [dayKeys, activeFields, candidates, props.zonesByField]);

  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const selectedDayBlocks = selectedDay ? (blocksByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Calendar grid */}
      <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-[12px] text-slate-500">Klicke auf einen Tag für Details</p>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdays.map((wd) => (
              <div key={wd} className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 py-1">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {dayKeys.map((dk) => {
              const day = Number(dk.split('-')[2]);
              const isToday = dk === props.todayKey;
              const isSelected = dk === selectedDay;
              const summary = daySummaries.get(dk);
              const peak = summary?.peak ?? 'free';
              const count = summary?.count ?? 0;
              const dayBlks = blocksByDay.get(dk) ?? [];
              const topBlock = dayBlks[0];
              const hasForeign = dayBlks.some((b) => !b.canEdit);

              return (
                <button
                  key={dk}
                  type="button"
                  onClick={() => setSelectedDay(dk)}
                  className={[
                    'flex flex-col items-center rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-slate-100 min-h-[70px]',
                    statusBg(peak),
                    isToday ? 'ring-2 ring-red-500/40' : '',
                    isSelected ? 'ring-2 ring-red-700' : '',
                  ].join(' ')}
                  aria-label={`${dk}: ${STATUS_LABELS[peak]}, ${count} Belegung${count !== 1 ? 'en' : ''}`}
                >
                  <span className={`text-[13px] font-semibold ${isToday ? 'text-red-700' : 'text-slate-800'}`}>
                    {day}
                  </span>
                  {count > 0 ? (
                    <>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <span className={`h-2 w-2 rounded-full ${statusDot(peak)}`} />
                        <span className="text-[9px] text-slate-500">{count}</span>
                        {hasForeign ? <Lock className="h-2 w-2 text-slate-400" /> : null}
                      </div>
                      {topBlock && topBlock.spatial.segments.length > 0 ? (
                        <FieldOccupancyMiniMap
                          segments={topBlock.spatial.segments}
                          className="h-[16px] w-[24px] mt-0.5"
                        />
                      ) : topBlock && topBlock.spatial.status === 'full' ? (
                        <div className="h-[16px] w-[24px] mt-0.5 rounded bg-red-300 border border-red-400" />
                      ) : null}
                    </>
                  ) : (
                    <span className={`h-1.5 w-1.5 rounded-full mt-1 ${statusDot('free')}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Frei</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Teilweise</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Stark</span>
        </div>
      </div>

      {/* Day summary panel */}
      {selectedDay ? (
        <div className="w-full lg:w-[320px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-slate-900">
              {new Intl.DateTimeFormat('de-AT', { timeZone: VIENNA_TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(selectedDay + 'T12:00:00'))}
            </h3>
            <button
              type="button"
              onClick={() => props.onSwitchToDay(selectedDay)}
              className="flex items-center gap-0.5 text-[11px] font-semibold text-red-700 hover:underline"
            >
              In Tagesansicht öffnen <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {selectedDayBlocks.length === 0 ? (
              <p className="text-[12px] text-slate-400 text-center py-4">Keine Belegungen</p>
            ) : (
              selectedDayBlocks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => props.onSelectBlock(b)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-2">
                    {b.spatial.segments.length > 0 ? (
                      <FieldOccupancyMiniMap
                        segments={b.spatial.segments}
                        className="h-[32px] w-[48px] shrink-0"
                      />
                    ) : b.spatial.status === 'full' ? (
                      <div className="h-[32px] w-[48px] shrink-0 rounded bg-red-300 border border-red-400" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-800">{b.timeLabel}</p>
                      <p className="text-[10px] text-slate-600">{b.teamLabel || 'Andere Mannschaft'} · {b.kindLabel}</p>
                      <p className="text-[10px] text-slate-500">{b.zoneLabel}</p>
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
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
