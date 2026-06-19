import React, { useState } from 'react';
import { getClubLogo, getTeamInitials, hasKnownClubLogo } from '../../lib/teamLogos';
import { isHeimteamParticipant } from '../../lib/matchCenterUtils';
import { MC_SURFACE } from './matchCenterStyles';

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

  const widthClass = carousel ? 'w-[5.75rem] sm:w-[6rem]' : 'w-[4.75rem]';
  const boxClass = carousel ? 'h-[5.5rem] w-[5.5rem] sm:h-[5.75rem] sm:w-[5.75rem]' : 'h-11 w-11';
  const imgClass = carousel ? 'h-[4rem] w-[4rem] sm:h-[4.25rem] sm:w-[4.25rem]' : 'h-8 w-8';

  return (
    <div className={`relative flex shrink-0 flex-col items-center ${widthClass}`}>
      <div className={`flex items-center justify-center rounded-2xl ${MC_SURFACE} ${boxClass}`}>
        {showInitials ? (
          <span className={`font-bold text-white/82 ${carousel ? 'text-[16px]' : 'text-[11px]'}`}>
            {initials}
          </span>
        ) : (
          <img
            src={src!}
            alt=""
            className={`object-contain ${imgClass}`}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <p
        className="mt-1 w-full truncate text-center text-[7px] font-medium leading-none text-white/55"
        title={club || name}
      >
        {club || name}
      </p>
      {ageGroup ? (
        <p className="mt-0.5 text-[6px] font-medium uppercase tracking-wide text-white/32">{ageGroup}</p>
      ) : null}
      {heim ? (
        <span className="mt-0.5 whitespace-nowrap rounded-full border border-white/[0.08] bg-black/60 px-1 py-px text-[5px] font-semibold uppercase tracking-[0.04em] text-white/55">
          Heim
        </span>
      ) : null}
    </div>
  );
}
