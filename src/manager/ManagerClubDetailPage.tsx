/**
 * ADMIN-ORG.1 – Vereinsdetail: Stammdaten, Abhängigkeiten, Archiv/Löschen.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import {
  adminAssignTeamSeasonStaff,
  adminCreateTeam,
  adminEnsureTeamSeason,
  adminListGrantableVenues,
  archivePlatformClub,
  deleteEmptyPlatformClub,
  getPlatformClub,
  isPlatformAdminRole,
  restorePlatformClub,
  updatePlatformClub,
  type ClubDetail,
  type GrantableVenue,
} from '../lib/platformClubAdmin';
import { useAuth } from '../auth/AuthProvider';
import { ManagerClubVenueGrantsPanel } from './ManagerClubVenueGrantsPanel';

export function ManagerClubDetailPage(): React.ReactElement {
  const { clubId = '' } = useParams();
  const navigate = useNavigate();
  const { backendRole, loading: sessionLoading } = useSession();
  const { user: authUser } = useAuth();
  const allowed = isPlatformAdminRole(backendRole);

  const [detail, setDetail] = useState<ClubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editName, setEditName] = useState('');
  const [editShort, setEditShort] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const [teamName, setTeamName] = useState('');
  const [teamAge, setTeamAge] = useState('U13');
  const [seasonTeamId, setSeasonTeamId] = useState('');
  const [seasonName, setSeasonName] = useState('2026/27');
  const [staffTeamSeasonId, setStaffTeamSeasonId] = useState('');
  const [grantTeamSeasonId, setGrantTeamSeasonId] = useState('');
  const [grantableVenues, setGrantableVenues] = useState<GrantableVenue[]>([]);

  const reload = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    setError(null);
    const res = await getPlatformClub(clubId);
    setDetail(res.data);
    setError(res.error);
    if (res.data) {
      setEditName(res.data.name);
      setEditShort(res.data.short_name ?? '');
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    if (!allowed) return;
    void reload();
  }, [allowed, reload]);

  useEffect(() => {
    if (!allowed) return;
    void (async () => {
      const res = await adminListGrantableVenues();
      if (!res.error) setGrantableVenues(res.data);
    })();
  }, [allowed]);

  useEffect(() => {
    if (!detail) return;
    if (!seasonTeamId && detail.teams[0]) setSeasonTeamId(detail.teams[0].id);
    if (!staffTeamSeasonId && detail.team_seasons[0]) setStaffTeamSeasonId(detail.team_seasons[0].id);
    if (!grantTeamSeasonId && detail.team_seasons[0]) setGrantTeamSeasonId(detail.team_seasons[0].id);
  }, [detail, seasonTeamId, staffTeamSeasonId, grantTeamSeasonId]);

  if (sessionLoading) {
    return <p className="text-[14px] text-slate-600">Sitzung wird geladen…</p>;
  }
  if (!allowed) {
    return <Navigate to="/manager" replace />;
  }

  async function run(action: () => Promise<{ error: string | null }>, okMsg: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await action();
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return false;
    }
    setSuccess(okMsg);
    await reload();
    return true;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId) return;
    await run(
      async () => updatePlatformClub({ clubId, name: editName, shortName: editShort || null }),
      'Stammdaten gespeichert.',
    );
  }

  async function onArchive() {
    if (!clubId) return;
    const ok = await run(async () => archivePlatformClub(clubId), 'Verein archiviert.');
    if (ok) setConfirmArchive(false);
  }

  async function onRestore() {
    if (!clubId) return;
    await run(async () => restorePlatformClub(clubId), 'Verein wiederhergestellt.');
  }

  async function onDelete() {
    if (!clubId || !detail) return;
    setBusy(true);
    setError(null);
    const res = await deleteEmptyPlatformClub({ clubId, confirmName: confirmDeleteName });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    navigate('/manager/vereine', { replace: true });
  }

  const deps = detail?.dependencies;

  return (
    <div className="w-full max-w-none space-y-5">
      <div>
        <Link to="/manager/vereine" className="text-[13px] font-semibold text-red-700 hover:text-red-800">
          ← Zurück zur Übersicht
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {detail?.name ?? 'Verein'}
        </h1>
        {detail ? (
          <p className="mt-1 text-[14px] text-slate-600">
            Status:{' '}
            <span className="font-semibold">
              {detail.status === 'active' ? 'Aktiv' : 'Archiviert'}
            </span>
            {detail.short_name ? ` · Kurzname ${detail.short_name}` : ''}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          {success}
        </div>
      ) : null}

      {loading || !detail ? (
        <p className="text-[14px] text-slate-600">{loading ? 'Laden…' : 'Verein nicht gefunden.'}</p>
      ) : (
        <>
          <form
            onSubmit={onSave}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <h2 className="text-[16px] font-semibold text-slate-900">Stammdaten</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-[13px] font-medium text-slate-700">
                Vereinsname *
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
                />
              </label>
              <label className="block text-[13px] font-medium text-slate-700">
                Kurzname
                <input
                  value={editShort}
                  onChange={(e) => setEditShort(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 px-3 text-[14px]"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              Speichern
            </button>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-[16px] font-semibold text-slate-900">Abhängigkeiten</h2>
            <p className="mt-1 text-[13px] text-slate-600">
              Endgültiges Löschen ist nur möglich, wenn keine relevanten Abhängigkeiten bestehen.
            </p>
            {deps ? (
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-3 lg:grid-cols-4">
                {(
                  [
                    ['Mannschaften', deps.teams],
                    ['Saisonen', deps.team_seasons],
                    ['Mitgliedschaften', deps.memberships],
                    ['Staff', deps.staff_users],
                    ['Anlagen', deps.venues],
                    ['Team-Anlagen', deps.team_venues],
                    ['Felder', deps.venue_fields],
                    ['Zonen', deps.venue_field_zones],
                    ['Platzbelegungen', deps.event_field_assignments],
                    ['Events', deps.events],
                    ['Trainings', deps.training_sessions],
                    ['Übungen', deps.training_exercises],
                  ] as Array<[string, number]>
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h2 className="text-[16px] font-semibold text-slate-900">Mannschaften</h2>
              {detail.teams.length === 0 ? (
                <p className="mt-2 text-[13px] text-slate-600">Keine Mannschaften.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-[13px] text-slate-800">
                  {detail.teams.map((t) => (
                    <li key={t.id}>{t.name}</li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h2 className="text-[16px] font-semibold text-slate-900">Saisonen</h2>
              {detail.team_seasons.length === 0 ? (
                <p className="mt-2 text-[13px] text-slate-600">Keine Saisonen.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-[13px] text-slate-800">
                  {detail.team_seasons.map((s) => (
                    <li key={s.id}>
                      {s.team_name}
                      {s.season_name ? ` · ${s.season_name}` : ''}
                      {s.age_group ? ` · ${s.age_group}` : ''} ({s.status})
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h2 className="text-[16px] font-semibold text-slate-900">Staff / Trainer</h2>
              <p className="mt-1 text-[12px] text-slate-500">
                Bestehende Team-Staff-Rollen (keine neue Rechtearchitektur). Zuordnung über
                Saison/Kader.
              </p>
              {detail.staff.length === 0 ? (
                <p className="mt-2 text-[13px] text-slate-600">Kein Staff zugeordnet.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-[13px] text-slate-800">
                  {detail.staff.map((s) => (
                    <li key={s.user_id}>
                      {[s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unbekannt'}
                      {s.roles?.length ? ` · ${s.roles.join(', ')}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <h2 className="text-[16px] font-semibold text-slate-900">
                Anlagenkatalog / zugeordnete Anlagen
              </h2>
              <p className="mt-1 text-[12px] text-slate-500">
                Diese Liste zeigt vorhandene Anlagen. Für Trainer auswählbar sind nur die unten für
                die Mannschaft/Saison freigegebenen Anlagen.
              </p>
              {detail.venues.length === 0 ? (
                <p className="mt-2 text-[13px] text-slate-600">Keine Anlagen diesem Verein zugeordnet.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-[13px] text-slate-800">
                  {detail.venues.map((v) => (
                    <li key={v.id}>{v.name}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-[16px] font-semibold text-slate-900">Struktur &amp; Freigaben</h2>
            <p className="mt-1 text-[12px] text-slate-500">
              Plattformadmin-Werkzeuge für Mannschaft, Saison, Trainer und Anlagenfreigaben ohne
              Eigentumsübertragung.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <form
                className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!clubId || !teamName.trim()) return;
                  void run(async () => {
                    const res = await adminCreateTeam({
                      clubId,
                      name: teamName.trim(),
                      ageGroup: teamAge.trim() || null,
                    });
                    return { error: res.error };
                  }, 'Mannschaft gespeichert.');
                }}
              >
                <p className="text-[13px] font-semibold text-slate-800">Mannschaft anlegen</p>
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
                  placeholder="Name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
                  placeholder="Altersklasse (z. B. U13)"
                  value={teamAge}
                  onChange={(e) => setTeamAge(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={busy || !teamName.trim()}
                  className="rounded-lg bg-red-700 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Mannschaft speichern
                </button>
              </form>

              <form
                className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!seasonTeamId || !seasonName.trim()) return;
                  void run(async () => {
                    const res = await adminEnsureTeamSeason({
                      teamId: seasonTeamId,
                      seasonName: seasonName.trim(),
                      status: 'active',
                      ageGroup: teamAge.trim() || null,
                    });
                    return { error: res.error };
                  }, 'Saison gespeichert.');
                }}
              >
                <p className="text-[13px] font-semibold text-slate-800">Saison sicherstellen</p>
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
                  value={seasonTeamId}
                  onChange={(e) => setSeasonTeamId(e.target.value)}
                >
                  <option value="">Mannschaft wählen…</option>
                  {detail.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
                  placeholder="Saison (z. B. 2026/27)"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={busy || !seasonTeamId || !seasonName.trim()}
                  className="rounded-lg bg-red-700 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Saison speichern
                </button>
              </form>

              <form
                className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!staffTeamSeasonId || !authUser?.id) return;
                  void run(async () => {
                    const res = await adminAssignTeamSeasonStaff({
                      teamSeasonId: staffTeamSeasonId,
                      userId: authUser.id,
                      role: 'head_coach',
                    });
                    return { error: res.error };
                  }, 'Dich als Trainer (head_coach) zugeordnet.');
                }}
              >
                <p className="text-[13px] font-semibold text-slate-800">Trainer zuordnen</p>
                <p className="text-[12px] text-slate-500">
                  Ordnet dich (aktuelle Session) als head_coach der gewählten Saison zu. Keine
                  E-Mail-Hardcodes. Das ist keine Vereinsadminrolle.
                </p>
                <select
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
                  value={staffTeamSeasonId}
                  onChange={(e) => setStaffTeamSeasonId(e.target.value)}
                >
                  <option value="">Saison wählen…</option>
                  {detail.team_seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.team_name}
                      {s.season_name ? ` · ${s.season_name}` : ''} ({s.status})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={busy || !staffTeamSeasonId || !authUser?.id}
                  className="rounded-lg bg-red-700 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Mich zuordnen
                </button>
              </form>
            </div>

            <div className="mt-4">
              <ManagerClubVenueGrantsPanel
                teamSeasons={detail.team_seasons.map((s) => ({
                  id: s.id,
                  label: `${s.team_name}${s.season_name ? ` · ${s.season_name}` : ''}`,
                }))}
                selectedTeamSeasonId={grantTeamSeasonId}
                onSelectTeamSeason={setGrantTeamSeasonId}
                grantableVenues={grantableVenues}
                busy={busy}
                onBusyError={(err, ok) => {
                  setError(err);
                  setSuccess(ok ?? null);
                }}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-[16px] font-semibold text-slate-900">Aktionen</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.status === 'active' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmArchive(true)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-amber-300 bg-amber-50 px-4 text-[13px] font-semibold text-amber-950 hover:bg-amber-100"
                >
                  Archivieren
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRestore()}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-emerald-300 bg-emerald-50 px-4 text-[13px] font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  Wiederherstellen
                </button>
              )}
              {detail.can_hard_delete ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowDelete(true)}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-red-300 bg-red-50 px-4 text-[13px] font-semibold text-red-800 hover:bg-red-100"
                >
                  Endgültig löschen
                </button>
              ) : (
                <p className="self-center text-[13px] text-slate-600">
                  Endgültiges Löschen nicht möglich – bitte archivieren.
                </p>
              )}
            </div>

            {confirmArchive ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-950">
                <p>
                  Archivieren blendet den Verein aus aktiven Listen aus, löscht aber keine historischen
                  Daten. Fortfahren?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onArchive()}
                    className="inline-flex min-h-[40px] items-center rounded-full bg-amber-800 px-4 text-[12px] font-semibold text-white"
                  >
                    Ja, archivieren
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(false)}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-amber-300 px-4 text-[12px] font-semibold"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : null}

            {showDelete && detail.can_hard_delete ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-900">
                <p>
                  Endgültiges Löschen von <strong>{detail.name}</strong>. Tippe den exakten Vereinsnamen
                  zur Bestätigung.
                </p>
                <input
                  value={confirmDeleteName}
                  onChange={(e) => setConfirmDeleteName(e.target.value)}
                  className="mt-2 min-h-[44px] w-full max-w-md rounded-xl border border-red-200 bg-white px-3"
                  placeholder={detail.name}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || confirmDeleteName !== detail.name}
                    onClick={() => void onDelete()}
                    className="inline-flex min-h-[40px] items-center rounded-full bg-red-700 px-4 text-[12px] font-semibold text-white disabled:opacity-50"
                  >
                    Endgültig löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDelete(false);
                      setConfirmDeleteName('');
                    }}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-red-300 px-4 text-[12px] font-semibold"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
