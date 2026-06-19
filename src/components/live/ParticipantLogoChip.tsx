import React, { useState } from 'react';
import { getClubLogo, getTeamInitials, hasKnownClubLogo } from '../../lib/teamLogos';
import { isHeimteamParticipant } from '../../lib/matchCenterUtils';

type Props = {
  teamName: string;
  logoUrl?: string | null;
  carousel?: boolean;
};

const CAROUSEL_LOGO_BOX = 'h-[3.75rem] w-[3.75rem] sm:h-[4rem] sm:w-[4rem]';
const CAROUSEL_LOGO_IMG = 'h-[3.5rem] w-[3.5rem] sm:h-[3.75rem] sm:w-[3.75rem]';

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
  const { club } = splitParticipantDisplayName(name);
  const knownLogo = hasKnownClubLogo(name, { logoUrl });
  const src = knownLogo ? getClubLogo(name, { logoUrl }) : null;
  const heim = isHeimteamParticipant(name);
  const initials = getTeamInitials(club || name);
  const showInitials = !knownLogo || failed;

  const widthClass = carousel ? 'w-[4.75rem] sm:w-[5.25rem]' : 'w-[4.75rem]';
  const boxClass = carousel ? CAROUSEL_LOGO_BOX : 'h-11 w-11';
  const imgClass = carousel ? CAROUSEL_LOGO_IMG : 'h-8 w-8';

  return (
    <div className={`relative flex shrink-0 flex-col items-center ${widthClass}`}>
      <div className={`flex items-center justify-center ${boxClass}`}>
        {showInitials ? (
          <span
            className={`font-bold text-white/70 ${carousel ? 'text-[14px]' : 'text-[11px]'}`}
          >
            {initials}
          </span>
        ) : (
          <img
            src={src!}
            alt=""
            className={`object-contain object-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] ${imgClass}`}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <p
        className={`mt-0.5 w-full truncate text-center leading-tight text-white/88 ${
          carousel ? 'text-[10px] font-medium' : 'text-[8px] font-medium'
        }`}
        title={club || name}
      >
        {club || name}
      </p>
      {heim ? (
        <span className="mt-0.5 whitespace-nowrap rounded-full border border-[rgba(255,71,71,0.28)] bg-[rgba(255,71,71,0.08)] px-1 py-px text-[5px] font-semibold uppercase tracking-[0.04em] text-[rgba(255,140,140,0.9)]">
          Heim
        </span>
      ) : null}
    </div>
  );
}

/** Nur U12 für Subtitle — sonst null (kein falsches U11 o.ä.). */
export function extractTournamentAgeGroup(names: readonly string[]): string | null {
  for (const raw of names) {
    const match = raw.trim().match(/\b(U12)\b/i);
    if (match) return match[1]!.toUpperCase();
  }
  return null;
}
