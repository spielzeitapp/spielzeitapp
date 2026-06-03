import React from 'react';
import { Trophy } from 'lucide-react';
import {
  computeTournamentHeroSummary,
  formatTournamentKickoffTime,
  type TournamentMatchSlotView,
  type TournamentParticipant,
} from '../../lib/tournamentPlan';

type Props = {
  tournamentTitle: string;
  participants: TournamentParticipant[];
  slots: TournamentMatchSlotView[];
  loading?: boolean;
};

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold tabular-nums leading-none text-white">{value}</p>
    </div>
  );
}

export const TournamentHeroCard: React.FC<Props> = ({
  tournamentTitle,
  participants,
  slots,
  loading = false,
}) => {
  const summary = computeTournamentHeroSummary(participants, slots);
  const nextTime = summary.nextMatch ? formatTournamentKickoffTime(summary.nextMatch.kickoff_at) : null;
  const nextOpponent = summary.nextMatch?.opponent_name?.trim() ?? '';

  return (
    <div className="relative -mx-1 overflow-hidden rounded-[18px] border border-purple-500/30 bg-[linear-gradient(165deg,#221830_0%,#0c0a12_46%,#1a1024_100%)] px-4 py-4 shadow-[0_16px_48px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.07),0_0_40px_rgba(168,85,247,0.08)] sm:mx-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(251,191,36,0.12)_0%,transparent_55%)]" aria-hidden />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-[rgba(88,62,12,0.35)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-100">
            <Trophy className="h-3.5 w-3.5 text-amber-300" strokeWidth={2} aria-hidden />
            Turnier
          </span>
        </div>

        <h2 className="text-[22px] font-bold leading-[1.15] tracking-tight text-white sm:text-[26px]">
          {tournamentTitle}
        </h2>

        {loading ? (
          <p className="mt-3 text-[14px] text-white/55">Lade Turnier…</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatPill label="Mannschaften" value={summary.teamCount} />
              <StatPill label="Gruppen" value={summary.groupCount} />
              <StatPill label="Spiele" value={summary.matchCount} />
            </div>

            <div className="mt-4 border-t border-white/10 pt-3.5">
              {summary.allFinished ? (
                <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-amber-200/85">
                  Turnier abgeschlossen
                </p>
              ) : summary.nextMatch ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-purple-300/80">
                    Nächstes Spiel
                  </p>
                  <div className="mt-1.5 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                    <span className="text-[22px] font-bold tabular-nums text-white">{nextTime} Uhr</span>
                    <span className="hidden text-[15px] font-medium text-white/55 sm:inline">vs</span>
                    <span className="text-[17px] font-semibold leading-snug text-white break-words line-clamp-2 sm:text-[17px]">
                      {nextOpponent}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-white/55">Keine Turnierspiele geplant</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
