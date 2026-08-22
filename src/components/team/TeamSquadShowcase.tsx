import React from "react";
import { ChevronRight } from "lucide-react";
import type { PlayerItem } from "../../hooks/usePlayers";
import { premiumPlayerDisplayName } from "../../lib/premiumPlayerCard";

type Props = {
  players: PlayerItem[];
  ownPlayerIds: Set<string>;
  onPlayerClick: (player: PlayerItem) => void;
};

function playerImage(player: PlayerItem): string {
  return (player.cutout_url ?? player.avatar_url ?? "").trim() || "/avatars/player-placeholder.png";
}

export const TeamSquadShowcase: React.FC<Props> = ({ players, ownPlayerIds, onPlayerClick }) => {
  return (
    <div className="mt-3">
      <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-5 sm:px-5">
        {players.map((player) => {
          const ownPlayer = ownPlayerIds.has(player.id);
          const number = player.jersey_number;
          return (
            <button
              key={`showcase-${player.id}`}
              type="button"
              onClick={() => onPlayerClick(player)}
              className="group relative aspect-[4/5] w-[66vw] max-w-[250px] shrink-0 snap-center overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,#171719_0%,#080809_52%,#20090b_100%)] text-left shadow-[0_14px_38px_rgba(0,0,0,0.42)] transition active:scale-[0.985] sm:w-[230px]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_28%,rgba(220,38,38,0.25),transparent_46%)]" aria-hidden />
              <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(130deg,transparent_0,transparent_14px,rgba(239,68,68,0.15)_15px,transparent_16px)]" aria-hidden />
              {ownPlayer ? (
                <span className="absolute left-3 top-3 z-20 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-lg">
                  Dein Kind
                </span>
              ) : null}
              {number != null ? (
                <span className="absolute right-3 top-2 z-10 text-[38px] font-black leading-none text-white/14">
                  {number}
                </span>
              ) : null}
              <img
                src={playerImage(player)}
                alt=""
                className="absolute inset-x-0 bottom-0 h-[92%] w-full object-contain object-bottom transition duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black via-black/75 to-transparent" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                <p className="truncate text-[22px] font-black uppercase leading-none tracking-tight text-white">
                  {premiumPlayerDisplayName(player)}
                </p>
                <p className="mt-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white/55">
                  {number != null ? `Nr. ${number}` : "Spieler"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <ul className="mt-1 space-y-2">
        {players.map((player) => {
          const number = player.jersey_number;
          return (
            <li key={`row-${player.id}`}>
              <button
                type="button"
                onClick={() => onPlayerClick(player)}
                className="flex min-h-[76px] w-full items-center overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(100deg,rgba(28,28,31,0.96),rgba(10,10,12,0.98))] px-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition hover:border-red-500/30 hover:bg-white/[0.06] active:scale-[0.99]"
              >
                <div className="relative -mb-3 mr-3 h-[76px] w-[66px] shrink-0 self-end overflow-hidden">
                  <img src={playerImage(player)} alt="" className="h-full w-full object-contain object-bottom" />
                </div>
                <span className="w-14 shrink-0 border-l border-white/10 pl-3 text-[28px] font-black leading-none text-white">
                  {number ?? "–"}
                </span>
                <span className="min-w-0 flex-1 truncate pl-3 text-[16px] font-bold text-white/92">
                  {premiumPlayerDisplayName(player)}
                </span>
                <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-white/65" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
