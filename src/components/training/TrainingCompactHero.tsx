import React from 'react';
import { Clock3, MapPin } from 'lucide-react';
import { formatTimeHHmmDe } from '../schedule/scheduleEventViewUtils';
import { formatTournamentDayDate, formatTournamentLocationDisplay } from '../tournament/tournamentCenterUtils';
import { TrainingPlayerIcon } from '../schedule/TrainingPlayerIcon';

type Props = {
  title: string;
  startsAt: string;
  location: unknown;
  coverUrl?: unknown;
};

export function TrainingCompactHero({ title, startsAt, location, coverUrl }: Props) {
  void coverUrl;
  const timeLabel = formatTimeHHmmDe(startsAt);
  const dateLabel = formatTournamentDayDate(startsAt) || '—';
  const placeLine = formatTournamentLocationDisplay(location);
  const date = new Date(startsAt);
  const day = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', day: '2-digit' }).format(date);
  const month = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', month: 'short' }).format(date);
  const weekday = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', weekday: 'short' }).format(date);

  return (
    <article className="overflow-hidden rounded-2xl border border-red-500/20 bg-[linear-gradient(145deg,rgba(34,8,12,0.98),rgba(7,7,10,0.99))] shadow-[0_16px_40px_rgba(0,0,0,0.32)]">
      <div className="grid grid-cols-[72px_64px_minmax(0,1fr)] items-center gap-2.5 px-3 py-3">
        <div className="flex min-h-[78px] flex-col items-center justify-center rounded-xl border border-red-400/20 bg-black/25 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">{weekday}</span>
          <span className="text-[34px] font-black leading-none text-white">{day}</span>
          <span className="text-[11px] font-bold uppercase text-white/55">{month}</span>
        </div>
        <TrainingPlayerIcon variant="hero" className="h-16 w-16" />
        <div className="min-w-0">
          <p className="truncate text-[18px] font-extrabold leading-tight text-white">{title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-white/75">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-red-300" aria-hidden />
            {timeLabel ? `${timeLabel} Uhr` : dateLabel}
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-white/60">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-red-300" aria-hidden />
            <span className="truncate">{placeLine || 'Ort noch offen'}</span>
          </p>
        </div>
      </div>
    </article>
  );
}
