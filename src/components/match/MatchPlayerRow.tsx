import React from "react";
import { PremiumPlayerCard } from "../player/PremiumPlayerCard";
import { PremiumStatusBadge, type PremiumStatusBadgeTone } from "../player/PremiumStatusBadge";
import { premiumJerseyNumberClass } from "../../lib/premiumPlayerCard";

type MatchRowPlayer = {
  id: string;
  display_name?: string | null;
  name?: string | null;
  position?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  jersey_number?: number | null;
  number?: number | null;
};

function statusTone(status?: "open" | "yes" | "no"): PremiumStatusBadgeTone {
  if (status === "yes") return "present";
  if (status === "no") return "absent";
  return "open";
}

export const MatchPlayerRow: React.FC<{
  player: MatchRowPlayer;
  status?: "open" | "yes" | "no";
  selected?: boolean;
  rightLabel?: string | null;
  onClick?: () => void;
}> = ({ player, status, selected = false, rightLabel, onClick }) => {
  const number = player.jersey_number ?? player.number ?? null;

  return (
    <PremiumPlayerCard
      player={player}
      density="compact"
      selected={selected}
      onClick={onClick}
      trailing={
        <>
          {rightLabel ? (
            <PremiumStatusBadge label={rightLabel} tone={statusTone(status)} />
          ) : null}
          <span className={premiumJerseyNumberClass()}>{number != null ? `#${number}` : "—"}</span>
        </>
      }
    />
  );
};
