import React from "react";
import { TRAINING_CHALLENGE_TYPES } from "../../../lib/trainingChallengeTypes";
import { podiumMedal } from "../../../lib/trainingRanking";

const PROFILE_GLASS_PANEL =
  "overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.22)] bg-gradient-to-br from-[rgba(18,18,20,0.98)] to-[rgba(60,10,18,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_rgba(220,38,38,0.08)]";

export function ProfileTrainingKaiserStatus({ rank }: { rank: number | null }) {
  if (rank == null || rank <= 0) return null;

  const medal = podiumMedal(rank);
  const label =
    rank <= 3 && medal
      ? `${medal} Trainingskaiser #${rank}`
      : rank <= 10
        ? `Top 10 Trainingsranking #${rank}`
        : null;

  if (!label) return null;

  return (
    <div className="mt-3 rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/40 to-[rgba(8,8,10,0.72)] px-3 py-2 shadow-[0_0_20px_rgba(251,191,36,0.12)]">
      <p className="whitespace-nowrap text-[12px] font-semibold text-amber-100/95">{label}</p>
    </div>
  );
}

export function ProfileTrainingAwardsSection() {
  return (
    <div className={`mt-4 p-3 sm:p-3.5 ${PROFILE_GLASS_PANEL}`}>
      <h4 className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-300/85">
        <span className="mr-1" aria-hidden>
          🏆
        </span>
        Auszeichnungen
      </h4>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {TRAINING_CHALLENGE_TYPES.map((challenge) => (
          <div
            key={challenge.id}
            className="rounded-xl border border-[rgba(220,38,38,0.14)] bg-[rgba(8,8,10,0.72)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <p className="whitespace-nowrap text-[11px] font-semibold text-white/88">
              <span aria-hidden>{challenge.emoji}</span> {challenge.title}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-amber-200/65">
              {challenge.placeholderHint}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileGoalkeeperStatsPlaceholder() {
  return (
    <div className={`mt-4 p-3 sm:p-3.5 ${PROFILE_GLASS_PANEL}`}>
      <h4 className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-300/85">
        <span className="mr-1" aria-hidden>
          🥅
        </span>
        Torwartwerte
      </h4>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {["Zu-Null-Spiele", "Gegentore", "Paraden"].map((label) => (
          <div
            key={label}
            className="rounded-xl border border-[rgba(220,38,38,0.14)] bg-[rgba(8,8,10,0.72)] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <p className="text-[9px] font-medium leading-snug text-white/40">{label}</p>
            <p className="mt-1 text-[14px] font-bold tabular-nums text-white/35">—</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-amber-200/65">
        Demnächst verfügbar
      </p>
    </div>
  );
}
