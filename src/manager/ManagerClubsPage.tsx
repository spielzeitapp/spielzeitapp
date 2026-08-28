/**
 * ADMIN-ORG.1 – Vereinsübersicht für Plattformadmins.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import {
  createPlatformClub,
  isPlatformAdminRole,
  listPlatformClubs,
  type ClubListRow,
} from '../lib/platformClubAdmin';

function statusChip(status: string): string {
  if (status === 'active') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export function ManagerClubsPage(): React.ReactElement {
  const navigate = useNavigate();
  const { backendRole, loading: sessionLoading } = useSession();
  const allowed = isPlatformAdminRole(backendRole);

  const [rows, setRows] = useState<ClubListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listPlatformClubs({ status: statusFilter, search: search.trim() || null });
    setRows(res.data);
    setError(res.error);
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    if (!allowed) return;
    void reload();
  }, [allowed, reload]);

  if (sessionLoading) {
    return <p className="text-[14px] text-slate-600">Sitzung wird geladen…</p>;
  }
  if (!allowed) {
    return <Navigate to="/manager" replace />;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createPlatformClub({ name, shortName: shortName || null });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? 'Anlegen fehlgeschlagen.');
      return;
    }
    setShowCreate(false);
    setName('');
    setShortName('');
    navigate(`/manager/vereine/${encodeURIComponent(res.data.id)}`);
  }

  return (
    <div className="w-full max-w-none space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700/80">Verein</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Vereine</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-slate-600">
            Plattformweite Vereinsverwaltung: anlegen, bearbeiten, archivieren. Endgültig löschen nur bei
            leeren Testvereinen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800"
        >
          Verein anlegen
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Name…"
          className="min-h-[44px] min-w-[12rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 shadow-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'archived')}
          className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 shadow-sm"
        >
          <option value="all">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="archived">Archiviert</option>
        </select>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Aktualisieren
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={onCreate}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <h2 className="text-[16px] font-semibold text-slate-900">Neuen Verein anlegen</h2>
          <p className="mt-1 text-[13px] text-slate-600">
            Es werden keine Mannschaften, Saisonen oder Anlagen automatisch erzeugt.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-[13px] font-medium text-slate-700">
              Vereinsname *
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
                placeholder="z. B. USC Rohrbach"
              />
            </label>
            <label className="block text-[13px] font-medium text-slate-700">
              Kurzname (optional)
              <input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
                placeholder="z. B. Rohrbach"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[44px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {busy ? 'Speichern…' : 'Anlegen'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-700"
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-[14px] text-slate-600">Vereine werden geladen…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-[14px] text-slate-600">
          Keine Vereine für diesen Filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Verein</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Mannschaften</th>
                <th className="px-4 py-3 font-semibold">Aktive Saisonen</th>
                <th className="px-4 py-3 font-semibold">Spieler</th>
                <th className="px-4 py-3 font-semibold">Benutzer</th>
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="px-4 py-3 font-semibold">Letzte Aktivität</th>
                <th className="px-4 py-3 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.name}</div>
                    {row.short_name ? (
                      <div className="text-[12px] text-slate-500">{row.short_name}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusChip(
                        row.status,
                      )}`}
                    >
                      {row.status === 'active' ? 'Aktiv' : 'Archiviert'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.team_count}</td>
                  <td className="px-4 py-3 text-slate-700">{row.active_season_count}</td>
                  <td className="px-4 py-3 text-slate-700">{row.active_player_count}</td>
                  <td className="px-4 py-3 text-slate-700">{row.user_count}</td>
                  <td className="px-4 py-3 text-slate-700">{row.enabled_module_count}/{row.available_module_count}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.last_activity_at ? new Date(row.last_activity_at).toLocaleDateString('de-AT') : 'Noch keine'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/manager/vereine/${encodeURIComponent(row.id)}`}
                      className="inline-flex min-h-[40px] items-center font-semibold text-red-700 hover:text-red-800"
                    >
                      Öffnen
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
