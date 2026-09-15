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
  trainerCount?: number;
  onTrainerSelect?: (index: number) => void;
};

const PLAYER_PLACEHOLDER = "/avatars/player-placeholder.png";
const GOALKEEPER_PLACEHOLDER = "/avatars/player-placeholder-goalkeeper.png";

function isGoalkeeper(player: PlayerItem): boolean {
  const position = (player.position ?? "").trim().toLocaleLowerCase("de");
  return (
    player.jersey_number === 1 ||
    player.jersey_number === 21 ||
    position === "tw" ||
    position === "torwart" ||
    position === "tormann" ||
    position === "goalkeeper" ||
    position.startsWith("tor")
  );
}

function playerPlaceholder(player: PlayerItem): string {
  return isGoalkeeper(player) ? GOALKEEPER_PLACEHOLDER : PLAYER_PLACEHOLDER;
}

function demoPlayerMedia(player: PlayerItem): string {
  return getDemoPlayerPortraitUrl(player.jersey_number, `${player.id}|${player.display_name ?? ""}`);
}

export function playerMedia(player: PlayerItem, isDemo: boolean): { src: string; fallbackSrc: string; isCutout: boolean; isUpperBodyDemo: boolean } {
  const fallbackSrc = playerPlaceholder(player);
  const cutout = (player.cutout_url ?? "").trim();
  if (cutout) return { src: cutout, fallbackSrc, isCutout: true, isUpperBodyDemo: false };
  const avatar = (player.avatar_url ?? "").trim();
  if (avatar) {
    return {
      src: avatar,
      fallbackSrc,
      isCutout: false,
      isUpperBodyDemo: isDemoUpperBodyPortraitUrl(avatar),
    };
  }
  if (isDemo) return { src: demoPlayerMedia(player), fallbackSrc, isCutout: false, isUpperBodyDemo: true };
  return { src: fallbackSrc, fallbackSrc, isCutout: false, isUpperBodyDemo: true };
}

export function playerCardName(player: PlayerItem): string {
  const firstName = (player.first_name ?? "").trim();
  if (firstName) return firstName;
  return premiumPlayerDisplayName(player).split(/\s+/)[0] || "Spieler";
}

export function playerCardFamilyName(player: PlayerItem): string {
  const lastName = (player.last_name ?? "").trim();
  if (lastName) return lastName;
  const nameParts = premiumPlayerDisplayName(player).trim().split(/\s+/);
  return nameParts.slice(1).join(" ") || "";
}

export const TeamSquadShowcase: React.FC<Props> = ({
  players,
  onPlayerClick,
  onSwipePastEnd,
  trainerCount = 0,
  onTrainerSelect,
}) => {
  const demo = useDemoMode();
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
          const slider = sliderRef.current;
          if (!start || !slider || !onSwipePastEnd) return;
          const endX = event.changedTouches[0]?.clientX ?? start.x;
          const maxScroll = Math.max(0, slider.scrollWidth - slider.clientWidth);
          const reachedEnd = start.atEnd || slider.scrollLeft >= maxScroll - 8;
          if (reachedEnd && endX - start.x < -45) onSwipePastEnd();
        }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[12%] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 sm:px-[18%]"
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
              className="sz-club-showcase-card group relative aspect-square w-[76vw] min-w-[238px] max-w-[292px] shrink-0 snap-center overflow-hidden rounded-[20px] border text-left transition active:scale-[0.985] sm:w-[300px] sm:max-w-[300px] sm:rounded-[22px]"
            >
              <div className="sz-club-diagonal-lines absolute inset-0" aria-hidden />
              {number != null ? (
                <span className="absolute left-5 top-5 z-10 text-[56px] font-black leading-none tracking-[-0.06em] text-white/90 sm:text-[66px]">
                  {number}
                </span>
              ) : null}
              <img
                src={media.src}
                alt=""
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = media.fallbackSrc;
                }}
                style={{
                  WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 58%, transparent 76%)",
                  maskImage: "linear-gradient(to bottom, #000 0%, #000 58%, transparent 76%)",
                }}
                className={`absolute inset-0 h-full w-full transition duration-300 ${media.isUpperBodyDemo ? "sz-club-placeholder-player" : ""} ${
                  media.isCutout
                    ? "origin-top scale-[1.78] object-contain object-top group-hover:scale-[1.82]"
                    : media.isUpperBodyDemo
                      ? "origin-top scale-[1.22] object-contain object-top group-hover:scale-[1.25]"
                    : "origin-top scale-[0.99] object-cover object-top group-hover:scale-[1.02]"
                }`}
              />
              <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black via-black/75 to-transparent" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
                <p className="truncate text-[25px] font-black uppercase leading-none tracking-tight text-white sm:text-[28px]">
                  {playerCardName(player)}
                </p>
                {playerCardFamilyName(player) ? (
                  <p className="mt-1 truncate text-[19px] font-black uppercase leading-none tracking-[0.035em] text-white sm:text-[21px]">
                    {playerCardFamilyName(player)}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {players.length > 1 ? (
        <div className="mb-3 mt-1 flex items-center justify-center gap-1.5" aria-label="Spieler oder Trainer auswählen">
          {players.map((player, index) => (
            <button
              key={`showcase-dot-${player.id}`}
              type="button"
              onClick={() => scrollToCard(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index ? "sz-club-slider-dot-active w-5" : "w-2 bg-white/25 hover:bg-white/45"
              }`}
              aria-label={`${premiumPlayerDisplayName(player)} anzeigen`}
              aria-current={activeIndex === index ? "true" : undefined}
            />
          ))}
          {trainerCount > 0 && onTrainerSelect ? (
            <>
              <span className="mx-0.5 h-3 w-px bg-white/30" aria-hidden />
              {Array.from({ length: trainerCount }, (_, index) => (
                <button
                  key={`trainer-continuation-${index}`}
                  type="button"
                  onClick={() => onTrainerSelect(index)}
                  className="h-2 w-3 rounded-full bg-white/35 transition hover:bg-white/55 active:scale-90"
                  aria-label={`Trainer ${index + 1} anzeigen`}
                />
              ))}
            </>
          ) : null}
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
                className="sz-club-list-card sz-club-surface sz-club-surface--quiet flex min-h-[78px] w-full items-center overflow-hidden rounded-[14px] border px-2.5 text-left transition active:scale-[0.99]"
              >
                <div className="relative -mb-2.5 mr-2.5 h-[68px] w-[58px] shrink-0 self-end overflow-hidden">
                  <img
                    src={media.src}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = media.fallbackSrc;
                    }}
                    className={`h-full w-full object-bottom ${media.isUpperBodyDemo ? "sz-club-placeholder-player" : ""} ${
                      media.isCutout
                        ? "origin-bottom scale-[1.45] object-contain"
                        : media.isUpperBodyDemo
                          ? "object-contain"
                          : "object-cover"
                    }`}
                  />
                </div>
                <span className="sz-club-number-divider w-12 shrink-0 border-l pl-2.5 text-[25px] font-black leading-none text-white">
                  {number ?? "–"}
                </span>
                <span className="min-w-0 flex-1 pl-2.5">
                  <span className="block truncate text-[13px] font-semibold leading-tight text-white/55 sm:text-[14px]">
                    {playerCardName(player)}
                  </span>
                  <span className="block truncate text-[17px] font-black leading-tight text-white sm:text-[18px]">
                    {playerCardFamilyName(player) || premiumPlayerDisplayName(player)}
                  </span>
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
