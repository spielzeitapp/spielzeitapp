import React, { useState } from 'react';
import { getClubLogo, getTeamInitials } from '../../lib/teamLogos';
import { isHeimteamParticipant } from '../../lib/matchCenterUtils';

type Props = {
  teamName: string;
  logoUrl?: string | null;
  compact?: boolean;
};

export function ParticipantLogoChip({ teamName, logoUrl, compact = false }: Props) {
  const [failed, setFailed] = useState(false);
  const name = teamName.trim() || 'Team';
  const src = getClubLogo(name, { logoUrl });
  const heim = isHeimteamParticipant(name);
  const initials = getTeamInitials(name);

  return (
    <div
      className={`relative flex shrink-0 flex-col items-center gap-1.5 ${
        compact ? 'w-[4.75rem]' : 'w-[5.25rem]'
      }`}
    >
      {heim ? (
        <span className="absolute -top-1 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-full border border-red-500/45 bg-red-950/90 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] text-red-100 shadow-[0_0_10px_rgba(220,38,38,0.25)]">
          Heimteam
        </span>
      ) : null}
      <div
        className={`flex items-center justify-center rounded-2xl border border-white/12 bg-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
          compact ? 'mt-2 h-11 w-11' : 'mt-2.5 h-12 w-12'
        }`}
      >
        {!failed ? (
          <img
            src={src}
            alt=""
            className={`object-contain ${compact ? 'h-8 w-8' : 'h-9 w-9'}`}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-[11px] font-bold text-white/75">{initials}</span>
        )}
      </div>
      <p className="line-clamp-2 w-full text-center text-[9px] font-semibold leading-snug text-white/78">
        {name}
      </p>
    </div>
  );
}
