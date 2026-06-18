import React, { useState } from 'react';
import { getClubLogo, getTeamInitials } from '../../lib/teamLogos';
import { isHeimteamParticipant } from '../../lib/matchCenterUtils';

type Props = {
  teamName: string;
  logoUrl?: string | null;
  /** Größere Logos für Turnier-Carousel. */
  carousel?: boolean;
};

export function ParticipantLogoChip({ teamName, logoUrl, carousel = false }: Props) {
  const [failed, setFailed] = useState(false);
  const name = teamName.trim() || 'Team';
  const src = getClubLogo(name, { logoUrl });
  const heim = isHeimteamParticipant(name);
  const initials = getTeamInitials(name);
  const showInitials = failed;

  const boxClass = carousel
    ? 'mt-2.5 h-[3.75rem] w-[3.75rem] sm:h-16 sm:w-16'
    : 'mt-2 h-11 w-11';
  const imgClass = carousel ? 'h-[2.75rem] w-[2.75rem] sm:h-12 sm:w-12' : 'h-8 w-8';
  const widthClass = carousel ? 'w-[4.5rem] sm:w-[4.75rem]' : 'w-[4.75rem]';

  return (
    <div className={`relative flex shrink-0 flex-col items-center ${widthClass}`}>
      {heim ? (
        <span className="absolute -top-0.5 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-full border border-red-500/45 bg-red-950/90 px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.08em] text-red-100 shadow-[0_0_10px_rgba(220,38,38,0.25)] sm:text-[7px]">
          Heimteam
        </span>
      ) : null}
      <div
        className={`flex items-center justify-center rounded-2xl border border-white/14 bg-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_16px_rgba(220,38,38,0.08)] ${boxClass}`}
      >
        {showInitials ? (
          <span className={`font-bold text-white/80 ${carousel ? 'text-[13px]' : 'text-[11px]'}`}>
            {initials}
          </span>
        ) : (
          <img
            src={src}
            alt=""
            className={`object-contain ${imgClass}`}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <p
        className={`mt-1 line-clamp-1 w-full text-center font-medium leading-none text-white/62 ${
          carousel ? 'text-[8px]' : 'text-[9px]'
        }`}
      >
        {name}
      </p>
    </div>
  );
}
