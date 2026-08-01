import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Match, MatchEvent } from '../../types/match';
import type { FieldSlotId } from '../../types/match';
import { supabase } from '../../lib/supabaseClient';
import { MatchTimeline } from './components/MatchTimeline';
import { LiveControls } from './components/LiveControls';
import { MatchStatsTable } from './components/MatchStatsTable';
import { TrainerMatchLineupMvp } from './components/TrainerMatchLineupMvp';
import { useRole } from '../../app/role/RoleContext';
import { useMatchTimer } from '../../hooks/useMatchTimer';
import { useActiveTeamSeason } from '../../hooks/useActiveTeamSeason';
import { usePlayers } from '../../hooks/usePlayers';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { Button } from '../../app/components/ui/Button';
import { isStartelfCompleteForLive } from './lineupGuards';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { fetchLineupForLiveMatch, fetchMatchEvents, LIVE_FIELD_SLOT_ORDER, updateMatchRow } from '../../lib/liveMatchService';
import { getBenchPlayers, getCurrentOnFieldPlayers, sortMatchEventsChronologically, type MatchEngineEvent } from '../../lib/matchEngine';
import { compareRosterPlayers, playerItemToRoster, type RosterPlayer } from '../../lib/rosterPlayer';

type MatchRow = {
  id: string;
  team_season_id: string;
  opponent: string | null;
  match_date: string | null;
  location: string | null;
  status: 'upcoming' | 'live' | 'finished' | null;
  motm_enabled?: boolean | null;
  motm_open_until?: string | null;
  live_started_at?: string | null;
  live_elapsed_seconds?: number | null;
  live_is_running?: boolean | null;
  score_home?: number | null;
  score_away?: number | null;
  live_period?: number | null;
};

function mapRowToMatch(row: MatchRow | null): Match | null {
  if (!row) return null;

  const kickoffISO = row.match_date ?? new Date().toISOString();
  const status = (row.status === 'upcoming' ? 'planned' : (row.status ?? 'planned')) as Match['status'];

  return {
    id: row.id,
    home: { id: row.team_season_id, name: 'Unser Team', shortName: 'Wir', players: [] },
    away: { id: 'away', name: row.opponent ?? 'Gegner', shortName: row.opponent ?? 'Gegner', players: [] },
    kickoffISO,
    status,
    score: { home: Number(row.score_home ?? 0) || 0, away: Number(row.score_away ?? 0) || 0 },
    events: [],
    field: { home: {}, away: {} },
    lineup: { homeStarting: [], homeBench: [], awayStarting: [], awayBench: [] },
    period: ((row.live_period ?? 1) as 1 | 2 | 3) || 1,
    timer: {
      isRunning: Boolean(row.live_is_running),
      startedAtISO: row.live_is_running && row.live_started_at ? row.live_started_at : null,
      accumulatedSeconds: Number(row.live_elapsed_seconds ?? 0) || 0,
    },
  };
}

function sortRosterByNumber(list: RosterPlayer[]): RosterPlayer[] {
  return [...list].sort(compareRosterPlayers);
}

export const MatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const matchId = id ?? searchParams.get('matchId')?.trim() ?? null;

  const { role: uiRole, getBackendRole, canUseLiveControls } = useRole();
  const { teamSeasonId, role: activeRole } = useActiveTeamSeason();
  const activeRoleNormalized = (activeRole ?? '').toLowerCase();

  const backendRole = getBackendRole();
  const operatorMode = backendRole === 'admin' || backendRole === 'trainer' || backendRole === 'head_coach';
  const spectatorMode = !operatorMode;

  const [matchRow, setMatchRow] = useState<MatchRow | null>(null);
  const [localMatch, setLocalMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  /** Wie LiveMatchScreen: lineupData + events + abgeleitete Start-/Kader-IDs. */
  const [lineupData, setLineupData] = useState<{
    startingPlayerIds: string[];
    squadPlayerIds: string[];
  } | null>(null);
  const [events, setEvents] = useState<MatchEngineEvent[]>([]);
  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  const [startingPlayerIds, setStartingPlayerIds] = useState<string[]>([]);

  const effectiveTeamSeasonId = matchRow?.team_season_id ?? teamSeasonId;
  const { players, loading: playersLoading, error: playersError } = usePlayers(effectiveTeamSeasonId);
  const selectedPlayersFromState = useMemo(() => {
    const incoming = (location.state as { selectedPlayers?: unknown } | null)?.selectedPlayers;
    if (!Array.isArray(incoming)) return [];
    return incoming.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0);
  }, [location.state]);
  const selectedPlayerIdSet = useMemo(() => new Set(selectedPlayersFromState), [selectedPlayersFromState]);
  const lineupPlayers = useMemo(
    () => (selectedPlayerIdSet.size > 0 ? players.filter((p) => selectedPlayerIdSet.has(p.id)) : players),
    [players, selectedPlayerIdSet],
  );

  const syncFieldFromStartersBySlot = useCallback((bySlot: Record<FieldSlotId, string | null>) => {
    setLocalMatch((prev) => {
      if (!prev) return prev;
      const home: Partial<Record<FieldSlotId, string>> = {};
      for (const slot of LIVE_FIELD_SLOT_ORDER) {
        const pid = bySlot[slot];
        if (pid) home[slot] = pid;
      }
      return { ...prev, field: { ...prev.field, home } };
    });
  }, []);

  useEffect(() => {
    if (!id) {
      setError('Keine Match-ID angegeben');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: fetchError } = await supabase
        .from('matches')
        .select('id, team_season_id, opponent, match_date, location, status, motm_enabled, motm_open_until, live_started_at, live_elapsed_seconds, live_is_running, score_home, score_away, live_period')
        .eq('id', id)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setMatchRow(null);
        setLocalMatch(null);
        setLoading(false);
        return;
      }

      const row = (data as MatchRow | null) ?? null;
      setMatchRow(row);

      const mapped = mapRowToMatch(row);
      if (!mapped) {
        setLocalMatch(null);
        setLoading(false);
        return;
      }

      const { data: eventsData } = await supabase
        .from('match_events')
        .select('id, type, minute, period, created_at')
        .eq('match_id', id)
        .order('created_at', { ascending: true });

      const loadedEvents: MatchEvent[] =
        eventsData?.map((e: any) => ({
          id: e.id,
          type: e.type === 'goal_away' ? 'goal' : (e.type as MatchEvent['type']),
          teamId: e.type === 'goal_away' ? mapped.away.id : undefined,
          minute: e.minute ?? undefined,
          period: (e.period as 1 | 2 | 3) ?? undefined,
          timestampISO: e.created_at,
        })) ?? [];

      setLocalMatch({ ...mapped, events: loadedEvents });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Fix: TS/JS syntax (above) — cancelled must be boolean, not Python.
  // We'll overwrite the effect cleanup below with a safe version.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {}, []);

  // Replace the broken cleanup from the previous effect with a correct one by re-running it safely:
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [id]);

  // Players into match.home.players (for UI)
  const playersKey = players.map((p) => `${p.id}:${p.display_name}:${p.jersey_number ?? ''}`).join('|');
  useEffect(() => {
    if (!localMatch || !effectiveTeamSeasonId || localMatch.home.id !== effectiveTeamSeasonId) return;
    setLocalMatch((prev) => {
      if (!prev) return prev;
      const nextPlayers = players.map((p) => ({
        id: p.id,
        display_name: p.display_name,
        name: p.display_name,
        number: p.jersey_number ?? undefined,
      }));
      return { ...prev, home: { ...prev.home, players: nextPlayers } };
    });
  }, [localMatch?.id, effectiveTeamSeasonId, playersKey]);

  useEffect(() => {
    if (!matchId || !spectatorMode) {
      setLineupData(null);
      setEvents([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [lineRes, evRes] = await Promise.all([
        fetchLineupForLiveMatch(matchId),
        fetchMatchEvents(matchId),
      ]);
      if (cancelled) return;
      setLineupData(
        lineRes.error
          ? { startingPlayerIds: [], squadPlayerIds: [], savedBenchPlayerIds: [] }
          : lineRes.data,
      );
      const sorted = sortMatchEventsChronologically(evRes.data);
      setEvents(evRes.error ? [] : [...sorted].reverse());
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, spectatorMode]);

  useEffect(() => {
    if (!matchRow || playersLoading || !spectatorMode) return;

    const valid = new Set(lineupPlayers.map((p) => p.id));
    const fromDb = lineupData;

    let squad: string[] = [];
    let starting: string[] = [];

    if (fromDb) {
      squad = fromDb.squadPlayerIds.filter((id) => valid.has(id));
      starting = fromDb.startingPlayerIds.filter((id) => valid.has(id)).slice(0, 7);
    }

    setSquadPlayerIds(squad);
    setStartingPlayerIds(starting);
  }, [matchRow, lineupData, lineupPlayers, playersLoading, spectatorMode]);

  /** Gleiche Uhr-/Elapsed-Logik wie LiveMatchScreen (DB: matches.live_*). */
  const { currentMatchSeconds } = useMatchTimer({
    elapsedSeconds: matchRow?.live_elapsed_seconds ?? 0,
    isRunning: matchRow?.live_is_running ?? false,
    hasEnded: matchRow?.status === 'finished',
    startedAtISO: matchRow?.live_is_running ? matchRow?.live_started_at ?? null : null,
  });
  const currentSeconds = currentMatchSeconds;
  const currentMinute = Math.floor(currentMatchSeconds / 60);
  const formattedTime = `${String(Math.floor(currentMatchSeconds / 60)).padStart(2, '0')}:${String(currentMatchSeconds % 60).padStart(2, '0')}`;

  const roster = useMemo(() => sortRosterByNumber(lineupPlayers.map(playerItemToRoster)), [lineupPlayers]);

  const onFieldIds = useMemo(
    () =>
      spectatorMode
        ? getCurrentOnFieldPlayers(startingPlayerIds, events, currentMatchSeconds)
        : [],
    [spectatorMode, startingPlayerIds, events, currentMatchSeconds],
  );

  const fieldPlayers = useMemo(() => {
    if (!spectatorMode) return [];
    const set = new Set(onFieldIds);
    return sortRosterByNumber(roster.filter((p) => set.has(p.id)));
  }, [spectatorMode, onFieldIds, roster]);

  const benchPlayers = useMemo(() => {
    if (!spectatorMode) return [];
    const ids = getBenchPlayers(squadPlayerIds, onFieldIds);
    const set = new Set(ids);
    return sortRosterByNumber(roster.filter((p) => set.has(p.id)));
  }, [spectatorMode, squadPlayerIds, onFieldIds, roster]);

  /** Nur für LiveControls (Tor/Wechsel): Feld/Bank aus localMatch.field, ohne Aufstellungskarte. */
  const liveControlsHomeOnField = useMemo(() => {
    const home = localMatch?.field?.home ?? {};
    const ids = new Set(Object.values(home).filter(Boolean) as string[]);
    return (localMatch?.home.players ?? []).filter((p) => ids.has(p.id));
  }, [localMatch?.field?.home, localMatch?.home.players]);

  const liveControlsHomeBench = useMemo(() => {
    const home = localMatch?.field?.home ?? {};
    const ids = new Set(Object.values(home).filter(Boolean) as string[]);
    return lineupPlayers.filter((p) => !ids.has(p.id));
  }, [localMatch?.field?.home, lineupPlayers]);

  const dbStatus = (matchRow?.status ?? 'upcoming') as 'upcoming' | 'live' | 'finished';

  const canManageStatus =
    activeRoleNormalized === 'trainer' ||
    activeRoleNormalized === 'admin' ||
    activeRoleNormalized === 'head_coach' ||
    activeRoleNormalized === 'co_trainer';
  const canSeeLiveControls = localMatch?.status === 'live' && canUseLiveControls(uiRole) && operatorMode;

  const handleSetMatchStatus = async (nextStatus: 'upcoming' | 'live' | 'finished') => {
    if (!matchId) return;

    setStatusError(null);
    setStatusSaving(true);

    if (nextStatus === 'live' && localMatch && !isStartelfCompleteForLive(localMatch)) {
      setStatusError('Startelf unvollständig – zuerst Aufstellung setzen.');
      setStatusSaving(false);
      return;
    }

    // optimistic
    setMatchRow((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    setLocalMatch((prev) =>
      prev
        ? { ...prev, status: nextStatus === 'upcoming' ? 'planned' : (nextStatus as Match['status']) }
        : prev,
    );

    const { error: updateError } = await updateMatchRow(matchId, { status: nextStatus });

    if (updateError) {
      setStatusError(updateError);
    }

    setStatusSaving(false);
  };

  const handleTimerCommand = (command: 'start' | 'pause' | 'stop', currentElapsedSeconds?: number) => {
    if (!matchId) return;

    const now = new Date().toISOString();

    setLocalMatch((prev) => {
      if (!prev) return prev;
      const t = prev.timer ?? { isRunning: false, startedAtISO: null, accumulatedSeconds: 0 };

      if (command === 'start') return { ...prev, timer: { ...t, isRunning: true, startedAtISO: now } };
      if (command === 'pause') return { ...prev, timer: { ...t, isRunning: false, startedAtISO: null, accumulatedSeconds: currentElapsedSeconds ?? t.accumulatedSeconds } };
      if (command === 'stop')
        return { ...prev, status: 'finished', timer: { ...t, isRunning: false, startedAtISO: null, accumulatedSeconds: currentElapsedSeconds ?? t.accumulatedSeconds } };

      return prev;
    });

    const payload: Record<string, unknown> =
      command === 'start'
        ? { live_started_at: now, live_is_running: true }
        : command === 'pause'
          ? { live_elapsed_seconds: currentElapsedSeconds ?? 0, live_is_running: false }
          : { live_is_running: false, ...(typeof currentElapsedSeconds === 'number' ? { live_elapsed_seconds: currentElapsedSeconds } : {}) };

    void updateMatchRow(matchId, payload).then(({ error }) => {
      if (error) setStatusError(error);
    });
  };

  const handleAddEvent = (event: MatchEvent) => {
    setLocalMatch((prev) => {
      if (!prev) return prev;

      const e: MatchEvent = { ...event, minute: event.minute ?? currentMinute };
      const next: Match = { ...prev, events: [...prev.events, e] };

      if (e.type === 'goal' && e.teamId) {
        if (e.teamId === prev.home.id) next.score = { ...prev.score, home: prev.score.home + 1 };
        if (e.teamId === prev.away.id) next.score = { ...prev.score, away: prev.score.away + 1 };
      }

      if (e.type === 'final_whistle') {
        next.status = 'finished';
        next.timer = { ...(prev.timer ?? { isRunning: false, startedAtISO: null, accumulatedSeconds: 0 }), isRunning: false, startedAtISO: null };
      }

      return next;
    });
  };

  if (loading) return <div className="page pb-4"><p>Lade Spiel…</p></div>;

  if (error) {
    return (
      <div className="page pb-4 space-y-3">
        <p>{error}</p>
        <Link to="/app/termine" className="text-sm text-[var(--text-sub)] hover:text-[var(--text-main)]">
          ← Zurück zum Spielplan
        </Link>
      </div>
    );
  }

  if (!localMatch) {
    return (
      <div className="page pb-4 space-y-3">
        <p>Spiel nicht gefunden.</p>
        <Link to="/app/termine" className="text-sm text-[var(--text-sub)] hover:text-[var(--text-main)]">
          ← Zurück zum Spielplan
        </Link>
      </div>
    );
  }

  const kickoff = new Date(localMatch.kickoffISO);
  const dateStr = new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    dateStyle: 'medium',
  }).format(kickoff);
  const timeStr = new Intl.DateTimeFormat('de-AT', {
    timeZone: VIENNA_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(kickoff);

  return (
    <div className="page pb-4">
      <div className="space-y-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        {/* Links: Scoreboard, Controls, Aufstellung (Mobile: oben, ab lg: linke Spalte) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/app/termine" className="text-sm text-[var(--text-sub)] hover:text-[var(--text-main)]">
              ← Zurück
            </Link>
          </div>

          {localMatch.status === 'live' ? (
          <section className="live-panel card space-y-3" aria-label="Live">
            <div className="matchcard">
              <div className="matchgrid">
                <div className="matchmeta matchmeta--team">
                  <p className="text-sm font-medium text-[var(--text-main)]">{localMatch.home.shortName ?? localMatch.home.name}</p>
                  <span className="matchcard__score">{localMatch.score.home}</span>
                </div>

                <div className="matchmeta">
                  <span className="pill pill-live text-[0.7rem]">LIVE</span>
                  <span className="matchcard__time liveTimer mt-1 block text-lg">{formattedTime}</span>
                  <p className="text-xs text-[var(--text-sub)] mt-0.5">{localMatch.period ? `Abschnitt ${localMatch.period}` : 'Spielzeit'}</p>

                  {canManageStatus && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="mt-2"
                      disabled={statusSaving}
                      onClick={() => {
                        handleTimerCommand('stop');
                        handleSetMatchStatus('finished');
                      }}
                    >
                      Abpfiff / Beenden
                    </Button>
                  )}

                  {statusError && <p className="text-[0.7rem] text-red-600 mt-1">{statusError}</p>}
                </div>

                <div className="matchmeta matchmeta--opponent">
                  <p className="text-sm font-medium text-[var(--text-main)]">{localMatch.away.shortName ?? localMatch.away.name}</p>
                  <span className="matchcard__score">{localMatch.score.away}</span>
                </div>
              </div>
            </div>

            {canSeeLiveControls && (
              <LiveControls
                match={localMatch}
                currentMinute={currentMinute}
                currentSeconds={currentSeconds}
                onAddEvent={handleAddEvent}
                onTimerCommand={handleTimerCommand}
                onFieldPlayersByTeam={{ home: liveControlsHomeOnField, away: [] }}
                benchPlayersByTeam={{ home: liveControlsHomeBench, away: [] }}
              />
            )}
          </section>
        ) : (
          <div className="matchcard">
            <div className="matchgrid">
              <div className="matchmeta matchmeta--team">
                <p className="text-sm font-medium text-[var(--text-main)]">{localMatch.home.shortName ?? localMatch.home.name}</p>
                <span className="matchcard__score">{localMatch.score.home}</span>
              </div>

              <div className="matchmeta">
                <span className="matchcard__time">{timeStr}</span>
                <p className="text-xs text-[var(--text-sub)] mt-0.5">{dateStr}</p>

                {canManageStatus && (
                  <div className="mt-2">
                    {dbStatus === 'upcoming' && (
                      <Button size="sm" variant="primary" disabled={statusSaving} onClick={() => handleSetMatchStatus('live')}>
                        LIVE starten
                      </Button>
                    )}
                    {dbStatus === 'finished' && (
                      <Button size="sm" variant="secondary" disabled={statusSaving} onClick={() => handleSetMatchStatus('upcoming')}>
                        Zurück auf geplant
                      </Button>
                    )}
                  </div>
                )}

                {statusError && <p className="text-[0.7rem] text-red-600 mt-1">{statusError}</p>}
              </div>

              <div className="matchmeta matchmeta--opponent">
                <p className="text-sm font-medium text-[var(--text-main)]">{localMatch.away.shortName ?? localMatch.away.name}</p>
                <span className="matchcard__score">{localMatch.score.away}</span>
              </div>
            </div>
          </div>
        )}

        {matchId && canManageStatus && localMatch.status !== 'finished' ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/app/match-preparation?matchId=${encodeURIComponent(matchId)}`)}
            >
              Match vorbereiten
            </Button>
          </div>
        ) : null}

        {matchId && canManageStatus && localMatch.status !== 'finished' && (
          <TrainerMatchLineupMvp
            matchId={matchId}
            players={lineupPlayers}
            onFieldSynced={syncFieldFromStartersBySlot}
          />
        )}

        {/* MOTM (placeholder UI only) */}
        {matchRow?.motm_enabled === true && (
          <Card>
            <CardTitle>Player of the Match</CardTitle>
            {matchRow.status === 'live' && (!matchRow.motm_open_until || Date.now() <= new Date(matchRow.motm_open_until).getTime()) ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-[var(--text-sub)]">Wähle deinen Spieler des Spiels:</p>
                <div className="flex flex-wrap gap-2">
                  {players.slice(0, 5).map((p) => (
                    <Button key={p.id} type="button" variant="secondary" size="sm" onClick={() => {}}>
                      {p.display_name || 'Spieler'}
                    </Button>
                  ))}
                  {players.length === 0 && <p className="text-sm text-[var(--text-sub)]">Keine Spieler im Kader.</p>}
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm font-medium text-[var(--text-sub)]">Voting beendet</p>
                <p className="mt-1 text-sm text-[var(--text-main)]">Spieler des Spiels: – (Ergebnis folgt)</p>
              </div>
            )}
          </Card>
        )}

          {spectatorMode && (
            <div className="card">
              <h2 className="card-title">Aufstellung &amp; Bank</h2>
              {lineupData === null ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Live-Aufstellung wird geladen…</p>
              ) : fieldPlayers.length === 0 && benchPlayers.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Noch keine Aufstellung verfügbar.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase text-emerald-500">Startaufstellung</h3>
                    <ul className="space-y-2">
                      {fieldPlayers.map((p) => (
                        <li key={p.id}>
                          <div className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-emerald-600/40 bg-emerald-950/30 px-4 py-3">
                            <span className="text-lg font-bold text-emerald-400">{p.number || '–'}</span>
                            <span className="flex-1 px-3 text-base font-semibold text-[var(--text-main)]">{p.name}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase text-gray-400">Ersatzbank</h3>
                    <ul className="space-y-2">
                      {benchPlayers.map((p) => (
                        <li key={p.id}>
                          <div className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                            <span className="text-lg font-bold text-white/50">{p.number || '–'}</span>
                            <span className="flex-1 px-3 text-base font-semibold text-[var(--text-main)]">{p.name}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rechts ab lg: Timeline + Stats (Mobile: unter den Controls) */}
        <div className="space-y-4 lg:col-span-7">
          <MatchTimeline match={localMatch} />
          <MatchStatsTable match={localMatch} />
        </div>
      </div>
    </div>
  );
};
