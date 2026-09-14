import React, { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { staffDisplayName, type TeamStaffMember } from "../../hooks/useTeamStaff";

type Props = {
  trainers: TeamStaffMember[];
  onTrainerClick: (trainer: TeamStaffMember) => void;
  onSwipePastStart?: () => void;
  initialIndex?: number;
};

function trainerInitials(trainer: TeamStaffMember): string {
  return [trainer.first_name, trainer.last_name]
    .map((part) => (part ?? "").trim().charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TR";
}

export const TeamTrainerShowcase: React.FC<Props> = ({
  trainers,
  onTrainerClick,
  onSwipePastStart,
  initialIndex = 0,
}) => {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; atStart: boolean } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const nextIndex = Math.min(Math.max(0, initialIndex), Math.max(0, trainers.length - 1));
    setActiveIndex(nextIndex);
    const slider = sliderRef.current;
    const card = slider?.querySelectorAll<HTMLElement>("[data-trainer-card]")[nextIndex];
    if (slider && card) slider.scrollTo({ left: Math.max(0, card.offsetLeft - 12) });
  }, [initialIndex, trainers]);

  const updateActiveCard = () => {
    const slider = sliderRef.current;
    if (!slider) return;
    const cards = Array.from(slider.querySelectorAll<HTMLElement>("[data-trainer-card]"));
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
    const card = slider?.querySelectorAll<HTMLElement>("[data-trainer-card]")[index];
    if (!slider || !card) return;
    slider.scrollTo({ left: Math.max(0, card.offsetLeft - 12), behavior: "smooth" });
    setActiveIndex(index);
  };

  return (
    <div className="relative mt-3">
      <div
        ref={sliderRef}
        onScroll={updateActiveCard}
        onTouchStart={(event) => {
          const slider = sliderRef.current;
          if (!slider) return;
          swipeStartRef.current = { x: event.touches[0]?.clientX ?? 0, atStart: slider.scrollLeft <= 4 };
        }}
        onTouchEnd={(event) => {
          const start = swipeStartRef.current;
          swipeStartRef.current = null;
          if (!start?.atStart || !onSwipePastStart) return;
          const endX = event.changedTouches[0]?.clientX ?? start.x;
          if (endX - start.x > 45) onSwipePastStart();
        }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[12%] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 sm:px-[18%]"
        aria-label="Trainer-Karussell"
      >
        {trainers.map((trainer) => {
          const photo = (trainer.cutout_url ?? trainer.avatar_url ?? "").trim();
          const nameParts = staffDisplayName(trainer).split(/\s+/).filter(Boolean);
          return (
            <button
              key={`trainer-showcase-${trainer.user_id}-${trainer.role}`}
              data-trainer-card
              type="button"
              onClick={() => onTrainerClick(trainer)}
              className="sz-club-showcase-card group relative aspect-[3/4] w-[76vw] min-w-[238px] max-w-[292px] shrink-0 snap-center overflow-hidden rounded-[20px] border text-left transition active:scale-[0.985] sm:w-[300px] sm:max-w-[300px] sm:rounded-[22px]"
            >
              <div className="sz-club-diagonal-lines absolute inset-0" aria-hidden />
              <span className="absolute left-5 top-5 z-10 text-[56px] font-black uppercase leading-none tracking-[-0.06em] text-white/90 sm:text-[66px]">
                TR
              </span>
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  className={`absolute inset-0 h-full w-full transition duration-300 group-hover:scale-[1.02] ${
                    trainer.cutout_url
                      ? "origin-bottom scale-[1.38] object-contain object-bottom group-hover:scale-[1.43]"
                      : "object-cover object-top"
                  }`}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-5xl font-black text-white/35">
                  {trainerInitials(trainer)}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black via-black/75 to-transparent" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5">
                <p className="truncate text-[25px] font-black uppercase leading-none tracking-tight text-white sm:text-[28px]">
                  {nameParts[0] || "Trainer"}
                </p>
                {nameParts.length > 1 ? (
                  <p className="mt-1 truncate text-[19px] font-black uppercase leading-none tracking-[0.035em] text-white sm:text-[21px]">
                    {nameParts.slice(1).join(" ")}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {trainers.length > 0 ? (
        <div className="mb-3 mt-1 flex justify-center gap-1.5" aria-label="Trainer auswählen">
          {trainers.map((trainer, index) => (
            <button
              key={`trainer-dot-${trainer.user_id}-${trainer.role}`}
              type="button"
              onClick={() => scrollToCard(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index ? "sz-club-slider-dot-active w-5" : "w-2 bg-white/25 hover:bg-white/45"
              }`}
              aria-label={`${staffDisplayName(trainer)} anzeigen`}
              aria-current={activeIndex === index ? "true" : undefined}
            />
          ))}
        </div>
      ) : null}

      <ul className="space-y-2 px-3 pb-8 sm:px-5">
        {trainers.map((trainer) => {
          const photo = (trainer.cutout_url ?? trainer.avatar_url ?? "").trim();
          const nameParts = staffDisplayName(trainer).split(/\s+/).filter(Boolean);
          const firstName = nameParts[0] || "Trainer";
          const familyName = nameParts.slice(1).join(" ");
          return (
            <li key={`trainer-row-${trainer.user_id}-${trainer.role}`}>
              <button
                type="button"
                onClick={() => onTrainerClick(trainer)}
                className="sz-club-list-card sz-club-surface sz-club-surface--quiet flex min-h-[68px] w-full items-center overflow-hidden rounded-[14px] border px-2.5 text-left transition active:scale-[0.99]"
              >
                <div className="relative mr-3 h-[58px] w-[58px] shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                  {photo ? (
                    <img src={photo} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-black text-white/55">
                      {trainerInitials(trainer)}
                    </div>
                  )}
                </div>
                <span className="w-12 shrink-0 border-l border-white/10 pl-2.5 text-[20px] font-black uppercase leading-none text-white">
                  TR
                </span>
                <span className="min-w-0 flex-1 pl-2.5">
                  <span className="block truncate text-[13px] font-semibold leading-tight text-white/55 sm:text-[14px]">
                    {firstName}
                  </span>
                  <span className="block truncate text-[17px] font-black leading-tight text-white sm:text-[18px]">
                    {familyName || staffDisplayName(trainer)}
                  </span>
                </span>
                <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-white/60" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
