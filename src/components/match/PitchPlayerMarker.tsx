import React from 'react';
import { LeibchenJersey } from './LeibchenJersey';

export type PitchPlayerMarkerMode = 'pitch' | 'bank';

export type PitchPlayerMarkerProps = {
  lastName: string;
  number: string | number | null | undefined;
  /** Positions-Badge unter dem Namen (z. B. GK, LV) */
  positionBadge: string;
  variant: 'field' | 'goalkeeper';
  mode: PitchPlayerMarkerMode;
  assignFlash?: boolean;
  selected?: boolean;
  /** Leichter Fokus (z. B. Wechsel „Raus“) */
  emphasize?: boolean;
};

const numDisplay = (n: string | number | null | undefined) =>
  n === null || n === undefined || n === '' ? '–' : String(n);

/**
 * Kompaktes Lineup: Trikot ohne Rücken-Druck, Nummer/Name/Badge als HTML für Lesbarkeit.
 */
export function PitchPlayerMarker({
  lastName,
  number,
  positionBadge,
  variant,
  mode,
  assignFlash = false,
  selected = false,
  emphasize = false,
}: PitchPlayerMarkerProps): React.ReactElement {
  const jerseyClass =
    mode === 'pitch'
      ? '!h-[71px] !w-[60px] shrink-0 sm:!h-[89px] sm:!w-[75px]'
      : '!h-[59px] !w-[50px] shrink-0';

  return (
    <div
      className={[
        'flex flex-col items-center gap-0 transition-all duration-300 ease-out',
        emphasize ? 'scale-105 drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]' : '',
      ].join(' ')}
    >
      <LeibchenJersey
        lastName={lastName}
        number={number}
        position={positionBadge}
        variant={variant}
        size="compact"
        showBackPrint={false}
        selected={selected}
        assignFlash={assignFlash}
        className={jerseyClass}
      />
      <span
        className={[
          'mt-0.5 font-mono font-black leading-none tracking-tight text-white tabular-nums',
          mode === 'pitch' ? 'text-lg sm:text-xl' : 'text-base',
        ].join(' ')}
      >
        {numDisplay(number)}
      </span>
      <span className="max-w-[4.75rem] truncate text-center text-[11px] font-semibold leading-snug text-white/85 sm:max-w-[5.5rem] sm:text-xs">
        {lastName.trim() || '—'}
      </span>
      <span className="mt-0.5 rounded bg-black/35 px-1 py-px text-[8px] font-bold uppercase tracking-[0.12em] text-white/60">
        {positionBadge.trim().toUpperCase()}
      </span>
    </div>
  );
}
