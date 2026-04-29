import React from "react";
import { ChevronRight } from "lucide-react";

export type PlayerCardPlayer = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  position?: string | null;
  number?: number | null;
  photo_url?: string | null;
};

type PlayerCardProps = {
  player: PlayerCardPlayer;
  selected?: boolean;
  onClick?: () => void;
};

function displayName(player: PlayerCardPlayer): string {
  const first = (player.first_name ?? "").trim();
  const last = (player.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return (player.display_name ?? "").trim() || "Spieler";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, selected = false, onClick }) => {
  const name = displayName(player);
  const photo = (player.photo_url ?? "").trim();
  const fallback = (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-zinc-800 text-sm font-black text-white/90">
      {initials(name)}
    </div>
  );

  const content = (
    <div
      className={[
        "flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3",
        "transition-all duration-150",
        selected ? "shadow-[0_0_18px_rgba(239,68,68,0.25)] border-red-500/60" : "",
      ].join(" ")}
    >
      <div className="h-12 w-12 shrink-0">
        {photo ? (
          <img
            src={photo}
            alt={name}
            className="h-12 w-12 rounded-full border border-white/12 object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const next = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (next) next.style.display = "flex";
            }}
          />
        ) : null}
        <div style={{ display: photo ? "none" : "flex" }}>{fallback}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold text-white">{name}</div>
        <div className="mt-0.5 text-xs text-white/60">{(player.position ?? "").trim() || "—"}</div>
      </div>
      <div className="flex items-center gap-1">
        <div className="text-lg font-bold text-red-400">#{player.number ?? "—"}</div>
        <ChevronRight className="h-5 w-5 text-white/35" aria-hidden />
      </div>
    </div>
  );

  if (!onClick) return content;
  return (
    <button type="button" onClick={onClick} className="w-full text-left active:scale-[0.99]">
      {content}
    </button>
  );
};

