import React from 'react';
import { Link } from 'react-router-dom';
import type { EventRow } from '../../hooks/useEvents';
import { formatEventTimeVienna } from '../../lib/notifications/format';

type MatchdayCardProps = {
  event: EventRow;
  teamName: string;
  /** z. B. HEUTE IST MATCHDAY / MORGEN IST MATCHDAY / NÄCHSTES SPIEL */
  statusLabel?: string;
};

export const MatchdayCard: React.FC<MatchdayCardProps> = ({
  event,
  teamName,
  statusLabel = 'HEUTE IST MATCHDAY',
}) => {
  const opponent = (event.opponent ?? 'Gegner').trim() || 'Gegner';
  const homeLabel = event.is_home === false ? 'Auswärts' : 'Heim';
  const kickoff = formatEventTimeVienna(event.starts_at);
  const meet = event.meeting_at ? formatEventTimeVienna(event.meeting_at) : null;
  const place = (event.location ?? event.address ?? '').trim() || '—';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-red-500/25 p-6 shadow-lg"
      style={{
        background: 'linear-gradient(145deg, #1a0a0a 0%, #0f0505 45%, #140808 100%)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(239,68,68,0.12)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 80% 0%, rgba(239,68,68,0.35), transparent 55%)',
        }}
      />
      <div className="relative z-[1] space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-red-400/95">{statusLabel}</p>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-white/50">{homeLabel}</p>
            <p className="mt-1 truncate text-2xl font-bold leading-tight text-white sm:text-3xl">{teamName}</p>
          </div>
          <div className="flex shrink-0 items-center justify-center px-2">
            <span className="text-lg font-black text-red-500 sm:text-xl">VS</span>
          </div>
          <div className="min-w-0 flex-1 sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-white/50">Gegner</p>
            <p className="mt-1 truncate text-2xl font-bold leading-tight text-white sm:text-3xl">{opponent}</p>
          </div>
        </div>

        <dl className="grid gap-2 text-sm text-white/85 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Anpfiff</dt>
            <dd className="mt-0.5 text-base font-semibold text-white">{kickoff}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Treffpunkt</dt>
            <dd className="mt-0.5 text-base font-semibold text-white">{meet ?? '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Ort</dt>
            <dd className="mt-0.5 text-base font-semibold text-white">{place}</dd>
          </div>
        </dl>

        <Link
          to={`/app/events/${event.id}`}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-red-500 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-red-600 active:bg-red-700"
        >
          Details &amp; Zu-/Absage
        </Link>
      </div>
    </div>
  );
};
