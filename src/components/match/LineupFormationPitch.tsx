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

const VB_MARGIN = 8;
const VB_W = 360;
const VB_H = 410;
const VB_MIN = -VB_MARGIN;
const VB_OUT_W = VB_W + 2 * VB_MARGIN;
const VB_OUT_H = VB_H + 2 * VB_MARGIN;

const LINE_INSET = 16;
const CX = VB_W / 2;
const CY = 211;
const INNER_L = LINE_INSET;
const INNER_R = VB_W - LINE_INSET;
const INNER_T = LINE_INSET;
const INNER_B = VB_H - LINE_INSET;
const INNER_W = INNER_R - INNER_L;
const INNER_H = INNER_B - INNER_T;

const PEN_X = 82;
const PEN_W = 196;
const PEN_H = 58;
const TOP_PEN_BOTTOM = 74;
const BOTTOM_PEN_Y = INNER_B - PEN_H;

const GA_X = 130;
const GA_W = 100;
const GA_H = 28;
const TOP_GA_Y = 16;
const BOTTOM_GA_Y = INNER_B - GA_H;

const TOP_SPOT_Y = 49;
const BOTTOM_SPOT_Y = INNER_B - (TOP_SPOT_Y - INNER_T);

const LINE_STROKE = '#ffffff';
const LINE_OPACITY = 0.66;
const STROKE_W = 2.1;
const TOUCHLINE_RX = 2;

const GOAL_W = Math.round(INNER_W * (7.32 / 68));
const GOAL_H = 6;
const GOAL_X = (VB_W - GOAL_W) / 2;
const MID_CIRCLE_R = 43;

function penaltyArcTopPath(): string {
  return 'M 150 74 A 30 30 0 0 0 210 74';
}

function penaltyArcBottomPath(): string {
  return `M 150 ${BOTTOM_PEN_Y} A 30 30 0 0 1 210 ${BOTTOM_PEN_Y}`;
}

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

  /** Fixe Reihen für klares 7er-Layout (ohne DB/Logik-Änderung). */
  const ROWS = {
    ST: 0.22,
    MID: 0.48,
    DEF: 0.7,
    GK: 0.88,
  } as const;

  const COLS = {
    left: 0.2,
    center: 0.5,
    right: 0.8,
    defLeft: 0.33,
    defRight: 0.67,
  } as const;

  const fixedXYForSlot = (slot: FieldSlotId): { xPct: number; yPct: number } | null => {
    switch (slot) {
      case 'ST':
        return { xPct: COLS.center * 100, yPct: ROWS.ST * 100 };
      case 'LW':
        return { xPct: COLS.left * 100, yPct: ROWS.MID * 100 };
      case 'CM':
        return { xPct: COLS.center * 100, yPct: ROWS.MID * 100 };
      case 'RW':
        return { xPct: COLS.right * 100, yPct: ROWS.MID * 100 };
      case 'LB':
        return { xPct: COLS.defLeft * 100, yPct: ROWS.DEF * 100 };
      case 'RB':
        return { xPct: COLS.defRight * 100, yPct: ROWS.DEF * 100 };
      case 'GK':
        return { xPct: COLS.center * 100, yPct: ROWS.GK * 100 };
      default:
        return null;
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_12px_40px_rgba(0,0,0,0.55)] aspect-[1/1.02] ${className}`}
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
            width={VB_W - 2 * LINE_INSET}
            height={VB_H - 2 * LINE_INSET}
            rx={TOUCHLINE_RX}
            ry={TOUCHLINE_RX}
          />

          <line x1={INNER_L} y1={CY} x2={INNER_R} y2={CY} />

          <circle cx={CX} cy={CY} r={MID_CIRCLE_R} />
          <circle cx={CX} cy={CY} r="3.5" fill={LINE_STROKE} fillOpacity={LINE_OPACITY} stroke="none" />

          <rect x={PEN_X} y={INNER_T} width={PEN_W} height={PEN_H} />
          <rect x={PEN_X} y={BOTTOM_PEN_Y} width={PEN_W} height={PEN_H} />

          <rect x={GA_X} y={TOP_GA_Y} width={GA_W} height={GA_H} />
          <rect x={GA_X} y={BOTTOM_GA_Y} width={GA_W} height={GA_H} />

          <path d={penaltyArcTopPath()} strokeOpacity={0.75} />
          <path d={penaltyArcBottomPath()} strokeOpacity={0.75} />

          <circle cx={CX} cy={TOP_SPOT_Y} r="2.5" fill={LINE_STROKE} fillOpacity={LINE_OPACITY} stroke="none" />
          <circle cx={CX} cy={BOTTOM_SPOT_Y} r="2.5" fill={LINE_STROKE} fillOpacity={LINE_OPACITY} stroke="none" />

          <rect x={GOAL_X} y={INNER_T - GOAL_H} width={GOAL_W} height={GOAL_H} rx="1" />
          <rect x={GOAL_X} y={INNER_B} width={GOAL_W} height={GOAL_H} rx="1" />
        </g>
      </svg>

      <div
        className="absolute inset-x-[3.5%] z-[1] min-h-0"
        style={{ top: 'calc(3.5% + 16px)', bottom: 'calc(3.5% + 20px)' }}
      >
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

          const fixed = fixedXYForSlot(slot);
          const xUse = fixed?.xPct ?? x;
          const yUse = fixed?.yPct ?? y;
          const slotStyle = { left: `${xUse}%`, top: `${yUse}%`, transform: 'translate(-50%, -50%)' } as const;

          const content = <div className="origin-center scale-[0.9]">{inner}</div>;

          if (!interactive || !onSlotTap) {
            return (
              <div
                key={slot}
                className="pointer-events-none absolute flex flex-col items-center justify-center"
                style={slotStyle}
              >
                {content}
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
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
