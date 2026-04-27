import React from 'react';
import { LeibchenJersey } from './LeibchenJersey';

export type PitchPlayerMarkerMode = 'pitch' | 'bank';

export type PitchPlayerMarkerProps = {
  lastName: string;
  number: string | number | null | undefined;
  positionBadge: string;
  variant: 'field' | 'goalkeeper';
  mode: PitchPlayerMarkerMode;
  assignFlash?: boolean;
  selected?: boolean;
  emphasize?: boolean;
};

function PitchPlayerMarkerInner({
  lastName,
  number,
  positionBadge,
  variant,
  mode,
  assignFlash = false,
  selected = false,
  emphasize = false,
}: PitchPlayerMarkerProps): React.ReactElement {
  /** Mobile ~48px, Desktop ~60px Breite; Höhe ~1.18× (ViewBox 100:118) */
  const jerseyClass =
    mode === 'pitch'
      ? '!h-[57px] !w-[48px] shrink-0 sm:!h-[71px] sm:!w-[60px]'
      : '!h-[44px] !w-[38px] shrink-0 sm:!h-[48px] sm:!w-[40px]';

  const nameMax =
    mode === 'pitch' ? 'max-w-[4.5rem] sm:max-w-[5.25rem]' : 'max-w-[3.75rem] sm:max-w-[4.25rem]';

  return (
    <div
      className={[
        'flex min-w-0 max-w-[5.25rem] flex-col items-center gap-0 transition-all duration-300 ease-out sm:max-w-[5.75rem]',
        emphasize ? 'scale-105 drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]' : '',
      ].join(' ')}
    >
      <div className="shrink-0">
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
      <span
        className={`mt-1.5 w-full truncate text-center text-sm font-bold leading-tight text-white ${nameMax}`}
      >
        {lastName.trim() || '—'}
      </span>
    </div>
  );
}

export const PitchPlayerMarker = React.memo(PitchPlayerMarkerInner);
PitchPlayerMarker.displayName = 'PitchPlayerMarker';
