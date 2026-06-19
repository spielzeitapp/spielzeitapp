import React, { useState } from 'react';
import { getClubLogo, getTeamInitials, hasKnownClubLogo } from '../../lib/teamLogos';
import { isHeimteamParticipant } from '../../lib/matchCenterUtils';

type Props = {
  teamName: string;
  logoUrl?: string | null;
  carousel?: boolean;
};

function splitParticipantDisplayName(name: string): { club: string; ageGroup: string | null } {
  const trimmed = name.trim();
  const match = trimmed.match(/^(.+?)\s+(U\d{1,2})\s*$/i);
  if (match) {
    return { club: match[1]!.trim(), ageGroup: match[2]!.toUpperCase() };
  }
  return { club: trimmed, ageGroup: null };
}

export function ParticipantLogoChip({ teamName, logoUrl, carousel = false }: Props) {
  const [failed, setFailed] = useState(false);
  const name = teamName.trim() || 'Team';
  const { club, ageGroup } = splitParticipantDisplayName(name);
  const knownLogo = hasKnownClubLogo(name, { logoUrl });
  const src = knownLogo ? getClubLogo(name, { logoUrl }) : null;
  const heim = isHeimteamParticipant(name);
  const initials = getTeamInitials(club || name);
  const showInitials = !knownLogo || failed;

  const widthClass = carousel ? 'w-[6.5rem]' : 'w-[4.75rem]';
  const boxClass = carousel ? 'h-[6rem] w-[6rem] sm:h-[6.5rem] sm:w-[6.5rem]' : 'h-11 w-11';
  const imgClass = carousel ? 'h-[5.5rem] w-[5.5rem] sm:h-[6rem] sm:w-[6rem]' : 'h-8 w-8';

  return (
    <div className={`relative flex shrink-0 flex-col items-center ${widthClass}`}>
      <div className={`flex items-center justify-center ${boxClass}`}>
        {showInitials ? (
          <span
            className={`font-bold text-white/70 ${carousel ? 'text-[15px]' : 'text-[11px]'}`}
          >
            {initials}
          </span>
        ) : (
          <img
            src={src!}
            alt=""
            className={`object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] ${imgClass}`}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <p
        className="mt-0.5 w-full truncate text-center text-[8px] font-medium leading-tight text-white/58"
        title={club || name}
      >
        {club || name}
      </p>
      {ageGroup ? (
        <p className="mt-px text-[7px] font-medium uppercase tracking-wide text-white/35">{ageGroup}</p>
      ) : null}
      {heim ? (
        <span className="mt-px whitespace-nowrap rounded-full bg-white/[0.06] px-1 py-px text-[5px] font-medium uppercase tracking-[0.04em] text-white/45">
          Heim
        </span>
      ) : null}
    </div>
  );
}
