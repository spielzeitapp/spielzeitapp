import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { getTeamInitials } from "../../lib/teamLogos";

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
  /** Wenn gesetzt und truthy: Foto anzeigen, sonst Initialen-Avatar */
  showPhoto?: boolean;
  showChevron?: boolean;
  showJerseyBadgeOnAvatar?: boolean;
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

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  selected = false,
  showPhoto = true,
  showChevron = true,
  showJerseyBadgeOnAvatar = true,
  onClick,
}) => {
  const name = playerDisplayName(player);
  const photo = (player.photo_url ?? "").trim();
  const wantPhoto = showPhoto && photo.length > 0;
  const [photoFailed, setPhotoFailed] = useState(false);
  const showImage = wantPhoto && !photoFailed;
  const initials = getTeamInitials(name);
  const num = player.number;

  const avatar = (
    <div className="relative h-12 w-12 shrink-0">
      {showImage ? (
        <img
          src={photo}
          alt={name}
          className="h-12 w-12 rounded-full border border-white/15 object-cover"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-gradient-to-br from-zinc-700 to-zinc-900 text-sm font-black text-white/95 shadow-inner"
          aria-hidden
        >
          {initials}
        </div>
      )}
      {showJerseyBadgeOnAvatar && num != null && Number(num) > 0 ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-red-500/80 bg-red-600 px-1 text-[10px] font-black tabular-nums text-white shadow-[0_0_8px_rgba(239,68,68,0.45)]">
          {num}
        </span>
      ) : null}
    </div>
  );

  const content = (
    <div
      className={[
        "flex items-center gap-3 rounded-xl border p-3 transition-all duration-150",
        selected
          ? "border-red-500/60 bg-red-950/25 shadow-[0_0_20px_rgba(239,68,68,0.22)]"
          : "border-white/[0.08] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
      ].join(" ")}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold leading-tight text-white">{name}</div>
        <div className="mt-0.5 truncate text-xs text-white/55">{(player.position ?? "").trim() || "—"}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="text-lg font-bold tabular-nums text-red-400">#{num ?? "—"}</div>
        {showChevron ? <ChevronRight className="h-5 w-5 text-white/35" aria-hidden /> : null}
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
