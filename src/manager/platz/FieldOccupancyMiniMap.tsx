/**
 * PLATZ-UX.1B – Mini-Spielfeld SVG für Teilflächendarstellung im Kalender.
 * Zeigt belegte Zonen rot, freie Zonen grün, mit weißen Spielfeldlinien.
 */
import React from 'react';
import type { ZoneSegment } from './availabilityHelpers';

type Props = {
  segments: ZoneSegment[];
  className?: string;
  /** Show zone names inside segments when there's enough space */
  showLabels?: boolean;
};

const OCCUPIED_FILL = '#fca5a5'; // red-300
const FREE_FILL = '#6ee7b7'; // emerald-300
const LINE_COLOR = 'rgba(255,255,255,0.7)';
const FIELD_BG = '#4ade80'; // emerald-400 for empty/free base

export function FieldOccupancyMiniMap({ segments, className = '', showLabels = false }: Props): React.ReactElement {
  // If no segments with rects, show a simple proportional bar
  const hasRects = segments.some((s) => s.rect != null);

  if (!hasRects && segments.length > 0) {
    // Proportional vertical strips fallback
    const h = segments.length;
    return (
      <svg
        viewBox="0 0 100 60"
        className={`rounded ${className}`}
        role="img"
        aria-hidden
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width="100" height="60" fill={FIELD_BG} rx="3" />
        {segments.map((seg, i) => (
          <rect
            key={seg.zoneId}
            x="2"
            y={2 + (56 / h) * i}
            width="96"
            height={56 / h - 1}
            fill={seg.occupied ? OCCUPIED_FILL : FREE_FILL}
            rx="1"
          />
        ))}
        {/* Field lines */}
        <line x1="50" y1="2" x2="50" y2="58" stroke={LINE_COLOR} strokeWidth="0.8" />
        <circle cx="50" cy="30" r="8" fill="none" stroke={LINE_COLOR} strokeWidth="0.6" />
        <rect x="2" y="2" width="96" height="56" fill="none" stroke={LINE_COLOR} strokeWidth="1" rx="2" />
      </svg>
    );
  }

  if (!hasRects) {
    // No segments at all — empty field
    return (
      <svg viewBox="0 0 100 60" className={`rounded ${className}`} role="img" aria-hidden preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="60" fill={FIELD_BG} rx="3" />
        <line x1="50" y1="2" x2="50" y2="58" stroke={LINE_COLOR} strokeWidth="0.8" />
        <circle cx="50" cy="30" r="8" fill="none" stroke={LINE_COLOR} strokeWidth="0.6" />
        <rect x="2" y="2" width="96" height="56" fill="none" stroke={LINE_COLOR} strokeWidth="1" rx="2" />
      </svg>
    );
  }

  // Render actual geometry rects (unit square mapped to 100x60 with 2px padding)
  const padX = 2, padY = 2, fieldW = 96, fieldH = 56;

  return (
    <svg viewBox="0 0 100 60" className={`rounded ${className}`} role="img" aria-hidden preserveAspectRatio="none">
      <rect x="0" y="0" width="100" height="60" fill="#334155" rx="3" />
      {segments.map((seg) => {
        if (!seg.rect) return null;
        const rx = padX + seg.rect.x * fieldW;
        const ry = padY + seg.rect.y * fieldH;
        const rw = seg.rect.w * fieldW;
        const rh = seg.rect.h * fieldH;
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
      {/* Field markings */}
      <line x1="50" y1={padY} x2="50" y2={padY + fieldH} stroke={LINE_COLOR} strokeWidth="0.8" />
      <circle cx="50" cy="30" r="8" fill="none" stroke={LINE_COLOR} strokeWidth="0.6" />
      <rect x={padX} y={padY} width={fieldW} height={fieldH} fill="none" stroke={LINE_COLOR} strokeWidth="1" rx="2" />
      {/* Labels */}
      {showLabels && segments.map((seg) => {
        if (!seg.rect) return null;
        const cx = padX + (seg.rect.x + seg.rect.w / 2) * fieldW;
        const cy = padY + (seg.rect.y + seg.rect.h / 2) * fieldH;
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
