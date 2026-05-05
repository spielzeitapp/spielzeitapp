import React from "react";
import { getPositionLabel } from "../../lib/positionLabels";

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

export const MatchPlayerRow: React.FC<{
  player: MatchRowPlayer;
  status?: "open" | "yes" | "no";
  selected?: boolean;
  rightLabel?: string | null;
  onClick?: () => void;
}> = ({ player, status, selected = false, rightLabel, onClick }) => {
  const name = (player.display_name ?? player.name ?? "Spieler").trim() || "Spieler";
  const number = player.jersey_number ?? player.number ?? null;
  const position = getPositionLabel(player.position) || "—";
  const avatarSrc = (player.avatar_url ?? player.avatarUrl ?? "").trim() || "/avatars/player-placeholder.png";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const statusClass =
    status === "yes"
      ? "bg-emerald-600/25 text-emerald-100 border-emerald-500/40"
      : status === "no"
        ? "bg-red-600/25 text-red-100 border-red-500/40"
        : "bg-amber-600/20 text-amber-100 border-amber-500/35";
  const shellClass = selected
    ? "border-emerald-500/45 bg-gradient-to-br from-emerald-950/35 via-black/80 to-black"
    : "border-red-900/40 bg-gradient-to-br from-red-900/40 via-black/80 to-black";

  const body = (
    <div
      className={[
        "w-full rounded-2xl border p-3 text-left transition-all duration-150",
        shellClass,
        onClick ? "active:scale-[0.98]" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/15 bg-zinc-800">
          <img
            src={avatarSrc}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const n = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (n) n.style.display = "flex";
            }}
          />
          <span className="hidden h-full w-full items-center justify-center text-xs font-black text-white/90">
            {initials || "SP"}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 whitespace-normal break-words text-sm font-semibold leading-tight text-white">
            {name}
          </div>
          <div className="mt-0.5 text-[11px] text-gray-400">{position}</div>
        </div>
        <div className="flex shrink-0 min-w-[72px] flex-col items-end justify-between self-stretch gap-2">
          {rightLabel ? (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>
              {rightLabel}
            </span>
          ) : (
            <span className="h-[22px]" aria-hidden />
          )}
          <div className="text-sm font-semibold text-red-300/90">
            {number != null ? `#${number}` : "—"}
          </div>
        </div>
      </div>
    </div>
  );

  if (!onClick) return body;
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {body}
    </button>
  );
};
