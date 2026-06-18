import React, { useMemo, useState } from 'react';
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

  const widthClass = carousel ? 'w-[4.75rem] sm:w-[5rem]' : 'w-[4.75rem]';
  const boxClass = carousel
    ? `h-[4.25rem] w-[4.25rem] sm:h-[4.5rem] sm:w-[4.5rem]`
    : 'h-11 w-11';
  const imgClass = carousel ? 'h-[3.25rem] w-[3.25rem] sm:h-[3.5rem] sm:w-[3.5rem]' : 'h-8 w-8';

  return (
    <div className={`relative flex shrink-0 flex-col items-center ${widthClass}`}>
      <div
        className={`flex items-center justify-center rounded-2xl border ${MC_BORDER} bg-[rgba(6,4,8,0.72)] ${MC_GLOW_SM} ${boxClass}`}
      >
        {showInitials ? (
          <span className={`font-bold text-white/82 ${carousel ? 'text-[14px]' : 'text-[11px]'}`}>
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
        className={`mt-1.5 w-full truncate text-center font-semibold leading-none text-white/78 ${
          carousel ? 'text-[9px]' : 'text-[9px]'
        }`}
        title={club || name}
      >
        {club || name}
      </p>
      {ageGroup ? (
        <p className="mt-0.5 text-[7px] font-medium uppercase tracking-wide text-white/42">{ageGroup}</p>
      ) : null}
      {heim ? (
        <span className="mt-1 whitespace-nowrap rounded-full border border-[rgba(255,71,71,0.35)] bg-red-950/85 px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.06em] text-red-100/90">
          Heimteam
        </span>
      ) : null}
    </div>
  );
}
