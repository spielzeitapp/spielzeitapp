import React, { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { PlayerItem } from "../../hooks/usePlayers";
import { premiumPlayerDisplayName } from "../../lib/premiumPlayerCard";

type Props = {
  players: PlayerItem[];
  ownPlayerIds: Set<string>;
  onPlayerClick: (player: PlayerItem) => void;
};

const PLAYER_PLACEHOLDER = "/avatars/player-placeholder.png";
const DEMO_PLAYER_COUNT = 15;

function isDanielBaumann(player: PlayerItem): boolean {
  return /daniel\s+baumann/i.test(
    `${player.first_name ?? ""} ${player.last_name ?? ""} ${player.display_name ?? ""}`,
  );
}

function stablePlayerDemoIndex(player: PlayerItem): number {
  const key = `${player.id}|${player.display_name ?? ""}`;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % DEMO_PLAYER_COUNT) + 1;
}

function demoPlayerMedia(player: PlayerItem): string {
  const index = stablePlayerDemoIndex(player).toString().padStart(2, "0");
  return `/avatars/demo/demo-player-p${index}.webp`;
}

function playerMedia(player: PlayerItem): { src: string; isCutout: boolean } {
  const cutout = (player.cutout_url ?? "").trim();
  if (cutout) return { src: cutout, isCutout: true };
  const avatar = (player.avatar_url ?? "").trim();
  if (avatar) return { src: avatar, isCutout: false };
  // Bereits vorhandenes Testmotiv; wird nur verwendet, wenn Daniel noch kein Profilbild hat.
  if (isDanielBaumann(player)) return { src: "/avatars/Dani Trans.png", isCutout: false };
  return { src: demoPlayerMedia(player), isCutout: false };
}

function playerCardName(player: PlayerItem): string {
  const firstName = (player.first_name ?? "").trim();
  if (firstName) return firstName;
  return premiumPlayerDisplayName(player).split(/\s+/)[0] || "Spieler";
}

export const TeamSquadShowcase: React.FC<Props> = ({ players, ownPlayerIds, onPlayerClick }) => {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    sliderRef.current?.scrollTo({ left: 0 });
  }, [players]);

  const updateActiveCard = () => {
    const slider = sliderRef.current;
    if (!slider) return;
    const cards = Array.from(slider.querySelectorAll<HTMLElement>("[data-showcase-card]"));
    if (cards.length === 0) return;
    const leadingEdge = slider.scrollLeft + 12;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft - leadingEdge);
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    });
    setActiveIndex(closestIndex);
  };

  const scrollToCard = (index: number) => {
    const slider = sliderRef.current;
    const card = slider?.querySelectorAll<HTMLElement>("[data-showcase-card]")[index];
    if (!slider || !card) return;
    slider.scrollTo({ left: Math.max(0, card.offsetLeft - 12), behavior: "smooth" });
    setActiveIndex(index);
  };

  return (
    <div className="mt-3">
      <div
        ref={sliderRef}
        onScroll={updateActiveCard}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:px-5"
        aria-label="Spieler-Karussell"
      >
        {players.map((player) => {
          const ownPlayer = ownPlayerIds.has(player.id);
          const number = player.jersey_number;
          const media = playerMedia(player);
          return (
            <button
              key={`showcase-${player.id}`}
              data-showcase-card
              type="button"
              onClick={() => onPlayerClick(player)}
              className="group relative aspect-[4/5] w-[42vw] min-w-[148px] max-w-[172px] shrink-0 snap-start overflow-hidden rounded-[18px] border border-red-500/35 bg-[linear-gradient(145deg,#171719_0%,#080809_52%,#20090b_100%)] text-left shadow-[0_12px_30px_rgba(0,0,0,0.42)] transition active:scale-[0.985] sm:w-[210px] sm:max-w-[210px] sm:rounded-[22px]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_28%,rgba(220,38,38,0.25),transparent_46%)]" aria-hidden />
              <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(130deg,transparent_0,transparent_14px,rgba(239,68,68,0.15)_15px,transparent_16px)]" aria-hidden />
              {ownPlayer ? (
                <span className="absolute left-3 top-3 z-20 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-lg">
                  Dein Kind
                </span>
              ) : null}
              {number != null ? (
                <span className="absolute right-2.5 top-2 z-10 text-[28px] font-black leading-none text-white/12 sm:text-[34px]">
                  {number}
                </span>
              ) : null}
              <img
                src={media.src}
                alt=""
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = PLAYER_PLACEHOLDER;
                }}
                className={`absolute inset-0 h-full w-full object-center transition duration-300 group-hover:scale-[1.02] ${
                  media.isCutout ? "object-contain" : "object-cover"
                }`}
              />
              <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black via-black/75 to-transparent" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
                <p className="truncate text-[20px] font-black uppercase leading-none tracking-tight text-white sm:text-[24px]">
                  {playerCardName(player)}
                </p>
                <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-red-400 sm:text-[12px]">
                  {number != null ? `Nr. ${number}` : "Spieler"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {players.length > 1 ? (
        <div className="mb-3 mt-1 flex justify-center gap-1.5" aria-label="Spieler auswählen">
          {players.map((player, index) => (
            <button
              key={`showcase-dot-${player.id}`}
              type="button"
              onClick={() => scrollToCard(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index ? "w-5 bg-red-500" : "w-2 bg-white/25 hover:bg-white/45"
              }`}
              aria-label={`${premiumPlayerDisplayName(player)} anzeigen`}
              aria-current={activeIndex === index ? "true" : undefined}
            />
          ))}
        </div>
      ) : null}

      <ul className="space-y-2 px-3 sm:px-5">
        {players.map((player) => {
          const number = player.jersey_number;
          const media = playerMedia(player);
          return (
            <li key={`row-${player.id}`}>
              <button
                type="button"
                onClick={() => onPlayerClick(player)}
                className="flex min-h-[68px] w-full items-center overflow-hidden rounded-[14px] border border-white/10 bg-[linear-gradient(100deg,rgba(24,24,27,0.98),rgba(9,9,11,0.99))] px-2.5 text-left shadow-[0_7px_20px_rgba(0,0,0,0.24)] transition hover:border-red-500/30 hover:bg-white/[0.06] active:scale-[0.99]"
              >
                <div className="relative -mb-2.5 mr-2.5 h-[68px] w-[58px] shrink-0 self-end overflow-hidden">
                  <img
                    src={media.src}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = PLAYER_PLACEHOLDER;
                    }}
                    className={`h-full w-full object-bottom ${media.isCutout ? "object-contain" : "object-cover"}`}
                  />
                </div>
                <span className="w-12 shrink-0 border-l border-white/10 pl-2.5 text-[25px] font-black leading-none text-white">
                  {number ?? "–"}
                </span>
                <span className="min-w-0 flex-1 truncate pl-2.5 text-[15px] font-bold text-white/92 sm:text-[16px]">
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
