import React, { useMemo } from 'react';
import { CalendarDays, ChevronRight, Plus, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { useManagerWorkMode } from '../ManagerWorkModeContext';
import { formatManagerEventDate, ManagerMobilePageTitle } from './ManagerMobileUi';
import { useManagerMobileEvents } from './useManagerMobileEvents';

export function ManagerMobileTeamsPage(): React.ReactElement {
  const navigate = useNavigate();
  const { setSelectedTeamSeasonId, setViewTeamSeasonId } = useSession();
  const { contextTeamSeasons, isTrainerMode, isAdministrationMode, selectTrainerTeamSeasonId } = useManagerWorkMode();
  const { events, loading } = useManagerMobileEvents(contextTeamSeasons);
  const nextByTeam = useMemo(() => {
    const result = new Map<string, (typeof events)[number]>();
    for (const event of events) {
      if (new Date(event.starts_at).getTime() < Date.now()) continue;
      if (!result.has(event.team_season_id)) result.set(event.team_season_id, event);
    }
    return result;
  }, [events]);
  const mayCreate = isTrainerMode || isAdministrationMode;

  const openTeam = (id: string) => {
    setViewTeamSeasonId(null);
    if (isTrainerMode) selectTrainerTeamSeasonId(id);
    else setSelectedTeamSeasonId(id);
    navigate('/manager/termine');
  };

  return (
    <div className="min-h-full bg-[#050506] px-4 pb-6 pt-5 text-white">
      <ManagerMobilePageTitle eyebrow="Verein" title="Teams" />
      <p className="-mt-3 mb-5 text-[12px] leading-relaxed text-white/45">Mannschaft auswählen und ihre Trainings- und Spieltermine öffnen.</p>
      {loading ? <p className="text-[13px] text-white/45">Mannschaften werden geladen…</p> : null}
      <div className="space-y-3">
        {contextTeamSeasons.map((team) => {
          const next = nextByTeam.get(team.id);
          const label = team.display_name?.trim() || team.age_group?.trim() || team.team?.name?.trim() || 'Mannschaft';
          const date = next ? formatManagerEventDate(next.starts_at) : null;
          return (
            <section key={team.id} className="rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#171719] to-[#0b0b0d] p-4">
              <button type="button" onClick={() => openTeam(team.id)} className="flex w-full items-center gap-3 text-left">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-red-500/20 bg-red-950/35 text-red-300"><Users className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-black">{label}</span>
                  <span className="mt-1 block truncate text-[11px] text-white/45">{team.season?.name || 'Aktuelle Saison'}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
                <span className="flex min-w-0 items-center gap-2 text-[11px] text-white/50"><CalendarDays className="h-3.5 w-3.5 text-red-300" />{next && date ? `Nächster Termin: ${date.date}, ${date.time}` : 'Kein Termin geplant'}</span>
                {mayCreate ? <Link to="/app/termine" onClick={() => { setViewTeamSeasonId(null); if (isTrainerMode) selectTrainerTeamSeasonId(team.id); else setSelectedTeamSeasonId(team.id); }} className="ml-2 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-red-500/25 bg-red-950/35 px-2.5 text-[11px] font-bold text-red-200"><Plus className="h-3.5 w-3.5" /> Termin</Link> : null}
              </div>
            </section>
          );
        })}
      </div>
      {!loading && contextTeamSeasons.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-[13px] text-white/45">Für dich ist noch keine Mannschaft freigegeben.</p> : null}
    </div>
  );
}
