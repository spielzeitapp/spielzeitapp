/**
 * PLATZ-UX.1 – Detail-Seitenleiste / Bottom Sheet für Belegungsdetails.
 */
import React from 'react';
import { X, ExternalLink, Edit3, Eye } from 'lucide-react';
import { STATUS_LABELS, type SlotStatus, type ZoneSegment } from './availabilityHelpers';
import { FieldOccupancyMiniMap } from './FieldOccupancyMiniMap';
import type { DayTimelineBlock } from './PlatzDayTimelineView';

type Props = {
  block: DayTimelineBlock;
  venueName: string;
  fieldName: string;
  dayLabel: string;
  fieldStatus: SlotStatus;
  freeZoneNames: string[];
  onClose: () => void;
  onOpenAssign: () => void;
  onOpenEvent?: () => void;
};

function statusChip(status: SlotStatus): string {
  if (status === 'free') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'partial') return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-red-50 text-red-800 border-red-200';
}

export function OccupancyDetailPanel(props: Props): React.ReactElement {
  const { block } = props;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className="fixed inset-0 z-40 bg-black/20 lg:hidden"
        onClick={props.onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white shadow-xl lg:inset-y-0 lg:left-auto lg:right-0 lg:bottom-auto lg:w-[380px] lg:rounded-t-none lg:rounded-l-2xl lg:border-l lg:border-t-0">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Belegungsdetails</h2>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Kind badge */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              {block.kindLabel}
            </span>
            {block.isSharedForeign ? (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                Fremd
              </span>
            ) : null}
            {!block.canEdit ? (
              <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                <Eye className="h-3 w-3" /> Nur ansehen
              </span>
            ) : null}
          </div>

          {/* Main info */}
          <div className="space-y-2 text-[13px]">
            <Row label="Mannschaft" value={block.teamLabel || 'Andere Mannschaft'} />
            <Row label="Datum" value={props.dayLabel} />
            <Row label="Zeitraum" value={block.timeLabel} />
            <Row label="Sportanlage" value={props.venueName} />
            <Row label="Platz" value={props.fieldName} />
            <Row label="Teilfläche" value={block.zoneLabel} />
          </div>

          {/* Mini pitch visualization */}
          {block.spatial.segments.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <FieldOccupancyMiniMap
                segments={block.spatial.segments}
                className="h-[80px] w-full"
                showLabels
              />
              <p className="mt-1.5 text-center text-[12px] font-semibold text-slate-700">
                {block.spatial.fractionLabel}
              </p>
            </div>
          ) : null}

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusChip(props.fieldStatus)}`}>
              {STATUS_LABELS[props.fieldStatus]}
            </span>
            {props.freeZoneNames.length > 0 ? (
              <span className="text-[11px] text-emerald-700">
                {props.freeZoneNames.join(', ')} frei
              </span>
            ) : null}
          </div>

          {/* Actions */}
          {block.canEdit ? (
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={props.onOpenAssign}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800"
              >
                <Edit3 className="h-4 w-4" />
                Belegung bearbeiten
              </button>
              {props.onOpenEvent ? (
                <button
                  type="button"
                  onClick={props.onOpenEvent}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Termin öffnen
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
