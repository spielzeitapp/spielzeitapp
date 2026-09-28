/**
 * STEP 4: Historischer / aktueller Saisonkader über team_season_players.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import {
  canPrepareNextSeason,
  formatTeamSeasonContextLabel,
  getSeasonStatusLabel,
  isSeasonArchived,
} from '../lib/seasonLifecycle';
import {
  createRosterPlayer,
  listRoster,
  updateRosterPlayerSeasonFields,
  type RosterPlayer,
} from '../lib/rosterService';
import { getTeamSeasonWritableState } from '../lib/seasonTransition';
import { supabase } from '../lib/supabaseClient';

import { useManagerWorkMode } from './ManagerWorkModeContext';
import type { ManagerWorkMode } from './managerWorkMode';

function canAccess(effectiveRole: string, backendRole: string, workMode: ManagerWorkMode): boolean {
  if (workMode === 'platform_admin' && (backendRole ?? '').trim().toLowerCase() === 'admin') {
    return true;
  }
  if (canPrepareNextSeason(effectiveRole) || canPrepareNextSeason(backendRole)) return true;
  const r = (effectiveRole ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach';
}

export function ManagerSeasonRosterPage(): React.ReactElement {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { effectiveRole, backendRole, setViewTeamSeasonId } = useSession();
  const { workMode } = useManagerWorkMode();
  const allowed = canAccess(effectiveRole, backendRole, workMode);

  const [meta, setMeta] = useState<{
    displayName: string;
    status: string;
    ageGroup: string | null;
  } | null>(null);
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [writableMessage, setWritableMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reloadRoster = async (id: string): Promise<boolean> => {
    const roster = await listRoster(id, 'all');
    if (roster.error) {
      setError(roster.error);
      return false;
    }
    setPlayers(roster.data);
    return true;
  };

  useEffect(() => {
    if (!seasonId) return;
    setViewTeamSeasonId(seasonId);
  }, [seasonId, setViewTeamSeasonId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!seasonId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const [{ data: ts, error: tsErr }, roster, writable] = await Promise.all([
        supabase
          .from('team_seasons')
          .select('id, status, display_name, age_group, seasons ( name ), teams ( name )')
          .eq('id', seasonId)
          .maybeSingle(),
        listRoster(seasonId, 'all'),
        getTeamSeasonWritableState(seasonId),
      ]);
      if (cancelled) return;
      if (tsErr) {
        setError(tsErr.message);
        setLoading(false);
        return;
      }
      if (!ts) {
        setError('Saison nicht gefunden.');
        setLoading(false);
        return;
      }
      const team = Array.isArray(ts.teams) ? ts.teams[0] : ts.teams;
      const season = Array.isArray(ts.seasons) ? ts.seasons[0] : ts.seasons;
      const displayName =
        formatTeamSeasonContextLabel({
          displayName: String(ts.display_name ?? '').trim() || null,
          ageGroup: ts.age_group ? String(ts.age_group) : null,
          teamName: team?.name ? String(team.name) : null,
          seasonName: season?.name ? String(season.name) : null,
          status: String(ts.status ?? 'active'),
        }) ||
        'Saison';
      setMeta({
        displayName,
        status: String(ts.status ?? 'active'),
        ageGroup: ts.age_group ? String(ts.age_group) : null,
      });
      setWritableMessage('error' in writable ? writable.error : writable.writable ? null : writable.message);
      if (roster.error) setError(roster.error);
      setPlayers(roster.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  const groups = useMemo(() => {
    const active = players.filter((p) => p.status !== 'paused' && p.status !== 'archived' && p.is_active !== false);
    const paused = players.filter((p) => p.status === 'paused' || p.is_active === false);
    const left = players.filter((p) => p.status === 'archived');
    return { active, paused, left };
  }, [players]);

  if (!allowed) return <Navigate to="/manager" replace />;
  if (!seasonId) return <Navigate to="/manager/saisons" replace />;

  const archived = meta ? isSeasonArchived(meta.status) : false;
  const canEdit = workMode === 'platform_admin' && backendRole?.trim().toLowerCase() === 'admin' && !archived && !writableMessage && !loading && !!meta;

  const clearForm = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setJersey('');
    setPosition('');
    setBirthdate('');
  };

  const editPlayer = (player: RosterPlayer) => {
    setEditingId(player.id);
    setFirstName(player.first_name ?? '');
    setLastName(player.last_name ?? '');
    setJersey(player.jersey_number == null ? '' : String(player.jersey_number));
    setPosition(player.position ?? '');
    setBirthdate(player.birthdate?.slice(0, 10) ?? '');
    setNotice(null);
    setError(null);
  };

  const savePlayer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !seasonId || saving) return;
    setError(null);
    setNotice(null);
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setError('Vorname und Nachname sind erforderlich.');
      return;
    }
    const number = jersey.trim() === '' ? null : Number(jersey);
    if (number != null && (!Number.isSafeInteger(number) || number <= 0)) {
      setError('Bitte eine positive ganze Rückennummer eingeben.');
      return;
    }
    if (number != null && players.some((p) => p.id !== editingId && p.jersey_number === number && p.status !== 'archived')) {
      setError(`Rückennummer ${number} ist bereits vergeben.`);
      return;
    }
    setSaving(true);
    try {
      const writable = await getTeamSeasonWritableState(seasonId);
      if ('error' in writable || !writable.writable) {
        setError('error' in writable ? writable.error : writable.message);
        return;
      }
      if (editingId) {
        const result = await updateRosterPlayerSeasonFields({
          playerId: editingId, teamSeasonId: seasonId, firstName: first, lastName: last,
          jerseyNumber: number, position: position.trim() || null,
        });
        if (!result.ok) {
          setError(result.error ?? 'Spieler konnte nicht gespeichert werden.');
          return;
        }
        const { error: profileError } = await supabase.from('player_profiles').upsert(
          { player_id: editingId, birthdate: birthdate || null, updated_at: new Date().toISOString() },
          { onConflict: 'player_id' },
        );
        if (profileError) {
          setError(`Spieler gespeichert, Geburtsdatum nicht gespeichert: ${profileError.message}`);
          await reloadRoster(seasonId);
          return;
        }
      } else {
        const result = await createRosterPlayer({
          teamSeasonId: seasonId, firstName: first, lastName: last,
          jerseyNumber: number, position: position.trim() || null, birthdateIso: birthdate || null,
        });
        if (result.error) {
          setError(result.error);
          if (result.playerId) await reloadRoster(seasonId);
          return;
        }
      }
      const refreshed = await reloadRoster(seasonId);
      if (!refreshed) return;
      clearForm();
      setNotice('Spieler im Saisonkader gespeichert.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen. Bitte den Kader neu laden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          <Link to="/manager/saisons" className="hover:text-red-700">
            Saisonen
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {meta?.displayName ?? 'Saisonkader'}
        </h1>
        {meta ? (
          <p className="mt-1 text-[14px] text-slate-500">
            {getSeasonStatusLabel(meta.status)}
            {meta.ageGroup ? ` · ${meta.ageGroup}` : ''}
          </p>
        ) : null}
      </header>

      {archived ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-700">
          Du siehst eine abgeschlossene Saison. Der Kader bleibt historisch lesbar und wird nicht
          verändert.
        </div>
      ) : null}
      {writableMessage && !archived ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">{writableMessage}</p>
      ) : null}

      {canEdit ? (
        <form onSubmit={(event) => void savePlayer(event)} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 xl:max-w-3xl">
          <h2 className="text-[16px] font-semibold text-slate-900">{editingId ? 'Spieler bearbeiten' : 'Spieler zum Kader hinzufügen'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-medium text-slate-700">Vorname *<input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-[13px] font-medium text-slate-700">Nachname *<input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-[13px] font-medium text-slate-700">Rückennummer<input type="number" min="1" step="1" value={jersey} onChange={(e) => setJersey(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-[13px] font-medium text-slate-700">Position<input value={position} onChange={(e) => setPosition(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-[13px] font-medium text-slate-700">Geburtsdatum (optional)<input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          </div>
          <p className="text-[12px] text-slate-500">Das Spielerfoto kann später im Spielerprofil ergänzt werden.</p>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-red-700 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{saving ? 'Speichern…' : editingId ? 'Änderungen speichern' : 'Spieler anlegen'}</button>
            {editingId ? <button type="button" onClick={clearForm} disabled={saving} className="text-[13px] font-semibold text-slate-600">Abbrechen</button> : null}
          </div>
        </form>
      ) : null}

      {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">{notice}</p> : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </div>
      ) : null}
      {loading ? <p className="text-[13px] text-slate-400">Kader wird geladen…</p> : null}

      {!loading && players.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-[13px] text-slate-500">
          Keine Spieler in dieser Saison zugeordnet.
        </p>
      ) : null}

      {(
        [
          ['Aktiv', groups.active],
          ['Pausiert', groups.paused],
          ['Ausgeschieden / archiviert', groups.left],
        ] as const
      ).map(([label, list]) =>
        list.length === 0 ? null : (
          <section key={label} className="space-y-2">
            <h2 className="text-[13px] font-semibold text-slate-800">
              {label} ({list.length})
            </h2>
            <ul className="space-y-2">
              {list.map((p) => (
                <li
                  key={p.id}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {p.cutout_url ? (
                      <img
                        src={p.cutout_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-500">
                        {(p.first_name?.[0] ?? '?').toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{p.display_name}</p>
                      <p className="text-[12px] text-slate-500">
                        {p.jersey_number != null ? `#${p.jersey_number}` : 'ohne Nr.'}
                        {p.position ? ` · ${p.position}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {canEdit ? <button type="button" onClick={() => editPlayer(p)} className="text-[12px] font-semibold text-red-700">Bearbeiten</button> : null}
                    <Link to={`/app/team/players/${encodeURIComponent(p.id)}`} className="text-[12px] font-semibold text-red-700">Profil</Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
