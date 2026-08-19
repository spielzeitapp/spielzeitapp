/**
 * PLATZ-UX.1B/1C – Mini-Spielfeld SVG für Teilflächendarstellung.
 * Zeigt belegte Zonen rot, freie Zonen grün, mit weißen Spielfeldlinien.
 * Unterstützt Portrait (Formular) und Landscape (Kalender/Detailpanel).
 */
import React from 'react';
import type { NormalizedRect } from '../../lib/fieldZoneGeometry';
import type { ZoneSegment } from './availabilityHelpers';

export type FieldOrientation = 'portrait' | 'landscape';

/**
 * Transform a portrait-stored NormalizedRect to landscape display.
 * Portrait: y=0 is top (Hälfte A), y=0.5 is bottom (Hälfte B).
 * Landscape: Hälfte A becomes left, Hälfte B becomes right.
 * Pure axis swap: {x, y, w, h} → {x: y, y: x, w: h, h: w}
 */
export function transformRectForDisplay(rect: NormalizedRect, orientation: FieldOrientation): NormalizedRect {
  if (orientation === 'portrait') return rect;
  return { x: rect.y, y: rect.x, w: rect.h, h: rect.w };
}

type Props = {
  segments: ZoneSegment[];
  className?: string;
  /** Show zone names inside segments when there's enough space */
  showLabels?: boolean;
  /** Display orientation — landscape for calendar, portrait for picker */
  orientation?: FieldOrientation;
};

const OCCUPIED_FILL = '#fca5a5'; // red-300
const FREE_FILL = '#6ee7b7'; // emerald-300
const LINE_COLOR = 'rgba(255,255,255,0.7)';
const FIELD_BG = '#4ade80'; // emerald-400 for empty/free base

export function FieldOccupancyMiniMap({ segments, className = '', showLabels = false, orientation = 'landscape' }: Props): React.ReactElement {
  const hasRects = segments.some((s) => s.rect != null);
  const isLandscape = orientation === 'landscape';
  const vbW = isLandscape ? 100 : 60;
  const vbH = isLandscape ? 60 : 100;

  if (!hasRects && segments.length > 0) {
    const n = segments.length;
    return (
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className={`rounded ${className}`}
        role="img"
        aria-hidden
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width={vbW} height={vbH} fill={FIELD_BG} rx="3" />
        {segments.map((seg, i) => {
          if (isLandscape) {
            const sw = (vbW - 4) / n;
            return <rect key={seg.zoneId} x={2 + sw * i} y="2" width={sw - 1} height={vbH - 4} fill={seg.occupied ? OCCUPIED_FILL : FREE_FILL} rx="1" />;
          }
          const sh = (vbH - 4) / n;
          return <rect key={seg.zoneId} x="2" y={2 + sh * i} width={vbW - 4} height={sh - 1} fill={seg.occupied ? OCCUPIED_FILL : FREE_FILL} rx="1" />;
        })}
        {renderFieldLines(vbW, vbH)}
      </svg>
    );
  }

  if (!hasRects) {
    return (
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className={`rounded ${className}`} role="img" aria-hidden preserveAspectRatio="none">
        <rect x="0" y="0" width={vbW} height={vbH} fill={FIELD_BG} rx="3" />
        {renderFieldLines(vbW, vbH)}
      </svg>
    );
  }

  const padX = 2, padY = 2, fieldW = vbW - 4, fieldH = vbH - 4;

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className={`rounded ${className}`} role="img" aria-hidden preserveAspectRatio="none">
      <rect x="0" y="0" width={vbW} height={vbH} fill="#334155" rx="3" />
      {segments.map((seg) => {
        if (!seg.rect) return null;
        const dr = transformRectForDisplay(seg.rect, orientation);
        const rx = padX + dr.x * fieldW;
        const ry = padY + dr.y * fieldH;
        const rw = dr.w * fieldW;
        const rh = dr.h * fieldH;
        return (
          <rect
            key={seg.zoneId}
            x={rx}
            y={ry}
            width={rw - 0.5}
            height={rh - 0.5}
            fill={seg.occupied ? OCCUPIED_FILL : FREE_FILL}
            rx="1"
          />
        );
      })}
      {renderFieldLines(vbW, vbH)}
      {showLabels && segments.map((seg) => {
        if (!seg.rect) return null;
        const dr = transformRectForDisplay(seg.rect, orientation);
        const cx = padX + (dr.x + dr.w / 2) * fieldW;
        const cy = padY + (dr.y + dr.h / 2) * fieldH;
        return (
          <text
            key={`label-${seg.zoneId}`}
            x={cx}
            y={cy + 3}
            textAnchor="middle"
            className="text-[6px] font-semibold"
            fill="white"
          >
            {seg.zoneName}
          </text>
        );
      })}
    </svg>
  );
}

function renderFieldLines(w: number, h: number) {
  const midX = w / 2, midY = h / 2;
  const r = Math.min(w, h) * 0.13;
  return (
    <>
      <line x1={midX} y1="2" x2={midX} y2={h - 2} stroke={LINE_COLOR} strokeWidth="0.8" />
      <circle cx={midX} cy={midY} r={r} fill="none" stroke={LINE_COLOR} strokeWidth="0.6" />
      <rect x="2" y="2" width={w - 4} height={h - 4} fill="none" stroke={LINE_COLOR} strokeWidth="1" rx="2" />
    </>
  );
}
