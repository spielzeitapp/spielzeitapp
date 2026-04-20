import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TrainerMatchSetupBlock } from '../TrainerMatchSetupBlock';
import { Link, useParams } from 'react-router-dom';
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
import { useMatchAvailability } from '../../hooks/useMatchAvailability';
import { useAvailabilityPermissions } from '../../hooks/useAvailabilityPermissions';
import { useMatchLineup } from '../../hooks/useMatchLineup';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { Button } from '../../app/components/ui/Button';
import { isStartelfCompleteForLive } from './lineupGuards';
import { VIENNA_TZ } from '../../lib/viennaTime';
import { fetchLineupForLiveMatch, fetchMatchEvents, LIVE_FIELD_SLOT_ORDER } from '../../lib/liveMatchService';
import { getBenchPlayers, getCurrentOnFieldPlayers, sortMatchEventsChronologically, type MatchEngineEvent } from '../../lib/matchEngine';
import { playerItemToRoster, type RosterPlayer } from '../../lib/rosterPlayer';

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
  return [...list].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
}

export const MatchDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const matchId = id ?? null;

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
  const { getAvailability, setAvailability, loading: availLoading, error: availError, saving } = useMatchAvailability(matchId);
  const perms = useAvailabilityPermissions({ role: activeRoleNormalized, teamSeasonId: effectiveTeamSeasonId });
  const { clearPlayerEverywhere: clearPlayerFromLineupAndBench, reloadLineup } = useMatchLineup(matchId);

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
      setLineupData(lineRes.error ? { startingPlayerIds: [], squadPlayerIds: [] } : lineRes.data);
      const sorted = sortMatchEventsChronologically(evRes.data);
      setEvents(evRes.error ? [] : [...sorted].reverse());
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, spectatorMode]);

  useEffect(() => {
    if (!matchRow || playersLoading || !spectatorMode) return;
    const valid = new Set(players.map((p) => p.id));
    const fromDb = lineupData;
    let squad: string[] = [];
    let starting: string[] = [];
    if (fromDb && fromDb.squadPlayerIds.length > 0) {
      squad = fromDb.squadPlayerIds.filter((id) => valid.has(id));
      starting = fromDb.startingPlayerIds.filter((id) => valid.has(id)).slice(0, 7);
    }
    if (squad.length === 0 && players.length > 0) {
      squad = players.map((p) => p.id);
      starting = players.slice(0, Math.min(7, players.length)).map((p) => p.id);
    } else if (starting.length === 0 && squad.length > 0) {
      starting = squad.slice(0, 7);
    }
    setSquadPlayerIds(squad);
    setStartingPlayerIds(starting);
  }, [matchRow, lineupData, players, playersLoading, spectatorMode]);

  /** Gleiche Uhr-/Elapsed-Logik wie LiveMatchScreen (DB: matches.live_*). */
  const { currentMatchSeconds } = useMatchTimer({
    elapsedSeconds: matchRow?.live_elapsed_seconds ?? 0,
    isRunning: matchRow?.live_is_running ?? false,
    hasEnded: matchRow?.status === 'finished',
    startedAtISO: matchRow?.live_started_at ?? null,
  });
  const currentSeconds = currentMatchSeconds;
  const currentMinute = Math.floor(currentMatchSeconds / 60);
  const formattedTime = `${String(Math.floor(currentMatchSeconds / 60)).padStart(2, '0')}:${String(currentMatchSeconds % 60).padStart(2, '0')}`;

  const statusByPlayerId = useMemo(() => {
    const m: Record<string, 'yes' | 'no' | 'maybe' | null> = {};
    players.forEach((p) => (m[p.id] = getAvailability(p.id) ?? null));
    return m;
  }, [players, getAvailability]);

  /** Gleiches Filter-Format wie Event-Detail (event_attendance): nur yes/no, Keys lowercased. */
  const matchDetailAttendanceByPlayerId = useMemo(() => {
    const out: Record<string, 'yes' | 'no'> = {};
    for (const p of players) {
      const s = getAvailability(p.id);
      if (s === 'yes' || s === 'no') out[(p.id ?? '').toLowerCase()] = s;
    }
    return out;
  }, [players, getAvailability]);

  const roster = useMemo(() => sortRosterByNumber(players.map(playerItemToRoster)), [players]);

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
    return players.filter((p) => statusByPlayerId[p.id] === 'yes' && !ids.has(p.id));
  }, [localMatch?.field?.home, players, statusByPlayerId]);

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

    const { error: updateError } = await supabase.from('matches').update({ status: nextStatus }).eq('id', matchId);

    if (updateError) {
      setStatusError('Status speichern fehlgeschlagen.');
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

    supabase.from('matches').update(payload).eq('id', matchId).then(() => {});
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

        {/* Availability */}
        {!(operatorMode && localMatch.status === 'live') && (
          <Card>
            <CardTitle>Zu-/Absage</CardTitle>

            {(playersLoading || availLoading) && <p className="mt-2 text-sm text-[var(--muted)]">Lade…</p>}
            {(playersError || availError) && <p className="mt-2 text-sm text-red-600">{playersError ?? availError}</p>}
            {perms.error && <p className="mt-2 text-sm text-red-600">{perms.error}</p>}
            {saving && <p className="mt-2 text-xs text-[var(--muted)]">Speichern…</p>}

            <div className="mt-2 divide-y divide-[var(--border)]">
              {players.map((player) => {
                const status = getAvailability(player.id);
                const canEdit = perms.canEdit(player.id);
                return (
                  <div key={player.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0 flex-1 text-sm text-[var(--text-main)]">{player.display_name || 'Spieler'}</div>
                    <div className="flex items-center gap-2">
                      <Button disabled={!canEdit || saving} variant={status === 'yes' ? 'primary' : 'secondary'} onClick={() => setAvailability(player.id, 'yes')}>
                        Zusage
                      </Button>
                      <Button
                        disabled={!canEdit || saving}
                        variant={status === 'no' ? 'primary' : 'secondary'}
                        onClick={() => {
                          setAvailability(player.id, 'no');
                          clearPlayerFromLineupAndBench(player.id).catch(() => {});
                        }}
                      >
                        Absage
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {matchId && canManageStatus && !(operatorMode && localMatch.status === 'live') && (
          <TrainerMatchSetupBlock
            matchId={matchId}
            players={players}
            attendanceByPlayerId={matchDetailAttendanceByPlayerId}
          />
        )}

        {matchId && canManageStatus && !(operatorMode && localMatch.status === 'live') && (
          <TrainerMatchLineupMvp
            matchId={matchId}
            players={players}
            onFieldSynced={syncFieldFromStartersBySlot}
            onLineupPersisted={() => {
              void reloadLineup();
            }}
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
