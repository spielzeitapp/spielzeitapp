import React from "react";
import { PremiumPlayerCard } from "../player/PremiumPlayerCard";
import { PlayerSpecialStatusBadges } from "../player/PlayerSpecialStatusBadges";
import { PremiumStatusBadge, type PremiumStatusBadgeTone } from "../player/PremiumStatusBadge";
import { getPositionLabel } from "../../lib/positionLabels";
import { premiumJerseyNumberClass, type PremiumPlayerCardTone } from "../../lib/premiumPlayerCard";

function positionSubline(position?: string | null): string {
  return getPositionLabel(position) || (position ?? "").trim() || "—";
}

type MatchRowPlayer = {
  id: string;
  display_name?: string | null;
  name?: string | null;
  position?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  jersey_number?: number | null;
  number?: number | null;
  is_injured?: boolean;
  is_laz_player?: boolean;
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
  /** Optional z. B. „Training 93 %“ in der Kaderwahl. */
  metricHint?: string | null;
  onClick?: () => void;
  /** Nur Startaufstellung / Matchday-Setup — Utility-Screens bleiben default. */
  tone?: PremiumPlayerCardTone;
}> = ({ player, status, selected = false, rightLabel, metricHint, onClick, tone = "utility" }) => {
  const number = player.jersey_number ?? player.number ?? null;
  const isMatchday = tone === "matchday";
  const baseSub = positionSubline(player.position);
  const subline = metricHint ? `${baseSub} · ${metricHint}` : baseSub;

  return (
    <PremiumPlayerCard
      player={player}
      subline={subline}
      density="compact"
      tone={tone}
      active={isMatchday && selected}
      selected={!isMatchday && selected}
      onClick={onClick}
      trailing={
        <>
          <PlayerSpecialStatusBadges
            isLaz={player.is_laz_player}
            isInjured={player.is_injured}
            size="xs"
            className="mr-1"
          />
          {rightLabel ? (
            <PremiumStatusBadge label={rightLabel} tone={statusTone(status)} />
          ) : null}
          <span className={premiumJerseyNumberClass()}>{number != null ? `#${number}` : "—"}</span>
        </>
      }
    />
  );
};
