import { ManagerLiveReleasePanel } from './ManagerLiveReleasePanel';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useSession } from '../auth/useSession';
import {
  getPlatformDashboard,
  isPlatformAdminRole,
  listPlatformClubs,
  type ClubListRow,
  type PlatformDashboardStats,
} from '../lib/platformClubAdmin';

function StatCard(props: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  warning?: boolean;
}): React.ReactElement {
  return (
    <div className={`manager-modern-stat rounded-2xl border bg-white p-4 shadow-sm ${props.warning ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-slate-500">{props.label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{props.value}</p>
          <p className="mt-1 text-[12px] text-slate-500">{props.hint}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${props.warning ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
          {props.icon}
        </span>
      </div>
    </div>
  );
}

function formatActivity(value: string | null): string {
  if (!value) return 'Noch keine Aktivität';
  return new Date(value).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ManagerComparisonPlatformDashboardPage({ releaseOnly = false }: { releaseOnly?: boolean } = {}): React.ReactElement {
  const { backendRole, loading: sessionLoading } = useSession();
  const allowed = isPlatformAdminRole(backendRole);
  const [stats, setStats] = useState<PlatformDashboardStats | null>(null);
  const [clubs, setClubs] = useState<ClubListRow[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [statsRes, clubsRes] = await Promise.all([
      getPlatformDashboard(),
      listPlatformClubs({ status: 'all' }),
    ]);
    setStats(statsRes.data);
    setClubs(clubsRes.data);
    setError(statsRes.error ?? clubsRes.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (allowed && !releaseOnly) void reload();
  }, [allowed, releaseOnly, reload]);

  if (sessionLoading) return <p className="text-[14px] text-slate-600">Sitzung wird geladen…</p>;
  if (!allowed) return <Navigate to="/manager" replace />;

  if (releaseOnly) return <div className="p-4 text-slate-900 md:p-6"><ManagerLiveReleasePanel /></div>;

  const activeClubs = clubs.filter((club) => club.status === 'active');
  const needsAttention = activeClubs.filter((club) => club.active_season_count === 0 || club.staff_admin_count === 0);

  const visibleClubs = activeClubs.filter(club => club.name.toLocaleLowerCase('de-AT').includes(query.trim().toLocaleLowerCase('de-AT')) && (filter === 'all' || needsAttention.some(item => item.id === club.id)));

  return (
    <>
    <div className="manager-modern-platform w-full max-w-none space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700/80">Plattform</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Deine Verwaltung</h1>
          <p className="mt-1 max-w-3xl text-[14px] text-slate-600">
            Gesamtüberblick über Vereine, Benutzer, Mannschaften und den Einrichtungsstatus.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Aktualisieren
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div>
      ) : null}
      {loading ? <p className="text-[13px] text-slate-500">Plattformdaten werden geladen…</p> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Aktive Vereine" value={stats.active_clubs} hint={`${stats.archived_clubs} archiviert`} icon={<Building2 className="h-5 w-5" />} />
          <StatCard label="Registrierte Nutzer" value={stats.registered_users} hint={`${stats.users} mit Teamzuordnung`} icon={<UserRound className="h-5 w-5" />} />
          <StatCard label="Mannschaften" value={stats.teams} hint={`${stats.active_seasons} aktive Saisonen`} icon={<UsersRound className="h-5 w-5" />} />
          <StatCard label="Aktive Spieler" value={stats.active_players} hint={`${stats.clubs_without_active_season} Vereine ohne aktive Saison`} icon={<UserRound className="h-5 w-5" />} />
        </div>
      ) : null}

      {!loading && !error && <div className="manager-attention-strip" data-state={needsAttention.length ? 'review' : 'done'}><ShieldCheck size={19} /><span><strong>{needsAttention.length ? `${needsAttention.length} Vereine: Einrichtung offen` : 'Alles im Blick'}</strong><small>{needsAttention.length ? 'Aktive Saison und Verantwortliche prüfen.' : 'Aktive Saisonen und Verantwortliche sind zugeordnet.'}</small></span><Link to="/manager/vereine">Öffnen <ArrowRight size={16} /></Link></div>}
      <div className="manager-club-filters">
        <label><span className="sr-only">Vereine durchsuchen</span><input type="search" placeholder="Verein suchen …" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <select aria-label="Vereine nach Status filtern" value={filter} onChange={event => setFilter(event.target.value as 'all' | 'attention')}><option value="all">Alle aktiven Vereine</option><option value="attention">Einrichtung offen</option></select>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Vereine im Überblick</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">Benutzer, Spieler, Module und letzte Aktivität.</p>
          </div>
          <Link to="/manager/vereine" className="text-[13px] font-semibold text-red-700 hover:text-red-800">Alle Vereine verwalten</Link>
        </div>
        <div className="manager-club-table overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Verein</th>
                <th className="px-4 py-3 font-semibold">Teams</th>
                <th className="px-4 py-3 font-semibold">Spieler</th>
                <th className="px-4 py-3 font-semibold">Benutzer</th>
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="px-4 py-3 font-semibold">Letzte Aktivität</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleClubs.map((club) => (
                <tr key={club.id} className="border-t border-slate-100">
                  <td data-label="Verein" className="px-4 py-3">
                    <Link to={`/manager/vereine/${encodeURIComponent(club.id)}`} className="font-semibold text-slate-900 hover:text-red-700">{club.name}</Link>
                  </td>
                  <td data-label="Teams" className="px-4 py-3 text-slate-700">{club.team_count}</td>
                  <td data-label="Spieler" className="px-4 py-3 text-slate-700">{club.active_player_count}</td>
                  <td data-label="Benutzer" className="px-4 py-3 text-slate-700">{club.user_count}</td>
                  <td data-label="Module" className="px-4 py-3 text-slate-700">{club.enabled_module_count}/{club.available_module_count}</td>
                  <td data-label="Letzte Aktivität" className="px-4 py-3 text-slate-600">{formatActivity(club.last_activity_at)}</td>
                  <td data-label="Status" className="px-4 py-3">
                    {club.active_season_count === 0 || club.staff_admin_count === 0 ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">Einrichtung prüfen</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800"><ShieldCheck className="h-3 w-3" /> Bereit</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && visibleClubs.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-slate-500">Keine Vereine für diese Auswahl.</p> : null}
      </section>

      {needsAttention.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-900">
            <CalendarCheck2 className="h-5 w-5" />
            <h2 className="text-[15px] font-semibold">Einrichtung offen</h2>
          </div>
          <ul className="mt-2 space-y-1 text-[13px] text-amber-950">
            {needsAttention.map((club) => (
              <li key={club.id}>
                <Link className="font-semibold underline" to={`/manager/vereine/${encodeURIComponent(club.id)}`}>{club.name}</Link>
                {club.active_season_count === 0 ? ' · keine aktive Saison' : ''}
                {club.staff_admin_count === 0 ? ' · kein Vereinsadmin/Trainer zugeordnet' : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
    </>
  );
}
