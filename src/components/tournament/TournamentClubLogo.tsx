import React, { useState } from 'react';
import { getClubLogo, getTeamInitials, hasKnownClubLogo } from '../../lib/teamLogos';
import { safeText } from '../../lib/safeText';

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  name: string;
  logoUrl?: string | null;
  size?: LogoSize;
  className?: string;
  /** Hell: dunkle Initialen; dunkel: helle Initialen. */
  tone?: 'light' | 'dark';
};

const BOX: Record<LogoSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-10 w-10 sm:h-11 sm:w-11',
  lg: 'h-[3.875rem] w-[3.875rem] sm:h-[4.25rem] sm:w-[4.25rem]',
  xl: 'h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20',
};

const IMG: Record<LogoSize, string> = {
  sm: 'max-h-7 max-w-7',
  md: 'max-h-10 max-w-10 sm:max-h-11 sm:max-w-11',
  lg: 'max-h-[3.875rem] max-w-[3.875rem] sm:max-h-[4.25rem] sm:max-w-[4.25rem]',
  xl: 'max-h-[4.5rem] max-w-[4.5rem] sm:max-h-20 sm:max-w-20',
};

const INITIALS: Record<LogoSize, string> = {
  sm: 'text-[9px]',
  md: 'text-[11px]',
  lg: 'text-[13px] sm:text-[14px]',
  xl: 'text-[14px] sm:text-[15px]',
};

/**
 * Einheitliche Turnier-Logo-Markierung über den zentralen Resolver.
 * Freistehend (keine Kachel), feste Fläche, object-contain.
 */
export function TournamentClubLogo({
  name,
  logoUrl,
  size = 'md',
  className = '',
  tone = 'dark',
}: Props) {
  const [failed, setFailed] = useState(false);
  const label = safeText(name) || 'Team';
  const known = hasKnownClubLogo(label, { logoUrl: logoUrl ?? undefined });
  const src = known ? getClubLogo(label, { logoUrl: logoUrl ?? undefined }) : null;
  const showInitials = !known || failed || !src;
  const initialsTone = tone === 'light' ? 'text-slate-600' : 'text-white/70';

  return (
    <div
      className={`flex shrink-0 items-center justify-center ${BOX[size]} ${className}`}
      aria-hidden
    >
      {showInitials ? (
        <span className={`font-bold ${INITIALS[size]} ${initialsTone}`}>{getTeamInitials(label)}</span>
      ) : (
        <img
          src={src!}
          alt=""
          className={`object-contain object-center ${IMG[size]}`}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
