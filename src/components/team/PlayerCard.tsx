import React from "react";

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

function playerDisplayName(player: PlayerCardPlayer): string {
  const first = (player.first_name ?? "").trim();
  const last = (player.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const display = (player.display_name ?? "").trim();
  return display || "Spieler";
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, selected = false, onClick }) => {
  const content = (
    <div
      className={[
        "flex items-center gap-3 rounded-xl border p-3 transition-all duration-150",
        selected
          ? "border-red-500/85 bg-red-950/30 shadow-[0_0_18px_rgba(239,68,68,0.35)]"
          : "border-white/10 bg-white/5",
      ].join(" ")}
    >
      <img
        src={player.photo_url || "/placeholder-player.png"}
        alt={playerDisplayName(player)}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/placeholder-player.png";
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">{playerDisplayName(player)}</div>
        <div className="text-xs text-white/60">{(player.position ?? "").trim() || "—"}</div>
      </div>
      <div className="shrink-0 text-lg font-bold text-red-400">#{player.number ?? "—"}</div>
    </div>
  );

  if (!onClick) return content;

  return (
    <button type="button" onClick={onClick} className="w-full text-left active:scale-[0.99]">
      {content}
    </button>
  );
};

