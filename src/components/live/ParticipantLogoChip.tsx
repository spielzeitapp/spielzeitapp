import React from 'react';
import { TournamentClubLogo } from '../tournament/TournamentClubLogo';
import { safeText } from '../../lib/safeText';
import { isHeimteamParticipant } from '../../lib/matchCenterUtils';

type Props = {
  teamName: unknown;
  logoUrl?: unknown;
  carousel?: boolean;
};

const CAROUSEL_SHORT_NAMES: Record<string, string> = {
  'fk austria wien': 'FK Austria',
  'sv ried': 'SV Ried',
  'first vienna fc': 'First Vienna',
  'fc first vienna': 'First Vienna',
  'first vienna fc 1894': 'First Vienna',
  'first vienna': 'First Vienna',
  'ask wilhelmsburg': 'ASK Wilhelmsburg',
  'sku amstetten': 'SKU Amstetten',
  'sv langenrohr': 'SV Langenrohr',
  'sc wiener neustadt': 'SC Wr. Neustadt',
};

function shortenClubDisplayName(club: string): string {
  const key = club.trim().toLowerCase();
  if (CAROUSEL_SHORT_NAMES[key]) return CAROUSEL_SHORT_NAMES[key]!;
  // TURNIERlive: „NSG Rohrbach/St. Veit“ — Name bleibt lesbar in 2 Zeilen
  if (/nsg\s+rohrbach/i.test(club)) return club;
  return club;
}

function splitParticipantDisplayName(name: string): { club: string; ageGroup: string | null } {
  const trimmed = name.trim();
  const match = trimmed.match(/^(.+?)\s+(U\d{1,2})\s*$/i);
  if (match) {
    return { club: match[1]!.trim(), ageGroup: match[2]!.toUpperCase() };
  }
  return { club: trimmed, ageGroup: null };
}

export function ParticipantLogoChip({ teamName, logoUrl, carousel = false }: Props) {
  const name = safeText(teamName) || 'Team';
  const { club } = splitParticipantDisplayName(name);
  const displayClub = carousel ? shortenClubDisplayName(club || name) : club || name;
  const heim = isHeimteamParticipant(name);

  const widthClass = carousel ? 'w-[5.75rem] sm:w-[6.25rem]' : 'w-[4.75rem]';

  return (
    <div className={`relative flex shrink-0 flex-col items-center ${widthClass}`}>
      <TournamentClubLogo
        name={name}
        logoUrl={safeText(logoUrl) || undefined}
        size={carousel ? 'lg' : 'md'}
        tone="dark"
      />
      <p
        className={`mt-1 w-full text-center leading-tight text-white/90 ${
          carousel
            ? 'line-clamp-2 text-[10px] font-semibold sm:text-[11px]'
            : 'line-clamp-2 text-[8px] font-medium'
        }`}
        title={club || name}
      >
        {displayClub}
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
export function extractTournamentAgeGroup(names: readonly unknown[]): string | null {
  for (const raw of names) {
    const match = safeText(raw).match(/\b(U12)\b/i);
    if (match) return match[1]!.toUpperCase();
  }
  return null;
}
