import React, { useMemo, useState } from 'react';
import { CalendarDays, List, MapPinned, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useManagerWorkMode } from '../ManagerWorkModeContext';
import { ManagerEventCard, ManagerMobilePageTitle } from './ManagerMobileUi';
import { useManagerMobileEvents } from './useManagerMobileEvents';

type Filter = 'all' | 'match' | 'training';

export function ManagerMobileSchedulePage(): React.ReactElement {
  const { contextTeamSeasons, isTrainerMode, isAdministrationMode } = useManagerWorkMode();
  const { events, loading, error } = useManagerMobileEvents(contextTeamSeasons);
  const [filter, setFilter] = useState<Filter>('all');
  const upcoming = useMemo(() => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    return events.filter((event) => {
      if (new Date(event.starts_at).getTime() < cutoff) return false;
      if (filter === 'match') return event.kind === 'match' || event.type === 'game';
      if (filter === 'training') return event.kind === 'training' || event.type === 'training';
      return true;
    });
  }, [events, filter]);
  const mayCreate = isTrainerMode || isAdministrationMode;

  return (
    <div className="min-h-full bg-[#050506] px-4 pb-6 pt-5 text-white md:min-h-0 md:rounded-2xl md:bg-white md:text-slate-900">
      <div className="md:hidden">
        <ManagerMobilePageTitle eyebrow="Planung" title="Termine">
          {mayCreate ? (
            <Link to="/app/termine" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#ff2d38] px-3 text-[12px] font-bold text-white shadow-[0_0_24px_rgba(255,45,56,0.25)]">
              <Plus className="h-4 w-4" /> Termin
            </Link>
          ) : null}
        </ManagerMobilePageTitle>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.08] bg-[#111114] p-1.5">
          <button className="rounded-xl bg-red-600 px-2 py-2.5 text-[11px] font-bold" type="button"><List className="mx-auto mb-1 h-4 w-4" />Liste</button>
          <Link to="/app/termine/calendar" className="rounded-xl px-2 py-2.5 text-center text-[11px] font-semibold text-white/55"><CalendarDays className="mx-auto mb-1 h-4 w-4" />Kalender</Link>
          <Link to="/manager/platzbelegung" className="rounded-xl px-2 py-2.5 text-center text-[11px] font-semibold text-white/55"><MapPinned className="mx-auto mb-1 h-4 w-4" />Plätze</Link>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {([['all', 'Alle'], ['match', 'Spiele'], ['training', 'Training']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? 'rounded-full border border-red-400/50 bg-red-950/60 px-4 py-2 text-[12px] font-bold text-red-200' : 'rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[12px] font-semibold text-white/50'}>{label}</button>
          ))}
        </div>

        {error ? <p className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-[12px] text-red-200">{error}</p> : null}
        {loading ? <p className="mt-5 text-[13px] text-white/45">Termine werden geladen…</p> : null}
        {!loading && upcoming.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-white/15 p-6 text-center text-[13px] text-white/45">Keine kommenden Termine.</p> : null}
        <div className="mt-4 space-y-3">{upcoming.map((event) => <Link key={event.id} to={`/app/events/${encodeURIComponent(event.id)}`} className="block"><ManagerEventCard event={event} /></Link>)}</div>
      </div>
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Mobile Terminübersicht</h1>
        <p className="mt-2 text-sm text-slate-500">Am Desktop steht dir weiterhin der vollständige Manager zur Verfügung.</p>
        <Link to="/app/termine" className="mt-4 inline-flex rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">Termine öffnen</Link>
      </div>
    </div>
  );
}
