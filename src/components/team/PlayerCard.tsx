import React from "react";
import { ChevronRight } from "lucide-react";
import { getTrainingPositionDisplay } from "../../lib/positionLabels";
import { PremiumPlayerCard } from "../player/PremiumPlayerCard";
import { premiumJerseyNumberClass } from "../../lib/premiumPlayerCard";

export type PlayerCardPlayer = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  position?: string | null;
  number?: number | null;
  jersey_number?: number | null;
  photo_url?: string | null;
  is_injured?: boolean;
};

type PlayerCardProps = {
  player: PlayerCardPlayer;
  selected?: boolean;
  onClick?: () => void;
};

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, selected = false, onClick }) => {
  const num = player.jersey_number ?? player.number;
  return (
    <PremiumPlayerCard
      player={{ ...player, jersey_number: num ?? undefined }}
      subline={getTrainingPositionDisplay(player.position)}
      density="compact"
      selected={selected}
      onClick={onClick}
      trailing={
        <>
          {player.is_injured ? (
            <span className="mr-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
              Verletzt
            </span>
          ) : null}
          <span className={premiumJerseyNumberClass()}>{num != null ? `#${num}` : "—"}</span>
          <ChevronRight className="h-4 w-4 text-white/28" aria-hidden />
        </>
      }
    />
  );
};
