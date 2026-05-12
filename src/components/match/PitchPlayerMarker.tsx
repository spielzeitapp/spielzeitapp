import React from 'react';
import { LeibchenJersey } from './LeibchenJersey';

export type PitchPlayerMarkerMode = 'pitch' | 'bank';

export type PitchPlayerMarkerProps = {
  lastName: string;
  number: string | number | null | undefined;
  positionBadge: string;
  variant: 'field' | 'goalkeeper';
  mode: PitchPlayerMarkerMode;
  nameOffsetX?: number;
  nameOffsetY?: number;
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
  nameOffsetX = 0,
  nameOffsetY = 0,
  assignFlash = false,
  selected = false,
  emphasize = false,
}: PitchPlayerMarkerProps): React.ReactElement {
  /** Pitch: kräftigeres Trikot, Bank kompakter */
  const jerseyClass =
    mode === 'pitch'
      ? '!h-[72px] !w-[58px] shrink-0 sm:!h-[76px] sm:!w-[62px]'
      : '!h-[44px] !w-[38px] shrink-0 sm:!h-[48px] sm:!w-[40px]';

  const nameMax =
    mode === 'pitch' ? 'max-w-[124px] sm:max-w-[140px]' : 'max-w-[3.75rem] sm:max-w-[4.25rem]';
  const wrapperMax = mode === 'pitch' ? 'max-w-[128px] sm:max-w-[144px]' : 'max-w-[5.25rem] sm:max-w-[5.75rem]';

  const trimmedName = lastName.trim();
  const pitchName = mode === 'pitch' && trimmedName.length > 13 ? `${trimmedName.slice(0, 11)}...` : trimmedName;

  return (
    <div
      className={[
        `flex min-w-0 ${wrapperMax} flex-col items-center gap-0 transition-all duration-300 ease-out`,
        emphasize ? 'scale-105 drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]' : '',
      ].join(' ')}
    >
      <div className="shrink-0">
        <LeibchenJersey
          lastName={lastName}
          number={number}
          position={positionBadge}
          variant={variant}
          size={mode === 'pitch' ? 'large' : 'compact'}
          showBackPrint={false}
          pitchStyleBack
          selected={selected}
          assignFlash={assignFlash}
          className={jerseyClass}
        />
      </div>
      <span
        className={
          mode === 'pitch'
            ? `mt-[-1px] max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-black/45 px-[5px] py-[2px] text-center text-[12px] font-extrabold leading-[1.08] text-white sm:text-[13px] ${nameMax}`
            : `mt-0.5 w-full truncate text-center text-sm font-bold leading-tight text-white ${nameMax}`
        }
        style={mode === 'pitch' ? { transform: `translate(${nameOffsetX}px, ${nameOffsetY}px)` } : undefined}
      >
        {(mode === 'pitch' ? pitchName : trimmedName) || '—'}
      </span>
    </div>
  );
}

export const PitchPlayerMarker = React.memo(PitchPlayerMarkerInner);
PitchPlayerMarker.displayName = 'PitchPlayerMarker';
