import React from 'react';
import { Clock3, MapPin } from 'lucide-react';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { formatTournamentDayDate, formatTournamentLocationDisplay } from '../tournament/tournamentCenterUtils';

type Props = {
  title: string;
  startsAt: string;
  location: unknown;
  coverUrl?: unknown;
  status?: string | null;
  actions?: React.ReactNode;
};

export function TrainingCompactHero({ title, startsAt, location, coverUrl, status, actions }: Props) {
  void coverUrl;
  const timeLabel = formatTimeHHmmDe(startsAt);
  const dateLabel = formatTournamentDayDate(startsAt) || '—';
  const placeLine = formatTournamentLocationDisplay(location);
  const date = new Date(startsAt);
  const day = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', month: 'short' }).format(date);
  const weekday = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', weekday: 'short' }).format(date);

  return (
    <article className="sz-club-surface sz-club-surface--quiet sz-club-list-card overflow-hidden rounded-[18px] border">
      <div className="grid grid-cols-[54px_minmax(0,1fr)] items-center gap-2.5 px-3 py-3">
        <div className="flex min-h-[78px] flex-col items-center justify-center rounded-xl border border-red-400/20 bg-black/25 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">{weekday}</span>
          <span className="text-[34px] font-black leading-none text-white">{day}</span>
          <span className="text-[11px] font-bold uppercase text-white/55">{month}</span>
        </div>

        <div className="min-w-0">
          {status === 'canceled' ? (
            <span className="mb-1.5 inline-flex rounded-full border border-red-400/45 bg-red-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-100">
              Training abgesagt
            </span>
          ) : null}
          <p className="break-words text-[22px] font-extrabold leading-tight text-white">{title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[16px] font-semibold text-white/75">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-red-300" aria-hidden />
            {dateLabel} · {timeLabel ? `${timeLabel} Uhr` : 'Beginn offen'}
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[16px] text-white/60">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-red-300" aria-hidden />
            <span className="truncate">{placeLine || 'Ort noch offen'}</span>
          </p>
        </div>
      </div>
      {actions ? <div className="px-3 pb-3">{actions}</div> : null}
    </article>
  );
}
