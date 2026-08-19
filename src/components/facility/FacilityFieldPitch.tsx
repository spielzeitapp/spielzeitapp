import React, { useMemo, useState } from 'react';
import {
  SPLIT_DEMAND_SHORT,
  type FieldSplitDemand,
  type NormalizedRect,
  type ZoneGeometry,
  resolveZoneRect,
} from '../../lib/fieldZoneGeometry';

export type PitchOccupancy = {
  zoneId: string | null;
  zone: ZoneGeometry | null;
  teamLabel: string;
  timeLabel: string;
  kindLabel?: string;
  demandLabel?: string;
  /** eigene Mannschaft / bearbeitbar */
  own?: boolean;
  /** nur ansehen */
  readOnly?: boolean;
  conflict?: boolean;
};

type Props = {
  zones: readonly ZoneGeometry[];
  /** Welche Aufteilung zur Auswahl angeboten wird */
  demand?: FieldSplitDemand;
  selectedZoneId?: string | null;
  onSelectZone?: (zoneId: string | null) => void;
  occupancies?: readonly PitchOccupancy[];
  disabled?: boolean;
  className?: string;
  /** Kompakte Beschriftung auf kleinen Flächen */
  compact?: boolean;
};

function rectToSvg(r: NormalizedRect, pad = 8, W = 200, H = 300) {
  const iw = W - pad * 2;
  const ih = H - pad * 2;
  return {
    x: pad + r.x * iw,
    y: pad + r.y * ih,
    width: r.w * iw,
    height: r.h * ih,
  };
}

/**
 * Wartbares SVG-Spielfeld mit auswählbaren / belegten Flächen (PLATZ.4).
 */
export function FacilityFieldPitch(props: Props): React.ReactElement {
  const {
    zones,
    demand = 'entire',
    selectedZoneId = null,
    onSelectZone,
    occupancies = [],
    disabled = false,
    className = '',
    compact = false,
  } = props;

  const [detailId, setDetailId] = useState<string | null>(null);

  const selectable = useMemo(() => {
    if (demand === 'entire') {
      const entire = zones.find((z) => z.layoutKind === 'entire' || z.blocksEntireField);
      return entire ? [entire] : [];
    }
    return zones.filter((z) => z.layoutKind === demand && !z.blocksEntireField);
  }, [zones, demand]);

  const occByZone = useMemo(() => {
    const map = new Map<string, PitchOccupancy[]>();
    for (const o of occupancies) {
      const key = o.zoneId ?? '__entire__';
      const list = map.get(key) ?? [];
      list.push(o);
      map.set(key, list);
    }
    return map;
  }, [occupancies]);

  const W = 200;
  const H = 300;
  const pad = 10;

  return (
    <div className={`space-y-2 ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto block w-full max-w-[280px] touch-manipulation"
        role="img"
        aria-label="Spielfeldplan"
      >
        {/* Gras */}
        <rect x={0} y={0} width={W} height={H} rx={6} fill="#1f7a3a" />
        <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="#249245" stroke="#f8fafc" strokeWidth={2} />
        {/* Mittellinie / Kreis */}
        <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="#f8fafc" strokeWidth={1.5} opacity={0.9} />
        <circle cx={W / 2} cy={H / 2} r={28} fill="none" stroke="#f8fafc" strokeWidth={1.5} opacity={0.9} />
        <circle cx={W / 2} cy={H / 2} r={2.5} fill="#f8fafc" />
        {/* Strafräume */}
        <rect x={W / 2 - 40} y={pad} width={80} height={36} fill="none" stroke="#f8fafc" strokeWidth={1.25} opacity={0.85} />
        <rect x={W / 2 - 40} y={H - pad - 36} width={80} height={36} fill="none" stroke="#f8fafc" strokeWidth={1.25} opacity={0.85} />
        <rect x={W / 2 - 18} y={pad} width={36} height={14} fill="none" stroke="#f8fafc" strokeWidth={1.25} opacity={0.85} />
        <rect x={W / 2 - 18} y={H - pad - 14} width={36} height={14} fill="none" stroke="#f8fafc" strokeWidth={1.25} opacity={0.85} />

        {/* Belegungen (alle Zonen mit Occupancy) */}
        {occupancies.map((o, idx) => {
          const rect = resolveZoneRect(o.zone) ?? { x: 0, y: 0, w: 1, h: 1 };
          const box = rectToSvg(rect, pad, W, H);
          const own = o.own;
          const conflict = o.conflict;
          const fill = conflict ? 'rgba(185,28,28,0.72)' : own ? 'rgba(185,28,28,0.55)' : 'rgba(30,64,175,0.5)';
          const patternId = `hatch-${idx}`;
          const shortTeam = compact || box.width < 70 || box.height < 55
            ? (o.teamLabel.length > 8 ? `${o.teamLabel.slice(0, 7)}…` : o.teamLabel)
            : o.teamLabel;
          const showFull = box.width >= 70 && box.height >= 70 && !compact;
          return (
            <g key={`occ-${o.zoneId ?? 'e'}-${idx}`}>
              {!own && !conflict ? (
                <defs>
                  <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                    <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                  </pattern>
                </defs>
              ) : null}
              <rect
                x={box.x + 1}
                y={box.y + 1}
                width={Math.max(0, box.width - 2)}
                height={Math.max(0, box.height - 2)}
                fill={fill}
                stroke={conflict ? '#7f1d1d' : own ? '#991b1b' : '#1e3a8a'}
                strokeWidth={2}
                strokeDasharray={o.readOnly ? '4 3' : undefined}
                rx={3}
                className={onSelectZone && !disabled ? 'cursor-pointer' : undefined}
                onClick={() => {
                  setDetailId(o.zoneId ?? '__entire__');
                  if (!disabled && onSelectZone && o.zoneId) onSelectZone(o.zoneId);
                }}
              />
              {!own && !conflict ? (
                <rect
                  x={box.x + 1}
                  y={box.y + 1}
                  width={Math.max(0, box.width - 2)}
                  height={Math.max(0, box.height - 2)}
                  fill={`url(#${patternId})`}
                  pointerEvents="none"
                  rx={3}
                />
              ) : null}
              <text
                x={box.x + box.width / 2}
                y={box.y + box.height / 2 - (showFull ? 10 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={showFull ? 11 : 9}
                fontWeight={700}
                style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,.45)' }}
              >
                {shortTeam}
              </text>
              {showFull ? (
                <>
                  <text
                    x={box.x + box.width / 2}
                    y={box.y + box.height / 2 + 6}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={9}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {o.timeLabel}
                  </text>
                  <text
                    x={box.x + box.width / 2}
                    y={box.y + box.height / 2 + 18}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={8}
                    style={{ pointerEvents: 'none' }}
                  >
                    {[o.kindLabel, o.demandLabel].filter(Boolean).join(' · ')}
                  </text>
                </>
              ) : (
                <text
                  x={box.x + box.width / 2}
                  y={box.y + box.height / 2 + 11}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={8}
                  style={{ pointerEvents: 'none' }}
                >
                  {o.demandLabel ?? o.timeLabel}
                </text>
              )}
            </g>
          );
        })}

        {/* Auswahlflächen für aktuelle Demand */}
        {selectable.map((z) => {
          const rect = resolveZoneRect(z) ?? { x: 0, y: 0, w: 1, h: 1 };
          const box = rectToSvg(rect, pad, W, H);
          const selected = selectedZoneId === (z.id ?? null) || (demand === 'entire' && !selectedZoneId && z.blocksEntireField);
          const occupiedByOther = occByZone.has(z.id ?? '__entire__') || (z.blocksEntireField && occByZone.has('__entire__'));
          if (occupiedByOther && !selected) return null;

          const fillColor = selected
            ? 'rgba(220,38,38,0.65)' // Spielzeit-Red for selected
            : occupiedByOther
              ? 'rgba(100,100,100,0.5)'
              : 'rgba(34,197,94,0.55)'; // green for available
          const strokeColor = selected ? '#dc2626' : occupiedByOther ? '#6b7280' : '#16a34a';

          return (
            <g key={`sel-${z.zoneCode ?? z.id ?? z.name}`}>
              <rect
                x={box.x + 2}
                y={box.y + 2}
                width={Math.max(0, box.width - 4)}
                height={Math.max(0, box.height - 4)}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={selected ? 3 : 1.5}
                rx={3}
                className={!disabled && onSelectZone ? 'cursor-pointer' : undefined}
                tabIndex={!disabled && onSelectZone ? 0 : undefined}
                role="button"
                aria-label={`${z.name}${selected ? ' – Ausgewählt' : occupiedByOther ? ' – Belegt' : ' – Verfügbar'}`}
                aria-pressed={selected}
                onClick={() => {
                  if (disabled || !onSelectZone) return;
                  onSelectZone(z.id ?? null);
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !disabled && onSelectZone) {
                    e.preventDefault();
                    onSelectZone(z.id ?? null);
                  }
                }}
              />
              {/* Checkmark for selected */}
              {selected ? (
                <text
                  x={box.x + box.width / 2}
                  y={box.y + box.height / 2 - 6}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize={18}
                  fontWeight={700}
                  style={{ pointerEvents: 'none' }}
                >
                  ✓
                </text>
              ) : null}
              <text
                x={box.x + box.width / 2}
                y={box.y + box.height / 2 + (selected ? 10 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={10}
                fontWeight={600}
                style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,.5)' }}
              >
                {selected ? 'Ausgewählt' : z.name}
              </text>
              {!selected ? (
                <text
                  x={box.x + box.width / 2}
                  y={box.y + box.height / 2 + 14}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.8)"
                  fontSize={8}
                  style={{ pointerEvents: 'none' }}
                >
                  {z.name}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {detailId ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
          {(occByZone.get(detailId) ?? []).map((o, i) => (
            <p key={i}>
              <span className="font-semibold">{o.teamLabel}</span>
              {' · '}
              {o.timeLabel}
              {o.kindLabel ? ` · ${o.kindLabel}` : ''}
              {o.demandLabel ? ` · ${o.demandLabel}` : ''}
              {o.readOnly ? ' · Nur ansehen' : ''}
            </p>
          ))}
          <button
            type="button"
            className="mt-1 text-[11px] font-semibold text-slate-500 hover:underline"
            onClick={() => setDetailId(null)}
          >
            Schließen
          </button>
        </div>
      ) : null}

      {demand !== 'entire' && selectedZoneId ? (
        <p className="text-center text-sm font-semibold text-red-700">
          {selectable.find((z) => z.id === selectedZoneId)?.name ?? selectedZoneId} wird belegt
        </p>
      ) : demand !== 'entire' ? (
        <p className="text-center text-[11px] text-slate-500">
          Platzbedarf {SPLIT_DEMAND_SHORT[demand]} — Bereich auf dem Spielfeld tippen
        </p>
      ) : null}
    </div>
  );
}
