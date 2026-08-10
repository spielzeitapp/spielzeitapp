import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { TrainingSessionParticipation } from '../../lib/teamTrainingParticipationStats';
import { participationPctBadgeClass } from '../../lib/trainingAttendance';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { cn } from '../../ui/lib/cn';

type Props = {
  sessions: TrainingSessionParticipation[];
  loading?: boolean;
  limit?: number;
};

function formatTrainingDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: VIENNA_TZ,
  }).format(d);
}

function formatCompactCounts(counts: TrainingSessionParticipation['counts']): string {
  return `${counts.present} Dabei · ${counts.absent} Abwesend`;
}

export const TeamTrainingSessionsList: React.FC<Props> = ({
  sessions,
  loading = false,
  limit = 6,
}) => {
  const items = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
        .slice(0, limit),
    [sessions, limit],
  );

  if (loading) {
    return <p className="text-[12px] text-white/55">Lade Trainingsübersicht…</p>;
  }

  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.22)] bg-gradient-to-br from-[rgba(18,18,20,0.98)] to-[rgba(60,10,18,0.18)] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_rgba(220,38,38,0.08)]">
      <p className="whitespace-nowrap text-[11px] font-medium tracking-wide text-white/50">
        Beteiligung je Training
      </p>
      <ul className="mt-2.5 space-y-2">
        {items.map((session) => {
          const { counts, participationPct } = session;
          return (
            <li key={session.eventId}>
              <Link
                to={`/app/events/${session.eventId}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-[rgba(220,38,38,0.14)] bg-[rgba(8,8,10,0.72)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[rgba(220,38,38,0.32)] hover:bg-[rgba(12,8,10,0.88)] hover:shadow-[0_0_20px_rgba(220,38,38,0.1)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="whitespace-nowrap text-[13px] font-semibold text-white group-hover:text-white">
                    {formatTrainingDate(session.startsAt)}
                  </p>
                  <p className="mt-0.5 hidden whitespace-nowrap text-[11px] text-white/45 min-[400px]:block">
                    {formatCompactCounts(counts)}
                    {counts.sick > 0 ? ` · Krank ${counts.sick}` : ''}
                    {counts.injured > 0 ? ` · Verletzt ${counts.injured}` : ''}
                    {counts.external > 0 ? ` · LAZ ${counts.external}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      'inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[13px] font-bold tabular-nums',
                      participationPct != null
                        ? participationPctBadgeClass(participationPct)
                        : 'border-white/10 bg-white/5 text-white/40',
                    )}
                  >
                    {participationPct != null ? `${participationPct} %` : '—'}
                  </span>
                  <p className="mt-1 whitespace-nowrap text-[10px] text-white/45 min-[400px]:hidden">
                    {formatCompactCounts(counts)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
