import React, { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { staffDisplayName, staffRoleLabelDe, type TeamStaffMember } from "../../hooks/useTeamStaff";

type Props = {
  trainers: TeamStaffMember[];
  onTrainerClick: (trainer: TeamStaffMember) => void;
};

function trainerInitials(trainer: TeamStaffMember): string {
  return [trainer.first_name, trainer.last_name]
    .map((part) => (part ?? "").trim().charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TR";
}

export const TeamTrainerShowcase: React.FC<Props> = ({ trainers, onTrainerClick }) => {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isSingleTrainer = trainers.length === 1;

  useEffect(() => {
    setActiveIndex(0);
    sliderRef.current?.scrollTo({ left: 0 });
  }, [trainers]);

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
    <div className="mt-3">
      <div
        ref={sliderRef}
        onScroll={updateActiveCard}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:px-5"
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
              className={`group relative shrink-0 snap-start overflow-hidden rounded-[18px] border border-red-500/35 bg-[linear-gradient(145deg,#171719_0%,#080809_52%,#20090b_100%)] text-left shadow-[0_12px_30px_rgba(0,0,0,0.42)] transition active:scale-[0.985] sm:rounded-[22px] ${
                isSingleTrainer
                  ? "aspect-[16/10] w-[calc(100%-1.5rem)] max-w-none"
                  : "aspect-[4/5] w-[55vw] min-w-[190px] max-w-[220px] sm:w-[240px] sm:max-w-[240px]"
              }`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_28%,rgba(220,38,38,0.25),transparent_46%)]" aria-hidden />
              <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(130deg,transparent_0,transparent_14px,rgba(239,68,68,0.15)_15px,transparent_16px)]" aria-hidden />
              <span className="absolute left-3 top-3 z-10 rounded-full border border-red-400/30 bg-black/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-300">
                {staffRoleLabelDe(trainer.role)}
              </span>
              {photo ? (
                <img
                  src={photo}
                  alt=""
                  className={`absolute bottom-0 right-0 h-full transition duration-300 group-hover:scale-[1.02] ${
                    isSingleTrainer
                      ? "w-[68%] object-contain object-bottom"
                      : trainer.cutout_url
                        ? "w-full object-contain object-bottom"
                        : "w-full object-cover object-top"
                  }`}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-5xl font-black text-white/35">
                  {trainerInitials(trainer)}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-black via-black/80 to-transparent" aria-hidden />
              <div className={`absolute inset-x-0 bottom-0 z-10 p-4 ${isSingleTrainer ? "max-w-[58%]" : ""}`}>
                <p className="text-[22px] font-black uppercase leading-[0.92] tracking-tight text-white sm:text-[25px]">
                  {nameParts[0] || "Trainer"}
                </p>
                {nameParts.length > 1 ? (
                  <p className="mt-1 text-[16px] font-black uppercase leading-none tracking-[0.04em] text-white/92 sm:text-[18px]">
                    {nameParts.slice(1).join(" ")}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {trainers.length > 1 ? (
        <div className="mb-3 mt-1 flex justify-center gap-1.5" aria-label="Trainer auswählen">
          {trainers.map((trainer, index) => (
            <button
              key={`trainer-dot-${trainer.user_id}-${trainer.role}`}
              type="button"
              onClick={() => scrollToCard(index)}
              className={`h-2 rounded-full transition-all ${
                activeIndex === index ? "w-5 bg-red-500" : "w-2 bg-white/25 hover:bg-white/45"
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
          return (
            <li key={`trainer-row-${trainer.user_id}-${trainer.role}`}>
              <button
                type="button"
                onClick={() => onTrainerClick(trainer)}
                className="flex min-h-[68px] w-full items-center overflow-hidden rounded-[14px] border border-white/10 bg-[linear-gradient(100deg,rgba(24,24,27,0.98),rgba(9,9,11,0.99))] px-2.5 text-left shadow-[0_7px_20px_rgba(0,0,0,0.24)] transition hover:border-red-500/30 active:scale-[0.99]"
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold text-white/95">{staffDisplayName(trainer)}</p>
                  <p className="mt-0.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-red-300/85">
                    {staffRoleLabelDe(trainer.role)}
                  </p>
                </div>
                <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-white/60" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
