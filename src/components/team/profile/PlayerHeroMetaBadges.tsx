import React from "react";
import type { ProfilePositionBadge } from "../../../lib/positionLabels";
import {
  HeroInfoBadge,
  HeroJerseyBadge,
  HeroSeasonLine,
} from "./profileHeroShared";

type Props = {
  positionBadge?: ProfilePositionBadge | null;
  jerseyNumber?: string | null;
  seasonLine?: string;
  statusSlot?: React.ReactNode;
};

export function PlayerHeroMetaBadges({
  positionBadge,
  jerseyNumber,
  seasonLine,
  statusSlot,
}: Props) {
  const jersey = (jerseyNumber ?? "").trim();
  const showJersey = jersey && jersey !== "–";

  if (!positionBadge && !showJersey && !seasonLine?.trim() && !statusSlot) return null;

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {positionBadge ? <HeroInfoBadge emoji={positionBadge.emoji} label={positionBadge.label} /> : null}
        {showJersey ? <HeroJerseyBadge number={jersey} /> : null}
        {seasonLine?.trim() ? (
          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white/55">
            Saison {seasonLine.trim()}
          </span>
        ) : null}
      </div>
      {statusSlot ? <div className="flex flex-wrap items-center gap-1.5">{statusSlot}</div> : null}
    </div>
  );
}

/** Kompakte Saisonzeile unter dem Namen (wenn nicht bereits als Badge). */
export function PlayerHeroSeasonFooter({ seasonLine }: { seasonLine: string }) {
  return <HeroSeasonLine seasonLine={seasonLine} />;
}
