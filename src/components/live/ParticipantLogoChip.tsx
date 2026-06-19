import React, { useState } from 'react';
import { getClubLogo, getTeamInitials, hasKnownClubLogo } from '../../lib/teamLogos';
import { isHeimteamParticipant } from '../../lib/matchCenterUtils';
import { MC_BORDER, MC_GLOW_SM } from './matchCenterStyles';

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

  const widthClass = carousel ? 'w-[5.25rem] sm:w-[5.5rem]' : 'w-[4.75rem]';
  const boxClass = carousel
    ? 'h-[4.75rem] w-[4.75rem] sm:h-20 sm:w-20'
    : 'h-11 w-11';
  const imgClass = carousel ? 'h-[3.5rem] w-[3.5rem] sm:h-[3.75rem] sm:w-[3.75rem]' : 'h-8 w-8';

  return (
    <div className={`relative flex shrink-0 flex-col items-center ${widthClass}`}>
      <div
        className={`flex items-center justify-center rounded-2xl border ${MC_BORDER} bg-[rgba(6,4,8,0.72)] ${MC_GLOW_SM} ${boxClass}`}
      >
        {showInitials ? (
          <span className={`font-bold text-white/82 ${carousel ? 'text-[15px]' : 'text-[11px]'}`}>
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
        className="mt-1.5 w-full truncate text-center text-[8px] font-medium leading-none text-white/68"
        title={club || name}
      >
        {club || name}
      </p>
      {ageGroup ? (
        <p className="mt-0.5 text-[6px] font-medium uppercase tracking-wide text-white/38">{ageGroup}</p>
      ) : null}
      {heim ? (
        <span className="mt-0.5 whitespace-nowrap rounded-full border border-[rgba(255,71,71,0.3)] bg-red-950/80 px-1 py-px text-[5px] font-bold uppercase tracking-[0.04em] text-red-100/85">
          Heim
        </span>
      ) : null}
    </div>
  );
}
