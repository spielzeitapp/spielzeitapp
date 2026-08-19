/**
 * PLATZ-UX.1 – Tagesansicht: horizontale Zeitachse mit Platzzeilen pro Venue.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import type { VenueRow } from '../../lib/venues';
import type { VenueFieldRow, VenueFieldZoneRow } from '../../lib/venueFields';
import { zoneRowToGeometry } from '../../lib/venueFields';
import type { FieldConflictCandidate, ZoneMeta } from '../../lib/fieldScheduleConflicts';
import { intervalsOverlapHalfOpen } from '../../lib/fieldScheduleConflicts';
import { getDateTimePartsInTimeZone, VIENNA_TZ } from '../../lib/viennaTime';
import {
  computeFieldDaySlots,
  computeVenueDaySummary,
  computeBlockSpatialInfo,
  STATUS_LABELS,
  dayKeyToViennaMs,
  type SlotStatus,
  type TimeSlot,
  type BlockSpatialInfo,
  type ZoneSegment,
} from './availabilityHelpers';
import { FieldOccupancyMiniMap } from './FieldOccupancyMiniMap';

export type DayTimelineBlock = {
  id: string;
  fieldId: string;
  zoneId: string | null;
  startsAtMs: number;
  endsAtMs: number;
  label: string;
  teamLabel: string;
  kindLabel: string;
  timeLabel: string;
  zoneLabel: string;
  canEdit: boolean;
  isSharedForeign: boolean;
  /** PLATZ-UX.1A: spatial occupancy info computed from all concurrent candidates */
  spatial: BlockSpatialInfo;
};

type Props = {
  dayKey: string;
  venues: VenueRow[];
  fields: VenueFieldRow[];
  zonesByField: Record<string, VenueFieldZoneRow[]>;
  candidates: FieldConflictCandidate[];
  blocks: DayTimelineBlock[];
  canCreate: boolean;
  onSelectBlock: (block: DayTimelineBlock) => void;
  onCreateForSlot: (dayKey: string, hour: number, venueId: string, fieldId: string) => void;
  rangeStartHour?: number;
  rangeEndHour?: number;
};

const SLOT_STEP = 30;
const DEFAULT_START = 8;
const DEFAULT_END = 22;

function statusIcon(status: SlotStatus): React.ReactNode {
  if (status === 'free') return <CheckCircle className="h-3 w-3 text-emerald-600" aria-hidden />;
  if (status === 'partial') return <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden />;
  return <XCircle className="h-3 w-3 text-red-600" aria-hidden />;
}

function statusBg(status: SlotStatus): string {
  if (status === 'free') return 'bg-white hover:bg-slate-50';
  if (status === 'partial') return 'bg-amber-50/40';
  return 'bg-red-50/40';
}

function statusBorder(status: SlotStatus): string {
  if (status === 'free') return 'border-emerald-200';
  if (status === 'partial') return 'border-amber-200';
  return 'border-red-200';
}

function spatialBlockBorder(spatial: BlockSpatialInfo): string {
  if (spatial.geometryUnclear) return 'border-2 border-amber-400 border-dashed';
  if (spatial.status === 'full') return 'border border-red-300';
  if (spatial.status === 'partial') return 'border-2 border-amber-400';
  return 'border border-emerald-300';
}

function spatialBlockBg(spatial: BlockSpatialInfo): string {
  if (spatial.geometryUnclear) return 'bg-amber-50';
  if (spatial.status === 'full') return 'bg-red-100';
  if (spatial.status === 'partial') return 'bg-amber-50';
  return 'bg-emerald-50';
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

function NowLine({ rangeStartHour, rangeEndHour }: { rangeStartHour: number; rangeEndHour: number }): React.ReactElement | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const parts = getDateTimePartsInTimeZone(now, VIENNA_TZ);
  if (!parts) return null;
  const minuteOfDay = parts.hour * 60 + parts.minute;
  const startMin = rangeStartHour * 60;
  const endMin = rangeEndHour * 60;
  if (minuteOfDay < startMin || minuteOfDay > endMin) return null;
  const pct = ((minuteOfDay - startMin) / (endMin - startMin)) * 100;

  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-20"
      style={{ left: `${pct}%` }}
      aria-hidden
    >
      <div className="h-full w-px bg-red-600" />
      <span className="absolute -top-5 -translate-x-1/2 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
        Jetzt
      </span>
    </div>
  );
}

function TimeAxisHeader({ rangeStartHour, rangeEndHour }: { rangeStartHour: number; rangeEndHour: number }): React.ReactElement {
  const hours = [];
  for (let h = rangeStartHour; h <= rangeEndHour; h++) {
    hours.push(h);
  }
  const totalHours = rangeEndHour - rangeStartHour;

  return (
    <div className="relative flex border-b border-slate-200" style={{ height: 24 }}>
      {hours.map((h) => {
        const pct = ((h - rangeStartHour) / totalHours) * 100;
        return (
          <div
            key={h}
            className="absolute text-[10px] font-medium text-slate-400"
            style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
          >
            {String(h).padStart(2, '0')}:00
          </div>
        );
      })}
    </div>
  );
}

function FieldTimelineRow(props: {
  field: VenueFieldRow;
  slots: TimeSlot[];
  blocks: DayTimelineBlock[];
  rangeStartHour: number;
  rangeEndHour: number;
  dayKey: string;
  venueId: string;
  canCreate: boolean;
  onSelectBlock: (block: DayTimelineBlock) => void;
  onCreateForSlot: (dayKey: string, hour: number, venueId: string, fieldId: string) => void;
}): React.ReactElement {
  const totalMinutes = (props.rangeEndHour - props.rangeStartHour) * 60;
  const startMin = props.rangeStartHour * 60;

  const fieldBlocks = props.blocks.filter((b) => b.fieldId === props.field.id);

  return (
    <div className="group relative border-b border-slate-100 last:border-b-0" style={{ minHeight: 64 }}>
      {/* Slot backgrounds */}
      {props.slots.map((slot) => {
        const leftPct = ((slot.startHour * 60 + slot.startMinute - startMin) / totalMinutes) * 100;
        const widthPct = (SLOT_STEP / totalMinutes) * 100;
        const timeLabel = `${String(slot.startHour).padStart(2, '0')}:${String(slot.startMinute).padStart(2, '0')}`;
        const freeLabel = slot.freeZones.length > 0
          ? ` · ${slot.freeZones.map((z) => z.name).join(', ')} frei`
          : '';
        const ariaLabel = `${props.field.name} ${timeLabel}: ${STATUS_LABELS[slot.status]}${freeLabel}`;

        return (
          <button
            key={`${slot.startMs}`}
            type="button"
            className={`absolute top-0 bottom-0 border-r ${statusBorder(slot.status)} ${statusBg(slot.status)} transition-colors focus:z-10 focus:outline-none focus:ring-2 focus:ring-red-500/30`}
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            aria-label={ariaLabel}
            title={`${timeLabel} · ${STATUS_LABELS[slot.status]}${freeLabel}`}
            onClick={() => {
              if (slot.status === 'free' && props.canCreate) {
                props.onCreateForSlot(props.dayKey, slot.startHour, props.venueId, props.field.id);
              }
            }}
            tabIndex={slot.status === 'free' && props.canCreate ? 0 : -1}
          >
            {slot.status !== 'free' && slot.occupancies.length > 0 && slot.startMinute === 0 ? (
              <span className="flex items-center gap-0.5 px-0.5 text-[9px]">
                {statusIcon(slot.status)}
              </span>
            ) : null}
          </button>
        );
      })}

      {/* Occupancy blocks overlay — mini-pitch + spatial status */}
      {fieldBlocks.map((block) => {
        const blockStartMin = (() => {
          const p = getDateTimePartsInTimeZone(new Date(block.startsAtMs), VIENNA_TZ);
          return p ? p.hour * 60 + p.minute : 0;
        })();
        const blockEndMin = (() => {
          const p = getDateTimePartsInTimeZone(new Date(block.endsAtMs), VIENNA_TZ);
          return p ? p.hour * 60 + p.minute : 0;
        })();
        const clampedStart = Math.max(blockStartMin, startMin);
        const clampedEnd = Math.min(blockEndMin, props.rangeEndHour * 60);
        if (clampedEnd <= clampedStart) return null;
        const leftPct = ((clampedStart - startMin) / totalMinutes) * 100;
        const widthPct = ((clampedEnd - clampedStart) / totalMinutes) * 100;
        const isWide = widthPct > 8;

        const { spatial } = block;

        return (
          <button
            key={block.id}
            type="button"
            onClick={() => props.onSelectBlock(block)}
            className={`absolute top-1 bottom-1 z-10 flex items-center gap-1.5 overflow-hidden rounded-lg px-1.5 shadow-sm ${spatialBlockBorder(spatial)} ${spatialBlockBg(spatial)} ${block.isSharedForeign ? 'opacity-80' : ''}`}
            style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}
            title={`${block.timeLabel} · ${block.kindLabel} · ${block.teamLabel} · ${spatial.fractionLabel}${block.isSharedForeign ? ' · Fremd' : ''}${!block.canEdit ? ' · Nur ansehen' : ''}`}
            aria-label={spatial.accessibleLabel}
          >
            {/* Mini pitch */}
            {spatial.segments.length > 0 ? (
              <FieldOccupancyMiniMap
                segments={spatial.segments}
                className="h-[36px] w-[52px] shrink-0"
              />
            ) : spatial.geometryUnclear ? (
              <div className="h-[36px] w-[52px] shrink-0 rounded border border-dashed border-amber-400 bg-amber-100 flex items-center justify-center">
                <span className="text-[8px] text-amber-700">?</span>
              </div>
            ) : spatial.status === 'full' ? (
              <div className="h-[36px] w-[52px] shrink-0 rounded bg-red-300 border border-red-400" />
            ) : null}
            {/* Text */}
            {isWide ? (
              <div className="min-w-0 flex flex-col justify-center">
                <span className="truncate text-[10px] font-semibold text-slate-800 leading-tight">
                  {block.timeLabel} · {block.kindLabel}
                </span>
                <span className="truncate text-[9px] text-slate-600 leading-tight">
                  {block.teamLabel || 'Andere Mannschaft'}{block.isSharedForeign ? ' 🔒' : ''}
                </span>
                <span className="truncate text-[9px] text-slate-500 leading-tight">
                  {block.zoneLabel}
                </span>
                <span className={`truncate text-[9px] font-semibold leading-tight ${spatial.status === 'full' ? 'text-red-700' : spatial.status === 'partial' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {spatial.fractionLabel}
                </span>
              </div>
            ) : (
              <div className="min-w-0 flex flex-col justify-center">
                <span className="truncate text-[9px] font-semibold text-slate-800 leading-tight">
                  {block.teamLabel || 'Andere Mannschaft'}
                </span>
                <span className={`truncate text-[8px] font-semibold ${spatial.status === 'full' ? 'text-red-700' : spatial.status === 'partial' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {spatial.fractionLabel}
                </span>
              </div>
            )}
          </button>
        );
      })}

      <NowLine rangeStartHour={props.rangeStartHour} rangeEndHour={props.rangeEndHour} />
    </div>
  );
}

function VenueQuickInfo(props: {
  info: ReturnType<typeof computeVenueDaySummary>;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-3 px-1 py-1">
      {props.info.fields.map((f) => (
        <div key={f.fieldId} className="flex items-center gap-1.5 text-[11px] text-slate-600">
          {statusIcon(f.currentStatus)}
          <span className="font-medium text-slate-800">{f.fieldName}:</span>
          <span>
            {STATUS_LABELS[f.currentStatus]}
            {f.currentFreeZones.length > 0 ? ` · ${f.currentFreeZones.join(', ')} frei` : ''}
          </span>
          {f.nextOccupancyLabel ? (
            <span className="text-slate-400">· {f.nextOccupancyLabel}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PlatzDayTimelineView(props: Props): React.ReactElement {
  const rangeStart = props.rangeStartHour ?? DEFAULT_START;
  const rangeEnd = props.rangeEndHour ?? DEFAULT_END;

  const [collapsedVenues, setCollapsedVenues] = useState<Set<string>>(() => new Set());
  const toggleVenue = useCallback((id: string) => {
    setCollapsedVenues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

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

  const slotsByField = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    for (const g of venueGroups) {
      for (const f of g.fields) {
        const zones = buildZoneMetas(props.zonesByField[f.id] ?? []);
        map.set(f.id, computeFieldDaySlots({
          fieldId: f.id,
          dayKey: props.dayKey,
          candidates: props.candidates,
          zones,
          stepMinutes: SLOT_STEP,
          rangeStartHour: rangeStart,
          rangeEndHour: rangeEnd,
        }));
      }
    }
    return map;
  }, [venueGroups, props.dayKey, props.candidates, props.zonesByField, rangeStart, rangeEnd]);

  const quickInfos = useMemo(() => {
    return venueGroups.map((g) => {
      const zoneMetas: Record<string, ZoneMeta[]> = {};
      for (const f of g.fields) {
        zoneMetas[f.id] = buildZoneMetas(props.zonesByField[f.id] ?? []);
      }
      return computeVenueDaySummary({
        venueId: g.venue.id,
        venueName: g.venue.name,
        fields: g.fields,
        dayKey: props.dayKey,
        candidates: props.candidates,
        zones: zoneMetas,
      });
    });
  }, [venueGroups, props.dayKey, props.candidates, props.zonesByField]);

  if (venueGroups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-[14px] text-slate-500">
        Keine aktiven Sportanlagen mit Plätzen vorhanden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {venueGroups.map((g, gi) => {
        const collapsed = collapsedVenues.has(g.venue.id);
        const info = quickInfos[gi];

        return (
          <div key={g.venue.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Venue header — sticky on scroll */}
            <button
              type="button"
              onClick={() => toggleVenue(g.venue.id)}
              className="flex w-full items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-left sticky top-0 z-20"
              aria-expanded={!collapsed}
            >
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-slate-900 truncate">{g.venue.name}</h3>
                {info ? <VenueQuickInfo info={info} /> : null}
              </div>
              {collapsed
                ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                : <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />}
            </button>

            {!collapsed ? (
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Time axis */}
                  <div className="flex">
                    <div className="w-[160px] shrink-0 border-r border-slate-200" />
                    <div className="relative flex-1 px-1">
                      <TimeAxisHeader rangeStartHour={rangeStart} rangeEndHour={rangeEnd} />
                    </div>
                  </div>

                  {/* Field rows */}
                  {g.fields.map((f) => (
                    <div key={f.id} className="flex">
                      <div className="flex w-[160px] shrink-0 items-center border-r border-slate-200 px-3 py-2">
                        <p className="truncate text-[12px] font-medium text-slate-700">{f.name}</p>
                      </div>
                      <div className="relative flex-1">
                        <FieldTimelineRow
                          field={f}
                          slots={slotsByField.get(f.id) ?? []}
                          blocks={props.blocks}
                          rangeStartHour={rangeStart}
                          rangeEndHour={rangeEnd}
                          dayKey={props.dayKey}
                          venueId={g.venue.id}
                          canCreate={props.canCreate}
                          onSelectBlock={props.onSelectBlock}
                          onCreateForSlot={props.onCreateForSlot}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-600">
        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-600" /> Frei</span>
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-600" /> Teilbelegt</span>
        <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-600" /> Belegt</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-px bg-red-600" /> Jetzt</span>
      </div>
    </div>
  );
}
