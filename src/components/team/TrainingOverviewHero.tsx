import React, { useMemo } from 'react';
import type { TrainingSessionParticipation } from '../../lib/teamTrainingParticipationStats';
import { participationPctBadgeClass } from '../../lib/trainingAttendance';
import { cn } from '../../ui/lib/cn';

const HERO_CLASS =
  'relative overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3.5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_rgba(220,38,38,0.12),0_10px_32px_rgba(0,0,0,0.45)]';

type Props = {
  sessionsCount: number;
  participationLabel: string;
  sessions: TrainingSessionParticipation[];
  loading?: boolean;
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
}) => {
  const bestSession = useMemo(() => pickBestSession(sessions), [sessions]);
  const showStrongestWeek = useMemo(() => hasStrongestWeek(sessions), [sessions]);

  const trainingsLine =
    sessionsCount > 0
      ? `${sessionsCount} Training${sessionsCount === 1 ? '' : 's'} absolviert`
      : 'Noch keine Trainings';

  return (
    <div className={HERO_CLASS}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(220,38,38,0.16)_0%,transparent_55%)]"
        aria-hidden
      />
      <div className="relative">
        <p className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.16em] text-red-300/90">
          <span className="mr-1" aria-hidden>
            ⚽
          </span>
          Trainingsübersicht
        </p>

        {loading ? (
          <p className="mt-3 text-[13px] text-white/55">Lade Trainingsdaten…</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[12px] text-white/55">Saison</p>
              <p className="mt-0.5 whitespace-nowrap text-[15px] font-bold leading-tight text-white">
                {trainingsLine}
              </p>
              <p className="mt-2 whitespace-nowrap text-[12px] text-white/55">Ø Beteiligung</p>
              <p className="mt-0.5 whitespace-nowrap text-[22px] font-bold tabular-nums leading-none text-white">
                {participationLabel}
              </p>
            </div>

            <div className="min-w-0 border-l border-[rgba(220,38,38,0.18)] pl-3">
              <p className="whitespace-nowrap text-[12px] text-white/55">Beste Einheit</p>
              {bestSession?.participationPct != null ? (
                <>
                  <p
                    className={cn(
                      'mt-0.5 inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[18px] font-bold tabular-nums leading-none',
                      participationPctBadgeClass(bestSession.participationPct),
                    )}
                  >
                    {bestSession.participationPct} %
                  </p>
                  <p className="mt-1.5 whitespace-nowrap text-[11px] text-white/45">Beteiligung</p>
                </>
              ) : (
                <p className="mt-0.5 text-[15px] font-semibold text-white/45">—</p>
              )}
            </div>
          </div>
        )}

        {showStrongestWeek && !loading ? (
          <p className="mt-3 whitespace-nowrap text-[11px] font-medium text-amber-200/85">
            Stärkste Trainingswoche der Saison
          </p>
        ) : null}
      </div>
    </div>
  );
};
