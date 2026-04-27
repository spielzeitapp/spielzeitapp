import React from 'react';
import type { FieldSlotId } from '../../types/match';
import type { U11FormationId } from '../../lib/matchFormations';
import { U11_FORMATIONS } from '../../lib/matchFormations';

const PITCH_SURFACE: React.CSSProperties = {
  backgroundImage: [
    'repeating-linear-gradient(180deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 24px, transparent 24px, transparent 48px)',
    'linear-gradient(to bottom, #2f8f38, #1e6b26, #174f1c)',
  ].join(', '),
};

/**
 * ViewBox: Länge (tor-tor) vertikal ≈ 1,54× Feldbreite (FIFA-Näherung).
 * Rand damit stroke 2 nirgends abgeschnitten wird.
 */
const VB_MARGIN = 5;
const VB_W = 364;
const VB_H = 562;
const VB_MIN = -VB_MARGIN;
const VB_OUT_W = VB_W + 2 * VB_MARGIN;
const VB_OUT_H = VB_H + 2 * VB_MARGIN;

const LINE_INSET = 8;
const CX = VB_W / 2;
const CY = VB_H / 2;
const INNER_L = LINE_INSET;
const INNER_R = VB_W - LINE_INSET;
const INNER_T = LINE_INSET;
const INNER_B = VB_H - LINE_INSET;
const INNER_W = VB_W - 2 * LINE_INSET;
const INNER_H = INNER_B - INNER_T;

/**
 * Maßstäbe: Länge tor-tor vertikal ≈ 105 m, Breite ≈ 68 m.
 * Strafraum: 40,32 m breit (quer), 16,5 m tief (längs) — wirkt „profi-breit“ vs. schmale Box.
 */
const PEN_W = Math.round((INNER_W * 40.32) / 68);
const PEN_H = Math.round((INNER_H * 16.5) / 105);
const PEN_X = (VB_W - PEN_W) / 2;
const TOP_PEN_BOTTOM = INNER_T + PEN_H;
const BOTTOM_PEN_Y = INNER_B - PEN_H;

/** Torraum */
const GA_W = Math.round((PEN_W * 18.32) / 40.32);
const GA_H = Math.round((PEN_H * 5.5) / 16.5);
const GA_X = (VB_W - GA_W) / 2;

/** Elfmeterpunkt: 11 m von der Torlinie */
const SPOT_OFFSET = (PEN_H * 11) / 16.5;
const TOP_SPOT_Y = INNER_T + SPOT_OFFSET;
const BOTTOM_SPOT_Y = INNER_B - SPOT_OFFSET;

/** Strafraumbogen außerhalb: r = 9,15 m (längs-Maßstab) */
const PEN_ARC_R = (9.15 / 105) * INNER_H;
const MID_CIRCLE_R = (9.15 / 105) * INNER_H;

function penaltyDOutsideTop(cx: number, spotY: number, lineY: number, r: number): string | null {
  const dy = lineY - spotY;
  if (dy <= 0 || r <= dy) return null;
  const dx = Math.sqrt(r * r - dy * dy);
  const x1 = cx - dx;
  const x2 = cx + dx;
  return `M ${x1} ${lineY} A ${r} ${r} 0 0 1 ${x2} ${lineY}`;
}

function penaltyDOutsideBottom(cx: number, spotY: number, lineY: number, r: number): string | null {
  const dy = spotY - lineY;
  if (dy <= 0 || r <= dy) return null;
  const dx = Math.sqrt(r * r - dy * dy);
  const x1 = cx - dx;
  const x2 = cx + dx;
  return `M ${x1} ${lineY} A ${r} ${r} 0 0 0 ${x2} ${lineY}`;
}

const LINE_STROKE = '#ffffff';
const LINE_OPACITY = 0.6;
const STROKE_W = 2;
const CORNER_ARC = Math.min(14, Math.round(INNER_W * 0.04));
const TOUCHLINE_RX = 6;

const GOAL_W = Math.round((INNER_W * 7.32) / 68);
const GOAL_H = 5;
const GOAL_X = (VB_W - GOAL_W) / 2;

const TOP_SIX_Y = INNER_T + GA_H;
const BOTTOM_SIX_Y = INNER_B - GA_H;

export type LineupFormationPitchProps = {
  formationId: U11FormationId;
  slots: Record<FieldSlotId, string | null>;
  interactive?: boolean;
  onSlotTap?: (slot: FieldSlotId) => void;
  selectedBankPlayerId?: string | null;
  assignFlashSlot?: FieldSlotId | null;
  emphasizedPlayerId?: string | null;
  renderSlotContent: (ctx: {
    slot: FieldSlotId;
    label: string;
    playerId: string | null;
    empty: boolean;
    dropHint: boolean;
    flash: boolean;
    isGk: boolean;
    emphasize: boolean;
  }) => React.ReactNode;
  className?: string;
};

export function LineupFormationPitch({
  formationId,
  slots,
  interactive = false,
  onSlotTap,
  selectedBankPlayerId,
  assignFlashSlot,
  emphasizedPlayerId = null,
  renderSlotContent,
  className = '',
}: LineupFormationPitchProps): React.ReactElement {
  const layout = U11_FORMATIONS[formationId];

  const gLine = {
    fill: 'none' as const,
    stroke: LINE_STROKE,
    strokeWidth: STROKE_W,
    strokeOpacity: LINE_OPACITY,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const dTop = penaltyDOutsideTop(CX, TOP_SPOT_Y, TOP_PEN_BOTTOM, PEN_ARC_R);
  const dBottom = penaltyDOutsideBottom(CX, BOTTOM_SPOT_Y, BOTTOM_PEN_Y, PEN_ARC_R);

  return (
    <div
      className={`relative h-full min-h-0 w-full overflow-hidden rounded-2xl border border-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_12px_40px_rgba(0,0,0,0.55)] ${className}`}
      style={PITCH_SURFACE}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_70px_rgba(0,0,0,0.18),inset_0_-16px_32px_rgba(0,0,0,0.12)]"
        aria-hidden
      />

      <svg
        className="pointer-events-none absolute inset-0 z-[0] h-full w-full"
        viewBox={`${VB_MIN} ${VB_MIN} ${VB_OUT_W} ${VB_OUT_H}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <g {...gLine}>
          <rect
            x={INNER_L}
            y={INNER_T}
            width={INNER_W}
            height={INNER_B - INNER_T}
            rx={TOUCHLINE_RX}
            ry={TOUCHLINE_RX}
          />

          <path d={`M ${INNER_L} ${INNER_T + CORNER_ARC} A ${CORNER_ARC} ${CORNER_ARC} 0 0 1 ${INNER_L + CORNER_ARC} ${INNER_T}`} />
          <path d={`M ${INNER_R - CORNER_ARC} ${INNER_T} A ${CORNER_ARC} ${CORNER_ARC} 0 0 1 ${INNER_R} ${INNER_T + CORNER_ARC}`} />
          <path d={`M ${INNER_R} ${INNER_B - CORNER_ARC} A ${CORNER_ARC} ${CORNER_ARC} 0 0 1 ${INNER_R - CORNER_ARC} ${INNER_B}`} />
          <path d={`M ${INNER_L + CORNER_ARC} ${INNER_B} A ${CORNER_ARC} ${CORNER_ARC} 0 0 1 ${INNER_L} ${INNER_B - CORNER_ARC}`} />

          <line x1={INNER_L} y1={CY} x2={INNER_R} y2={CY} />

          <circle cx={CX} cy={CY} r={MID_CIRCLE_R} />
          <circle cx={CX} cy={CY} r="3.5" fill={LINE_STROKE} fillOpacity={LINE_OPACITY} stroke="none" />

          <rect x={PEN_X} y={INNER_T} width={PEN_W} height={PEN_H} />
          <rect x={PEN_X} y={BOTTOM_PEN_Y} width={PEN_W} height={PEN_H} />

          <rect x={GA_X} y={INNER_T} width={GA_W} height={GA_H} />
          <rect x={GA_X} y={INNER_B - GA_H} width={GA_W} height={GA_H} />

          {dTop ? <path d={dTop} /> : null}
          {dBottom ? <path d={dBottom} /> : null}

          <line x1={PEN_X} y1={TOP_SIX_Y} x2={PEN_X + PEN_W} y2={TOP_SIX_Y} />
          <line x1={PEN_X} y1={BOTTOM_SIX_Y} x2={PEN_X + PEN_W} y2={BOTTOM_SIX_Y} />

          <circle cx={CX} cy={TOP_SPOT_Y} r="2.5" fill={LINE_STROKE} fillOpacity={LINE_OPACITY} stroke="none" />
          <circle cx={CX} cy={BOTTOM_SPOT_Y} r="2.5" fill={LINE_STROKE} fillOpacity={LINE_OPACITY} stroke="none" />

          <rect x={GOAL_X} y={INNER_T - GOAL_H} width={GOAL_W} height={GOAL_H} rx="1" />
          <rect x={GOAL_X} y={INNER_B} width={GOAL_W} height={GOAL_H} rx="1" />
        </g>
      </svg>

      <div className="absolute inset-[3.25%] z-[1] min-h-0">
        {layout.map(({ slot, label, x, y }) => {
          const playerId = slots[slot] ?? null;
          const empty = !playerId;
          const dropHint = empty && Boolean(selectedBankPlayerId) && interactive;
          const flash = assignFlashSlot === slot;
          const isGk = slot === 'GK';
          const emphasize = Boolean(playerId && emphasizedPlayerId && playerId === emphasizedPlayerId);

          const inner = renderSlotContent({
            slot,
            label,
            playerId,
            empty,
            dropHint,
            flash,
            isGk,
            emphasize,
          });

          const slotStyle = { left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' } as const;

          if (!interactive || !onSlotTap) {
            return (
              <div
                key={slot}
                className="pointer-events-none absolute flex flex-col items-center justify-center"
                style={slotStyle}
              >
                {inner}
              </div>
            );
          }

          return (
            <button
              key={slot}
              type="button"
              onClick={() => onSlotTap(slot)}
              title={label}
              className={[
                'absolute flex flex-col items-center justify-center rounded-full border border-transparent bg-transparent px-0.5 py-0 transition-all duration-300 ease-out active:scale-[0.98]',
                empty ? 'min-h-[48px] min-w-[48px]' : 'min-h-0 min-w-0',
                dropHint ? 'ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-transparent' : '',
                flash ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-emerald-900/40' : '',
              ].join(' ')}
              style={slotStyle}
            >
              <span className="sr-only">
                {label}
                {empty ? ', frei antippen zum Zuweisen' : ''}
              </span>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}
