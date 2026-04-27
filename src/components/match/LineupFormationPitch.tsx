import React from 'react';
import type { FieldSlotId } from '../../types/match';
import type { U11FormationId } from '../../lib/matchFormations';
import { U11_FORMATIONS } from '../../lib/matchFormations';

const PITCH_SURFACE: React.CSSProperties = {
  backgroundImage: [
    'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 40px, transparent 40px, transparent 80px)',
    'linear-gradient(to bottom, #2e7d32, #27682b)',
  ].join(', '),
};

export type LineupFormationPitchProps = {
  formationId: U11FormationId;
  slots: Record<FieldSlotId, string | null>;
  interactive?: boolean;
  onSlotTap?: (slot: FieldSlotId) => void;
  selectedBankPlayerId?: string | null;
  assignFlashSlot?: FieldSlotId | null;
  /** Optional: Spieler-ID für dezentes Highlight (z. B. Wechsel-Auswahl) */
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

/**
 * Grünes Profi-Spielfeld 3:4, weiße Linien; Spieler absolut positioniert (matchFormations).
 */
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

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.35)] aspect-[3/4] max-h-[min(78dvh,640px)] ${className}`}
      style={PITCH_SURFACE}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 360 520"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <g fill="none" stroke="#ffffff" strokeWidth="1.5" style={{ opacity: 0.22 }}>
          <rect x="1.5" y="1.5" width="357" height="517" rx="2" />
          <line x1="180" y1="0" x2="180" y2="520" />
          <circle cx="180" cy="260" r="52" />
          <circle cx="180" cy="260" r="3.5" fill="#ffffff" style={{ opacity: 0.35 }} />
          <rect x="95" y="380" width="170" height="140" />
          <line x1="95" y1="430" x2="265" y2="430" />
          <rect x="95" y="0" width="170" height="140" />
          <line x1="95" y1="90" x2="265" y2="90" />
        </g>
      </svg>

      <div className="absolute inset-0 z-[1]">
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

          if (!interactive || !onSlotTap) {
            return (
              <div
                key={slot}
                className="pointer-events-none absolute flex flex-col items-center justify-end"
                style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
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
                'absolute flex flex-col items-center justify-end rounded-full border border-transparent bg-transparent px-1 pb-0.5 pt-1 transition-all duration-300 ease-out active:scale-[0.98]',
                empty ? 'min-h-[52px] min-w-[52px]' : 'min-h-0 min-w-0',
                dropHint ? 'ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-transparent' : '',
                flash ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-emerald-900/40' : '',
              ].join(' ')}
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
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
