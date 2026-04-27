import React from 'react';
import { LeibchenJersey } from './LeibchenJersey';

export type PitchPlayerMarkerMode = 'pitch' | 'bank';

export type PitchPlayerMarkerProps = {
  lastName: string;
  number: string | number | null | undefined;
  /** Positionskürzel (auf dem Trikot klein + unter dem Namen) */
  positionBadge: string;
  variant: 'field' | 'goalkeeper';
  mode: PitchPlayerMarkerMode;
  assignFlash?: boolean;
  selected?: boolean;
  /** Leichter Fokus (z. B. Wechsel „Raus“) */
  emphasize?: boolean;
};

/**
 * Profi-Lineup: Trikot nur mit Nummer (+ kleinem Pos-Kürzel), Name und Position darunter.
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

  const nameMax =
    mode === 'pitch' ? 'max-w-[4.5rem] sm:max-w-[5.25rem]' : 'max-w-[3.75rem] sm:max-w-[4.25rem]';

  return (
    <div
      className={[
        'flex min-w-0 max-w-[5.5rem] flex-col items-center transition-all duration-300 ease-out sm:max-w-[6.25rem]',
        emphasize ? 'scale-105 drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]' : '',
      ].join(' ')}
    >
      <div className="-translate-y-2 shrink-0">
        <LeibchenJersey
          lastName={lastName}
          number={number}
          position={positionBadge}
          variant={variant}
          size="compact"
          showBackPrint={false}
          pitchStyleBack
          selected={selected}
          assignFlash={assignFlash}
          className={jerseyClass}
        />
      </div>
      <div className="mt-2 flex min-w-0 flex-col items-center gap-0.5 px-0.5 text-center">
        <span
          className={`w-full truncate text-[11px] font-bold leading-tight text-white sm:text-xs ${nameMax}`}
        >
          {lastName.trim() || '—'}
        </span>
        <span
          className={`w-full truncate text-[10px] font-medium uppercase leading-tight tracking-wide text-white/50 ${nameMax}`}
        >
          {positionBadge.trim() || '–'}
        </span>
      </div>
    </div>
  );
}
