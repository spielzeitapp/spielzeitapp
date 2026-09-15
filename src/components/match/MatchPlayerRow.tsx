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

function playerNameParts(player: MatchRowPlayer): { first: string; family: string } {
  const first = (player.first_name ?? "").trim();
  const family = (player.last_name ?? "").trim();
  if (first || family) return { first: first || "Spieler", family };
  const parts = premiumPlayerDisplayName(player).trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || "Spieler",
    family: parts.slice(1).join(" "),
  };
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
  /** Eigene rechte Aktionen, z. B. Zu-/Absage im Matchcenter. */
  trailing?: React.ReactNode;
  /** Blendet die Positionszeile aus, wenn nur Name und Status relevant sind. */
  hideSubline?: boolean;
}> = ({ player, status, selected = false, rightLabel, metricHint, onClick, tone = "utility", layout = "default", trailing, hideSubline = false }) => {
  const number = player.jersey_number ?? player.number ?? null;
  const isMatchday = tone === "matchday";
  const baseSub = positionSubline(player.position);
  const subline = metricHint ? `${baseSub} · ${metricHint}` : baseSub;

  if (layout === "team-roster") {
    const mediaSrc = player.cutout_url?.trim() || premiumPlayerAvatarSrc(player);
    const nameParts = playerNameParts(player);
    const familyName = nameParts.family || premiumPlayerDisplayName(player);
    const compactFamilyName = familyName.length >= 12;
    const content = (
      <>
        <div className="relative mr-2 h-[58px] w-[58px] shrink-0 self-end overflow-hidden max-[359px]:mr-1 max-[359px]:h-[54px] max-[359px]:w-[46px]">
          <img
            src={mediaSrc}
            alt=""
            className={`h-full w-full object-top ${player.cutout_url?.trim() ? "origin-top scale-[1.72] object-contain" : "object-cover"}`}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = "/avatars/player-placeholder.png";
            }}
          />
        </div>
        <span className="sz-club-number-divider w-11 shrink-0 border-l pl-2 text-[25px] font-black leading-none text-white max-[359px]:w-8 max-[359px]:pl-1.5 max-[359px]:text-[21px]">
          {number ?? "–"}
        </span>
        <span className="min-w-0 flex-1 pl-2 max-[359px]:pl-1.5">
          <span className="block whitespace-normal break-words text-[13px] font-semibold leading-tight text-white/55 max-[359px]:text-[11px] sm:text-[14px]">
            {nameParts.first}
          </span>
          <span
            className={`block whitespace-normal break-words font-black leading-tight tracking-tight text-white ${
              compactFamilyName
                ? 'text-[14px] sm:text-[16px]'
                : 'text-[17px] max-[359px]:text-[14px] sm:text-[18px]'
            }`}
          >
            {familyName}
          </span>
          {!hideSubline ? <span className="mt-1 block text-[11px] font-semibold text-white/48">{subline}</span> : null}
        </span>
        {trailing ? (
          <span className="ml-1 flex shrink-0 items-center max-[359px]:ml-0.5 max-[359px]:origin-right max-[359px]:scale-[0.9]">{trailing}</span>
        ) : (
          <span className="ml-1 flex max-w-[7.25rem] shrink-0 flex-col items-end gap-1">
            <PlayerSpecialStatusBadges
              isLaz={player.is_laz_player}
              isInjured={player.is_injured}
              size="xs"
            />
            {rightLabel ? <PremiumStatusBadge label={rightLabel} tone={statusTone(status)} /> : null}
          </span>
        )}
      </>
    );
    const className = [
      "flex min-h-[68px] w-full min-w-0 max-w-full items-center overflow-hidden rounded-[15px] border px-2.5 text-left transition active:scale-[0.99] max-[359px]:px-1.5",
      "sz-club-list-card sz-club-surface sz-club-surface--quiet",
      selected
        ? "border-emerald-500/55 shadow-[0_8px_26px_rgba(5,150,105,0.16),0_0_18px_rgba(16,185,129,0.10)]"
        : "",
      onClick ? "hover:brightness-110" : "",
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
