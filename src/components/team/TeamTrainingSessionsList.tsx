import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { TrainingSessionParticipation } from '../../lib/teamTrainingParticipationStats';
import { GlassCard } from '../../ui';

type Props = {
  sessions: TrainingSessionParticipation[];
  loading?: boolean;
  limit?: number;
};

function formatTrainingDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-AT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
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
    <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
        Beteiligung je Training
      </p>
      <ul className="mt-2.5 space-y-2">
        {items.map((session) => {
          const { counts, participationPct } = session;
          return (
            <li key={session.eventId}>
              <Link
                to={`/app/events/${session.eventId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/25 px-3 py-2.5 transition hover:border-red-500/20 hover:bg-white/[0.03]"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white">
                    {formatTrainingDate(session.startsAt)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    Dabei {counts.present} · Abwesend {counts.absent}
                    {counts.sick > 0 ? ` · Krank ${counts.sick}` : ''}
                    {counts.injured > 0 ? ` · Verletzt ${counts.injured}` : ''}
                    {counts.external > 0 ? ` · LAZ ${counts.external}` : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] font-bold tabular-nums text-white">
                  {participationPct != null ? `${participationPct} %` : '—'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
};
