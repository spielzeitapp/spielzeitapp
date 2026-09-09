import React from "react";
import { PremiumPlayerCard } from "../player/PremiumPlayerCard";
import { PlayerSpecialStatusBadges } from "../player/PlayerSpecialStatusBadges";
import { PremiumStatusBadge, type PremiumStatusBadgeTone } from "../player/PremiumStatusBadge";
import { getPositionLabel } from "../../lib/positionLabels";
import {
  premiumJerseyNumberClass,
  premiumPlayerAvatarSrc,
  premiumPlayerDisplayName,
  type PremiumPlayerCardTone,
} from "../../lib/premiumPlayerCard";

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
  cutout_url?: string | null;
  first_name?: string | null;
  last_name?: string | null;
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
  /** Kaderwahl in der Match-Vorbereitung: gleiche Zeilenoptik wie Team → Kader. */
  layout?: "default" | "team-roster";
}> = ({ player, status, selected = false, rightLabel, metricHint, onClick, tone = "utility", layout = "default" }) => {
  const number = player.jersey_number ?? player.number ?? null;
  const isMatchday = tone === "matchday";
  const baseSub = positionSubline(player.position);
  const subline = metricHint ? `${baseSub} · ${metricHint}` : baseSub;

  if (layout === "team-roster") {
    const mediaSrc = player.cutout_url?.trim() || premiumPlayerAvatarSrc(player);
    const content = (
      <>
        <div className="relative -mb-2.5 mr-2 h-[74px] w-[60px] shrink-0 self-end overflow-hidden">
          <img
            src={mediaSrc}
            alt=""
            className={`h-full w-full object-bottom ${player.cutout_url?.trim() ? "origin-bottom scale-[1.42] object-contain" : "object-contain"}`}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = "/avatars/player-placeholder.png";
            }}
          />
        </div>
        <span className="w-11 shrink-0 border-l border-white/10 pl-2 text-[25px] font-black leading-none text-white">
          {number ?? "–"}
        </span>
        <span className="min-w-0 flex-1 pl-2">
          <span className="line-clamp-2 block text-[15px] font-bold leading-tight text-white/95">
            {premiumPlayerDisplayName(player)}
          </span>
          <span className="mt-1 block text-[11px] font-semibold text-white/48">{subline}</span>
        </span>
        <span className="ml-1 flex max-w-[7.25rem] shrink-0 flex-col items-end gap-1">
          <PlayerSpecialStatusBadges
            isLaz={player.is_laz_player}
            isInjured={player.is_injured}
            size="xs"
          />
          {rightLabel ? <PremiumStatusBadge label={rightLabel} tone={statusTone(status)} /> : null}
        </span>
      </>
    );
    const className = [
      "flex min-h-[78px] w-full items-center overflow-hidden rounded-[15px] border px-2.5 text-left transition active:scale-[0.99]",
      "sz-club-surface sz-club-surface--quiet",
      selected
        ? "border-emerald-500/55 shadow-[0_8px_26px_rgba(5,150,105,0.16),0_0_18px_rgba(16,185,129,0.10)]"
        : "border-red-500/35",
      onClick ? "hover:border-red-400/55" : "",
    ].join(" ");
    return onClick ? (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
    );
  }

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
