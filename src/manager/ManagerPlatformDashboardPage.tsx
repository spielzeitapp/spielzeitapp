import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  AlertTriangle,
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
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${props.warning ? 'border-amber-200' : 'border-slate-200'}`}>
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

export function ManagerPlatformDashboardPage(): React.ReactElement {
  const { backendRole, loading: sessionLoading } = useSession();
  const allowed = isPlatformAdminRole(backendRole);
  const [stats, setStats] = useState<PlatformDashboardStats | null>(null);
  const [clubs, setClubs] = useState<ClubListRow[]>([]);
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
    if (allowed) void reload();
  }, [allowed, reload]);

  if (sessionLoading) return <p className="text-[14px] text-slate-600">Sitzung wird geladen…</p>;
  if (!allowed) return <Navigate to="/manager" replace />;

  const activeClubs = clubs.filter((club) => club.status === 'active');
  const needsAttention = activeClubs.filter((club) => club.active_season_count === 0 || club.staff_admin_count === 0);

  return (
    <>
    <div className="min-h-full space-y-5 bg-[#050506] px-4 pb-8 pt-6 text-white md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-400">Plattform</p>
          <h1 className="mt-2 text-[26px] font-black leading-tight tracking-tight">Deine Verwaltung</h1>
          <p className="mt-2 text-[13px] leading-5 text-white/55">Vereine und Mannschaften im Überblick.</p>
        </div>
        <button type="button" onClick={() => void reload()} className="min-h-11 shrink-0 rounded-xl border border-white/15 bg-white/[0.05] px-3 text-[12px] font-semibold text-white/80">Aktualisieren</button>
      </div>

      {error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-[13px] text-red-100">{error}</p> : null}
      {loading ? <p className="text-[13px] text-white/55">Plattformdaten werden geladen…</p> : null}
      {stats ? (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Vereine', value: stats.active_clubs, icon: Building2 },
            { label: 'Teams', value: stats.teams, icon: UsersRound },
            { label: 'Registrierte Nutzer', value: stats.registered_users, icon: UserRound },
            { label: 'Spieler', value: stats.active_players, icon: UserRound },
            { label: 'Zu prüfen', value: stats.clubs_without_active_season, icon: AlertTriangle, wide: true },
          ].map(({ label, value, icon: Icon, wide }) => (
            <div key={label} className={`min-h-[112px] rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#171719] to-[#0d0d10] p-4 ${wide ? 'col-span-2' : ''}`}>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.1em] text-white/55"><span>{label}</span><Icon className="h-4 w-4 text-red-400" aria-hidden /></div>
              <p className="mt-4 text-[30px] font-black leading-none text-white">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-black">Vereine</h2>
          <Link to="/manager/vereine" className="inline-flex min-h-11 items-center gap-1 text-[12px] font-bold text-red-300">Alle ansehen <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#111114]">
          {activeClubs.map((club) => (
            <Link key={club.id} to={`/manager/vereine/${encodeURIComponent(club.id)}`} className="flex min-h-[76px] items-center gap-3 border-b border-white/[0.08] px-4 last:border-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-950/40 text-red-300"><Building2 className="h-5 w-5" aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-bold">{club.name}</span><span className="mt-0.5 block text-[11px] text-white/50">{club.team_count} Teams · {club.active_player_count} Spieler</span></span>
              {club.active_season_count === 0 || club.staff_admin_count === 0 ? <AlertTriangle className="h-4 w-4 text-amber-400" aria-label="Einrichtung prüfen" /> : <ArrowRight className="h-4 w-4 text-white/35" aria-hidden />}
            </Link>
          ))}
          {!loading && activeClubs.length === 0 ? <p className="p-5 text-[13px] text-white/50">Noch keine aktiven Vereine.</p> : null}
        </div>
      </section>
    </div>
    <div className="hidden w-full max-w-none space-y-5 md:block">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700/80">Plattform</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Plattform-Dashboard</h1>
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
          <StatCard
            label="Einrichtung prüfen"
            value={stats.clubs_without_active_season}
            hint="Vereine ohne aktive Saison"
            icon={<AlertTriangle className="h-5 w-5" />}
            warning={stats.clubs_without_active_season > 0}
          />
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Vereine im Überblick</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">Benutzer, Spieler, Module und letzte Aktivität.</p>
          </div>
          <Link to="/manager/vereine" className="text-[13px] font-semibold text-red-700 hover:text-red-800">Alle Vereine verwalten</Link>
        </div>
        <div className="overflow-x-auto">
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
              {activeClubs.map((club) => (
                <tr key={club.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link to={`/manager/vereine/${encodeURIComponent(club.id)}`} className="font-semibold text-slate-900 hover:text-red-700">{club.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{club.team_count}</td>
                  <td className="px-4 py-3 text-slate-700">{club.active_player_count}</td>
                  <td className="px-4 py-3 text-slate-700">{club.user_count}</td>
                  <td className="px-4 py-3 text-slate-700">{club.enabled_module_count}/{club.available_module_count}</td>
                  <td className="px-4 py-3 text-slate-600">{formatActivity(club.last_activity_at)}</td>
                  <td className="px-4 py-3">
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
        {!loading && activeClubs.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-slate-500">Noch keine aktiven Vereine.</p> : null}
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
