import React, { useMemo } from 'react';
import type { TrainingSessionParticipation } from '../../lib/teamTrainingParticipationStats';
import { participationPctBadgeClass } from '../../lib/trainingAttendance';
import { cn } from '../../ui/lib/cn';

const HERO_CLASS =
  'relative w-full overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3.5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_rgba(220,38,38,0.12),0_10px_32px_rgba(0,0,0,0.45)] sm:px-4 sm:py-4';

type Props = {
  sessionsCount: number;
  participationLabel: string;
  sessions: TrainingSessionParticipation[];
  loading?: boolean;
  className?: string;
};

function pickBestSession(sessions: TrainingSessionParticipation[]): TrainingSessionParticipation | null {
  let best: TrainingSessionParticipation | null = null;
  for (const session of sessions) {
    if (session.participationPct == null) continue;
    if (!best || session.participationPct > (best.participationPct ?? -1)) {
      best = session;
    }
  }
  return best;
}

function hasStrongestWeek(sessions: TrainingSessionParticipation[]): boolean {
  const weekAvgs = new Map<string, number[]>();
  for (const session of sessions) {
    if (session.participationPct == null) continue;
    const d = new Date(session.startsAt);
    if (Number.isNaN(d.getTime())) continue;
    const weekStart = new Date(d);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = weekStart.toISOString().slice(0, 10);
    const list = weekAvgs.get(key) ?? [];
    list.push(session.participationPct);
    weekAvgs.set(key, list);
  }
  if (weekAvgs.size < 2) return false;
  const avgs = [...weekAvgs.values()].map((pcts) => pcts.reduce((sum, p) => sum + p, 0) / pcts.length);
  const max = Math.max(...avgs);
  const min = Math.min(...avgs);
  return max - min >= 8;
}

export const TrainingOverviewHero: React.FC<Props> = ({
  sessionsCount,
  participationLabel,
  sessions,
  loading = false,
  className,
}) => {
  const bestSession = useMemo(() => pickBestSession(sessions), [sessions]);
  const showStrongestWeek = useMemo(() => hasStrongestWeek(sessions), [sessions]);

  const trainingsCountLabel =
    sessionsCount > 0 ? String(sessionsCount) : '—';
  const trainingsSubLabel =
    sessionsCount > 0
      ? `${sessionsCount} Training${sessionsCount === 1 ? '' : 's'} absolviert`
      : 'Noch keine Trainings';

  return (
    <div className={cn(HERO_CLASS, className)}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(220,38,38,0.16)_0%,transparent_55%)]"
        aria-hidden
      />
      <div className="relative w-full">
        <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-red-300/75">
          <span className="mr-1" aria-hidden>
            ⚽
          </span>
          Trainingsübersicht
        </p>

        {loading ? (
          <p className="mt-3 text-[13px] text-white/45">Lade Trainingsdaten…</p>
        ) : (
          <div className="mt-3 grid w-full grid-cols-3 gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[10px] font-medium text-white/35">Saison</p>
              <p className="mt-1 text-[26px] font-extrabold tabular-nums leading-none tracking-tight text-white sm:text-[28px]">
                {trainingsCountLabel}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-white/35">{trainingsSubLabel}</p>
            </div>

            <div className="min-w-0 border-x border-[rgba(220,38,38,0.14)] px-2 sm:px-3">
              <p className="whitespace-nowrap text-[10px] font-medium text-white/35">Ø Trainingsbeteiligung</p>
              <p className="mt-1 text-[26px] font-extrabold tabular-nums leading-none tracking-tight text-white sm:text-[28px]">
                {participationLabel}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-white/35">Ø über gewertete Trainings</p>
            </div>

            <div className="min-w-0 text-right sm:text-left">
              <p className="whitespace-nowrap text-[10px] font-medium text-white/35">Beste Einheit</p>
              {bestSession?.participationPct != null ? (
                <>
                  <p
                    className={cn(
                      'mt-1 inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[22px] font-extrabold tabular-nums leading-none sm:text-[24px]',
                      participationPctBadgeClass(bestSession.participationPct),
                    )}
                  >
                    {bestSession.participationPct} %
                  </p>
                  <p className="mt-1 text-[10px] text-white/35">Beteiligung</p>
                </>
              ) : (
                <p className="mt-1 text-[22px] font-extrabold tabular-nums leading-none text-white/35">—</p>
              )}
            </div>
          </div>
        )}

        {showStrongestWeek && !loading ? (
          <p className="mt-3 whitespace-nowrap text-[10px] font-medium text-amber-200/70">
            Stärkste Trainingswoche der Saison
          </p>
        ) : null}
      </div>
    </div>
  );
};
