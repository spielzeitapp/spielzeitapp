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
import { listRoster, type RosterPlayer } from '../lib/rosterService';
import { supabase } from '../lib/supabaseClient';

function canAccess(effectiveRole: string, backendRole: string): boolean {
  if ((backendRole ?? '').trim().toLowerCase() === 'admin') return true;
  if (canPrepareNextSeason(effectiveRole) || canPrepareNextSeason(backendRole)) return true;
  const r = (effectiveRole ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach';
}

export function ManagerSeasonRosterPage(): React.ReactElement {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { effectiveRole, backendRole, setViewTeamSeasonId } = useSession();
  const allowed = canAccess(effectiveRole, backendRole);

  const [meta, setMeta] = useState<{
    displayName: string;
    status: string;
    ageGroup: string | null;
  } | null>(null);
  const [players, setPlayers] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const [{ data: ts, error: tsErr }, roster] = await Promise.all([
        supabase
          .from('team_seasons')
          .select('id, status, display_name, age_group, seasons ( name ), teams ( name )')
          .eq('id', seasonId)
          .maybeSingle(),
        listRoster(seasonId, 'all'),
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
                  <Link
                    to={`/app/team/players/${encodeURIComponent(p.id)}`}
                    className="shrink-0 text-[12px] font-semibold text-red-700"
                  >
                    Profil
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
