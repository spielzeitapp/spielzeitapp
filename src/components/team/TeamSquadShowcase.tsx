import React, { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { PlayerItem } from "../../hooks/usePlayers";
import { getDemoPlayerPortraitUrl, isDemoUpperBodyPortraitUrl } from "../../lib/playerDemoPortrait";
import { premiumPlayerDisplayName } from "../../lib/premiumPlayerCard";
import { useDemoMode } from "../../demo/DemoContext";

type Props = {
  players: PlayerItem[];
  ownPlayerIds: Set<string>;
  onPlayerClick: (player: PlayerItem) => void;
  onSwipePastEnd?: () => void;
  clubTheme?: "default" | "melk";
};

const PLAYER_PLACEHOLDER = "/avatars/player-placeholder.png";

function demoPlayerMedia(player: PlayerItem): string {
  return getDemoPlayerPortraitUrl(player.jersey_number, `${player.id}|${player.display_name ?? ""}`);
}

function playerMedia(player: PlayerItem, isDemo: boolean): { src: string; isCutout: boolean; isUpperBodyDemo: boolean } {
  const cutout = (player.cutout_url ?? "").trim();
  if (cutout) return { src: cutout, isCutout: true, isUpperBodyDemo: false };
  const avatar = (player.avatar_url ?? "").trim();
  if (avatar) {
    return {
      src: avatar,
      isCutout: false,
      isUpperBodyDemo: isDemoUpperBodyPortraitUrl(avatar),
    };
  }
  if (isDemo) return { src: demoPlayerMedia(player), isCutout: false, isUpperBodyDemo: true };
  return { src: PLAYER_PLACEHOLDER, isCutout: false, isUpperBodyDemo: true };
}

function playerCardName(player: PlayerItem): string {
  const firstName = (player.first_name ?? "").trim();
  if (firstName) return firstName;
  return premiumPlayerDisplayName(player).split(/\s+/)[0] || "Spieler";
}

function playerCardFamilyName(player: PlayerItem): string {
  const lastName = (player.last_name ?? "").trim();
  if (lastName) return lastName;
  const nameParts = premiumPlayerDisplayName(player).trim().split(/\s+/);
  return nameParts.slice(1).join(" ") || "";
}

export const TeamSquadShowcase: React.FC<Props> = ({
  players,
  onPlayerClick,
  onSwipePastEnd,
  clubTheme = "default",
}) => {
  const demo = useDemoMode();
  const isMelk = clubTheme === "melk";
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; atEnd: boolean } | null>(null);
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
        onTouchStart={(event) => {
          const slider = sliderRef.current;
          if (!slider) return;
          const maxScroll = Math.max(0, slider.scrollWidth - slider.clientWidth);
          swipeStartRef.current = {
            x: event.touches[0]?.clientX ?? 0,
            atEnd: slider.scrollLeft >= maxScroll - 4,
          };
        }}
        onTouchEnd={(event) => {
          const start = swipeStartRef.current;
          swipeStartRef.current = null;
          if (!start?.atEnd || !onSwipePastEnd) return;
          const endX = event.changedTouches[0]?.clientX ?? start.x;
          if (endX - start.x < -45) onSwipePastEnd();
        }}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:px-5"
        aria-label="Spieler-Karussell"
      >
        {players.map((player) => {
          const number = player.jersey_number;
          const media = playerMedia(player, Boolean(demo));
          return (
            <button
              key={`showcase-${player.id}`}
              data-showcase-card
              type="button"
              onClick={() => onPlayerClick(player)}
              className={`group relative aspect-[4/5] w-[42vw] min-w-[148px] max-w-[172px] shrink-0 snap-start overflow-hidden rounded-[18px] border text-left shadow-[0_12px_30px_rgba(0,0,0,0.42)] transition active:scale-[0.985] sm:w-[210px] sm:max-w-[210px] sm:rounded-[22px] ${
                isMelk
                  ? "border-blue-500/55 bg-[linear-gradient(145deg,#101b34_0%,#070b14_52%,#06152e_100%)]"
                  : "border-red-500/35 bg-[linear-gradient(145deg,#171719_0%,#080809_52%,#20090b_100%)]"
              }`}
            >
              <div
                className={`absolute inset-0 ${
                  isMelk
                    ? "bg-[radial-gradient(circle_at_76%_28%,rgba(37,99,235,0.32),transparent_46%)]"
                    : "bg-[radial-gradient(circle_at_76%_28%,rgba(220,38,38,0.25),transparent_46%)]"
                }`}
                aria-hidden
              />
              <div
                className={`absolute inset-0 opacity-20 ${
                  isMelk
                    ? "[background-image:repeating-linear-gradient(130deg,transparent_0,transparent_14px,rgba(250,204,21,0.18)_15px,transparent_16px)]"
                    : "[background-image:repeating-linear-gradient(130deg,transparent_0,transparent_14px,rgba(239,68,68,0.15)_15px,transparent_16px)]"
                }`}
                aria-hidden
              />
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
                className={`absolute inset-0 h-full w-full transition duration-300 ${
                  media.isCutout
                    ? "origin-bottom scale-[1.55] object-contain object-bottom group-hover:scale-[1.6]"
                    : media.isUpperBodyDemo
                      ? "object-contain object-bottom group-hover:scale-[1.02]"
                    : "object-cover object-center group-hover:scale-[1.02]"
                }`}
              />
              <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black via-black/75 to-transparent" aria-hidden />
              <div className="absolute inset-x-0 bottom-7 z-10 p-3 sm:bottom-0 sm:p-4">
                <p className="truncate text-[20px] font-black uppercase leading-none tracking-tight text-white sm:text-[24px]">
                  {playerCardName(player)}
                </p>
                {playerCardFamilyName(player) ? (
                  <p className="mt-1 truncate text-[14px] font-black uppercase leading-none tracking-[0.06em] text-white/90 sm:text-[16px]">
                    {playerCardFamilyName(player)}
                  </p>
                ) : null}
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
                activeIndex === index
                  ? `w-5 ${isMelk ? "bg-yellow-400" : "bg-red-500"}`
                  : "w-2 bg-white/25 hover:bg-white/45"
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
          const media = playerMedia(player, Boolean(demo));
          return (
            <li key={`row-${player.id}`}>
              <button
                type="button"
                onClick={() => onPlayerClick(player)}
                className={`flex min-h-[68px] w-full items-center overflow-hidden rounded-[14px] border px-2.5 text-left transition active:scale-[0.99] ${
                  isMelk
                    ? "border-blue-500/30 bg-[radial-gradient(circle_at_14%_50%,rgba(37,99,235,0.15),transparent_42%),linear-gradient(100deg,rgba(8,16,35,0.98),rgba(8,8,10,0.99))] shadow-[0_7px_22px_rgba(30,64,175,0.17)] hover:border-blue-400/50 hover:shadow-[0_8px_24px_rgba(30,64,175,0.23)]"
                    : "border-red-500/35 bg-[radial-gradient(circle_at_14%_50%,rgba(220,38,38,0.16),transparent_42%),linear-gradient(100deg,rgba(28,9,12,0.98),rgba(8,8,10,0.99))] shadow-[0_7px_22px_rgba(80,0,8,0.18)] hover:border-red-400/55 hover:shadow-[0_8px_24px_rgba(127,29,29,0.24)]"
                }`}
              >
                <div className="relative -mb-2.5 mr-2.5 h-[68px] w-[58px] shrink-0 self-end overflow-hidden">
                  <img
                    src={media.src}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = PLAYER_PLACEHOLDER;
                    }}
                    className={`h-full w-full object-bottom ${
                      media.isCutout
                        ? "origin-bottom scale-[1.45] object-contain"
                        : media.isUpperBodyDemo
                          ? "object-contain"
                          : "object-cover"
                    }`}
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
