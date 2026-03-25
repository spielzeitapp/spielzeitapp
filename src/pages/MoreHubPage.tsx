import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, LayoutGrid, Settings, Wrench } from 'lucide-react';
import { Card } from '../app/components/ui/Card';
import { useSession } from '../auth/useSession';
import { useUnreadCount } from '../hooks/useUnreadCount';

const rowClass =
  'flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white transition-colors hover:bg-white/10';

const subRowClass =
  'flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5 pl-6 text-left text-sm text-white/95 transition-colors hover:bg-white/10';

function isTrainerToolsRole(role: string): boolean {
  const r = (role ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach' || r === 'admin';
}

export const MoreHubPage: React.FC = () => {
  const { selectedTeamSeason, setSelectedTeamSeasonId, teamSeasons, effectiveRole, backendRole, user } = useSession();
  const canSwitchTeam =
    (teamSeasons?.length ?? 0) > 1 &&
    (effectiveRole === 'trainer' ||
      effectiveRole === 'admin' ||
      effectiveRole === 'head_coach' ||
      effectiveRole === 'co_trainer');

  const showTrainerTools = isTrainerToolsRole(effectiveRole);
  const showPreviewLink = backendRole === 'admin' || backendRole === 'head_coach';
  const unreadCount = useUnreadCount(user?.id);

  const [trainerToolsOpen, setTrainerToolsOpen] = useState(false);

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
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex min-h-[17px] min-w-[17px] translate-y-[-1px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-neutral-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
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

          {showTrainerTools && (
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-1 pt-1 text-left text-xs font-semibold uppercase tracking-wide text-white/45"
                onClick={() => setTrainerToolsOpen((v) => !v)}
                aria-expanded={trainerToolsOpen}
              >
                <span className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-red-400/90" aria-hidden />
                  Trainer-Tools
                </span>
                <ChevronRight
                  className={[
                    'h-4 w-4 text-white/35 transition-transform',
                    trainerToolsOpen ? 'rotate-90' : '',
                  ].join(' ')}
                  aria-hidden
                />
              </button>

              {trainerToolsOpen && (
                <>
                  <Link to="/app/mehr/trainer/team-push" className={subRowClass}>
                    <span>Team-Push</span>
                    <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                  </Link>
                  <Link to="/app/mehr/trainer/vorlagen" className={subRowClass}>
                    <span>Vorlagen</span>
                    <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                  </Link>
                  <Link to="/app/mehr/trainer/erinnerungen" className={subRowClass}>
                    <span>Erinnerungen</span>
                    <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                  </Link>
                  {showPreviewLink && (
                    <Link to="/app/mehr/trainer/preview" className={subRowClass}>
                      <span>Ansicht testen als</span>
                      <ChevronRight className="h-4 w-4 text-white/35" aria-hidden />
                    </Link>
                  )}
                </>
              )}
            </div>
          )}

          <Link to="/app/profile" className={rowClass}>
            <span className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-red-400" aria-hidden />
              <span className="font-medium">Einstellungen</span>
            </span>
            <ChevronRight className="h-5 w-5 text-white/40" aria-hidden />
          </Link>
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
