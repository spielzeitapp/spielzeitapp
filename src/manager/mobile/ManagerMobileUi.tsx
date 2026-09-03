import React from 'react';
import { Dumbbell, MapPin, Trophy } from 'lucide-react';
import type { ManagerMobileEvent } from './useManagerMobileEvents';
import { normalizeOefbImportedTeamName } from '../../lib/oefbTeamNameNormalize';

export function formatManagerEventDate(iso: string): { day: string; date: string; time: string } {
  const value = new Date(iso);
  const day = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', weekday: 'short' }).format(value);
  const date = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', day: '2-digit', month: '2-digit' }).format(value);
  const time = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' }).format(value);
  return { day, date, time };
}

export function managerEventTitle(event: ManagerMobileEvent): string {
  if (event.kind === 'match' || event.type === 'game') {
    const opponent = normalizeOefbImportedTeamName(event.opponent) || 'Gegner offen';
    return event.is_home === false ? `Auswärts gegen ${opponent}` : `Heim gegen ${opponent}`;
  }
  if (event.kind === 'training' || event.type === 'training') return 'Training';
  if (event.kind === 'tournament') return event.opponent?.trim() || 'Turnier';
  return event.notes?.trim() || 'Vereinstermin';
}

export function ManagerEventCard({ event }: { event: ManagerMobileEvent }): React.ReactElement {
  const date = formatManagerEventDate(event.starts_at);
  const training = event.kind === 'training' || event.type === 'training';
  return (
    <article className="flex min-h-[92px] overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#171719] to-[#0b0b0d] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
      <div className="flex w-[70px] shrink-0 flex-col items-center justify-center border-r border-red-500/15 bg-red-950/25">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">{date.day}</span>
        <span className="mt-0.5 text-[19px] font-black text-white">{date.date}</span>
        <span className="text-[11px] text-white/50">{date.time}</span>
      </div>
      <div className="min-w-0 flex-1 px-3 py-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-red-300">
          {training ? <Dumbbell className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
          <span className="truncate">{event.teamLabel}</span>
        </div>
        <p className="mt-1 truncate text-[14px] font-bold text-white">{managerEventTitle(event)}</p>
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-white/45">
          <MapPin className="h-3 w-3 shrink-0" /> {event.location?.trim() || 'Ort noch offen'}
        </p>
      </div>
    </article>
  );
}

export function ManagerMobilePageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }): React.ReactElement {
  return (
    <header className="mb-5">
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-red-300/75">{eyebrow}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-[27px] font-black tracking-tight text-white">{title}</h1>
        {children}
      </div>
    </header>
  );
}
