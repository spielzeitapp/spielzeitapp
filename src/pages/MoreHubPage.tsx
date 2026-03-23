import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, LayoutGrid, Settings } from 'lucide-react';
import { Card } from '../app/components/ui/Card';
import { useSession } from '../auth/useSession';

const rowClass =
  'flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white transition-colors hover:bg-white/10';

export const MoreHubPage: React.FC = () => {
  const { selectedTeamSeason, setSelectedTeamSeasonId, teamSeasons, effectiveRole } = useSession();
  const canSwitchTeam =
    (teamSeasons?.length ?? 0) > 1 &&
    (effectiveRole === 'trainer' ||
      effectiveRole === 'admin' ||
      effectiveRole === 'head_coach' ||
      effectiveRole === 'co_trainer');

  return (
    <div
      className="page mehr-hub min-h-[60vh] w-full px-4 py-6"
      style={{
        background:
          'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="mx-auto max-w-[560px] space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Mehr</h1>
        <p className="text-sm text-white/60">Einstellungen und weitere Bereiche</p>

        <nav className="space-y-2" aria-label="Mehr-Menü">
          <Link to="/app/nachrichten" className={rowClass}>
            <span className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-red-400" aria-hidden />
              <span className="font-medium">Nachrichten</span>
            </span>
            <ChevronRight className="h-5 w-5 text-white/40" aria-hidden />
          </Link>
          <Link to="/app/table" className={rowClass}>
            <span className="flex items-center gap-3">
              <LayoutGrid className="h-5 w-5 text-red-400" aria-hidden />
              <span className="font-medium">Tabelle</span>
            </span>
            <ChevronRight className="h-5 w-5 text-white/40" aria-hidden />
          </Link>
          <div className={`${rowClass} cursor-not-allowed opacity-60`} title="Demnächst">
            <span className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-white/40" aria-hidden />
              <span className="font-medium">Einstellungen</span>
            </span>
            <span className="text-xs text-white/40">Bald</span>
          </div>
        </nav>

        {canSwitchTeam && (
          <Card className="mt-6 border-white/10 bg-white/5 p-4 text-white">
            <h2 className="text-sm font-semibold text-white/90">Team / Saison</h2>
            <label className="mt-2 block text-xs text-white/60" htmlFor="mehr-team-switch">
              Aktive Auswahl
            </label>
            <select
              id="mehr-team-switch"
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              value={selectedTeamSeason?.id ?? ''}
              onChange={(e) => setSelectedTeamSeasonId(e.target.value)}
            >
              {(teamSeasons ?? []).map((ts) => (
                <option key={ts.id} value={ts.id}>
                  {ts.team?.name ?? 'Team'} · {ts.season?.name ?? 'Saison'}
                </option>
              ))}
            </select>
          </Card>
        )}
      </div>
    </div>
  );
};
