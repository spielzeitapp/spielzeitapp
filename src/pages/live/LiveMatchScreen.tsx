import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { usePlayers } from '../../hooks/usePlayers';
import { useMatchTimer } from '../../hooks/useMatchTimer';
import {
  calculatePlayerPlaytimes,
  getBenchPlayers,
  getCurrentOnFieldPlayers,
  getPlaytimeStatus,
  handleSubstitution,
  sortMatchEventsChronologically,
  type MatchEngineEvent,
  type MatchEventType,
} from '../../lib/matchEngine';
import {
  engineEventToInsertPayload,
  fetchFirstLiveMatch,
  fetchLineupForLiveMatch,
  fetchMatchById,
  fetchMatchEvents,
  saveMatchEvent,
  saveMatchEvents,
  updateMatchRow,
  type LiveMatchRow,
} from '../../lib/liveMatchService';
import { playerItemToRoster, type RosterPlayer } from '../../lib/rosterPlayer';
import { supabase } from '../../lib/supabaseClient';

const HOME_FALLBACK = 'Unser Team';

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinute(ts: number): string {
  const min = Math.floor(ts / 60);
  return `${min}'`;
}

const tabBtn =
  'flex-1 min-h-[44px] rounded-xl px-2 text-sm font-semibold transition-colors active:scale-[0.98]';
const tabActive = 'bg-emerald-600 text-white shadow-inner';
const tabIdle = 'bg-white/5 text-white/70 hover:bg-white/10';

function eventIcon(t: MatchEventType): string {
  if (t === 'goal') return '⚽';
  if (t === 'sub_out' || t === 'sub_in') return '🔁';
  if (t === 'start') return '▶';
  if (t === 'pause') return '⏸';
  if (t === 'resume') return '▶';
  if (t === 'end') return '⏹';
  return '•';
}

function newEventId(): string {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

type EventsFilter = 'all' | 'goals' | 'subs';

function sortRosterByNumber(list: RosterPlayer[]): RosterPlayer[] {
  return [...list].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
}

export const LiveMatchScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const matchIdParam = searchParams.get('matchId');

  const [effectiveMatchId, setEffectiveMatchId] = useState<string | null>(null);
  const [matchRow, setMatchRow] = useState<LiveMatchRow | null>(null);
  const [lineupData, setLineupData] = useState<{
    startingPlayerIds: string[];
    squadPlayerIds: string[];
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  const [startingPlayerIds, setStartingPlayerIds] = useState<string[]>([]);
  const [events, setEvents] = useState<MatchEngineEvent[]>([]);
  const [opponentLabel, setOpponentLabel] = useState('Gegner');
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);

  const { selectedTeamSeason, canAccess, backendRole } = useSession();
  const canControlLiveMatch =
    canAccess('match_admin') || String(backendRole ?? '').trim().toLowerCase() === 'admin';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPageLoading(true);
      setPageError(null);
      let resolvedId = matchIdParam?.trim() || null;
      if (resolvedId === 'local-setup') resolvedId = null;
      if (!resolvedId) {
        const { data: live, error: liveErr } = await fetchFirstLiveMatch();
        if (cancelled) return;
        if (liveErr) {
          setPageError(liveErr);
          setEffectiveMatchId(null);
          setMatchRow(null);
          setLineupData(null);
          setPageLoading(false);
          return;
        }
        resolvedId = live?.id ?? null;
      }
      if (!resolvedId) {
        setEffectiveMatchId(null);
        setMatchRow(null);
        setLineupData(null);
        setEvents([]);
        setPageLoading(false);
        return;
      }

      console.info('Live Match ID:', resolvedId);

      const [mRes, lineRes, evRes] = await Promise.all([
        fetchMatchById(resolvedId),
        fetchLineupForLiveMatch(resolvedId),
        fetchMatchEvents(resolvedId),
      ]);
      if (cancelled) return;
      if (mRes.error || !mRes.data) {
        setPageError(mRes.error ?? 'Spiel nicht gefunden.');
        setEffectiveMatchId(null);
        setMatchRow(null);
        setLineupData(null);
        setEvents([]);
        setPageLoading(false);
        return;
      }
      setEffectiveMatchId(resolvedId);
      setMatchRow(mRes.data);
      setLineupData(lineRes.error ? { startingPlayerIds: [], squadPlayerIds: [] } : lineRes.data);
      const sorted = sortMatchEventsChronologically(evRes.data);
      setEvents([...sorted].reverse());
      if (lineRes.error) setSaveError(lineRes.error);
      if (evRes.error) setSaveError(evRes.error);
      setPageLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchIdParam]);

  const teamSeasonForRoster = matchRow?.team_season_id ?? null;
  const { players, loading: playersLoading, error: playersError } = usePlayers(teamSeasonForRoster);

  const roster = useMemo(() => sortRosterByNumber(players.map(playerItemToRoster)), [players]);
  const rosterById = useMemo(() => {
    const m = new Map<string, RosterPlayer>();
    roster.forEach((p) => m.set(p.id, p));
    return m;
  }, [roster]);

  const {
    currentMatchSeconds,
    isRunning,
    matchHasEnded,
    half,
    startMatch,
    pauseMatch,
    resumeMatch,
    endMatch,
    startSecondHalf,
  } = useMatchTimer({
    elapsedSeconds: matchRow?.live_elapsed_seconds ?? 0,
    isRunning: matchRow?.live_is_running ?? false,
    hasEnded: matchRow?.status === 'finished',
    startedAtISO: matchRow?.live_started_at ?? null,
  });

  useEffect(() => {
    if (!matchRow) return;
    const o = matchRow.opponent?.trim();
    setOpponentLabel(o || 'Gegner');
    setScoreHome(Number(matchRow.score_home ?? 0));
    setScoreAway(Number(matchRow.score_away ?? 0));
  }, [matchRow]);

  useEffect(() => {
    if (!matchRow || playersLoading) return;
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
  }, [matchRow, lineupData, players, playersLoading]);

  const homeName = selectedTeamSeason?.team?.name ?? HOME_FALLBACK;

  const headerOpponent = opponentLabel;
  const [mainTab, setMainTab] = useState<'overview' | 'lineup' | 'events' | 'time'>('overview');
  const [eventsFilter, setEventsFilter] = useState<EventsFilter>('all');

  const [subOpen, setSubOpen] = useState(false);
  const [subOutId, setSubOutId] = useState<string>('');
  const [subInId, setSubInId] = useState<string>('');

  const [wechselOutId, setWechselOutId] = useState<string>('');
  const [wechselInId, setWechselInId] = useState<string>('');
  const [homeGoalScorerId, setHomeGoalScorerId] = useState<string>('');

  const hasClockStarted = useMemo(
    () => Boolean(matchRow?.live_started_at) || events.some((e) => e.type === 'start'),
    [matchRow?.live_started_at, events],
  );

  const matchIsFinished = matchHasEnded || matchRow?.status === 'finished';

  const onFieldIds = useMemo(
    () => getCurrentOnFieldPlayers(startingPlayerIds, events, currentMatchSeconds),
    [startingPlayerIds, events, currentMatchSeconds],
  );

  const fieldPlayers = useMemo(() => {
    const set = new Set(onFieldIds);
    return sortRosterByNumber(roster.filter((p) => set.has(p.id)));
  }, [onFieldIds, roster]);

  const benchPlayers = useMemo(() => {
    const ids = getBenchPlayers(squadPlayerIds, onFieldIds);
    const set = new Set(ids);
    return sortRosterByNumber(roster.filter((p) => set.has(p.id)));
  }, [squadPlayerIds, onFieldIds, roster]);

  const squadRosterSorted = useMemo(
    () => sortRosterByNumber(roster.filter((p) => squadPlayerIds.includes(p.id))),
    [roster, squadPlayerIds],
  );

  useEffect(() => {
    if (!homeGoalScorerId) return;
    if (!squadRosterSorted.some((p) => p.id === homeGoalScorerId)) setHomeGoalScorerId('');
  }, [homeGoalScorerId, squadRosterSorted]);

  const playtimes = useMemo(
    () => calculatePlayerPlaytimes(startingPlayerIds, squadPlayerIds, events, currentMatchSeconds),
    [startingPlayerIds, squadPlayerIds, events, currentMatchSeconds],
  );

  const persistSingle = useCallback(
    async (partial: Omit<MatchEngineEvent, 'id'>): Promise<boolean> => {
      if (!effectiveMatchId) return false;
      setSaveError(null);
      const tempId = newEventId();
      const optimistic: MatchEngineEvent = { ...partial, id: tempId };
      setEvents((prev) => [optimistic, ...prev]);
      if (partial.type === 'start' || partial.type === 'pause' || partial.type === 'resume' || partial.type === 'end') {
        return true;
      }
      const payload = engineEventToInsertPayload(effectiveMatchId, partial, half);
      const { id, error } = await saveMatchEvent(payload);
      if (error || !id) {
        console.error('[LiveMatch] saveMatchEvent', error);
        setSaveError(error ?? 'Ereignis konnte nicht gespeichert werden.');
        setEvents((prev) => prev.filter((e) => e.id !== tempId));
        return false;
      }
      setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...partial, id } : e)));
      return true;
    },
    [effectiveMatchId, half],
  );

  const onStartClick = async () => {
    if (!canControlLiveMatch || matchIsFinished || isRunning || !effectiveMatchId) return;
    if (!hasClockStarted) {
      const ok = await persistSingle({ type: 'start', timestamp: 0 });
      if (!ok) return;
      startMatch();
      const { error } = await updateMatchRow(effectiveMatchId, {
        status: 'live',
        live_started_at: new Date().toISOString(),
        live_is_running: true,
      });
      if (error) setSaveError(error);
    } else {
      const ok = await persistSingle({ type: 'resume', timestamp: currentMatchSeconds });
      if (!ok) return;
      resumeMatch();
      const { error } = await updateMatchRow(effectiveMatchId, {
        status: 'live',
        live_started_at: new Date().toISOString(),
        live_is_running: true,
        live_elapsed_seconds: currentMatchSeconds,
      });
      if (error) setSaveError(error);
    }
  };

  const onPauseClick = async () => {
    if (!canControlLiveMatch || !isRunning || matchIsFinished || !effectiveMatchId) return;
    const ok = await persistSingle({ type: 'pause', timestamp: currentMatchSeconds });
    if (!ok) return;
    pauseMatch();
    const { error } = await updateMatchRow(effectiveMatchId, {
      live_elapsed_seconds: currentMatchSeconds,
      live_is_running: false,
    });
    if (error) setSaveError(error);
  };

  const onEndClick = async () => {
    if (!canControlLiveMatch || matchIsFinished || !effectiveMatchId) return;
    const ok = await persistSingle({ type: 'end', timestamp: currentMatchSeconds });
    if (!ok) return;
    endMatch();
    const { error } = await updateMatchRow(effectiveMatchId, {
      status: 'finished',
      live_is_running: false,
      live_elapsed_seconds: currentMatchSeconds,
      live_period: half,
      score_home: scoreHome,
      score_away: scoreAway,
    });
    if (error) setSaveError(error);
    else {
      const { error: eventStatusError } = await supabase
        .from('events')
        .update({ status: 'finished' })
        .eq('match_id', effectiveMatchId);
      if (eventStatusError) setSaveError(eventStatusError.message);
      setMatchRow((prev) =>
        prev
          ? {
              ...prev,
              status: 'finished',
              live_is_running: false,
              live_elapsed_seconds: currentMatchSeconds,
              live_period: half,
              score_home: scoreHome,
              score_away: scoreAway,
            }
          : null,
      );
    }
  };

  const openSubFromPlayer = (p: RosterPlayer) => {
    if (!canControlLiveMatch || matchIsFinished) return;
    setSubOpen(true);
    if (onFieldIds.includes(p.id)) {
      setSubOutId(p.id);
      setSubInId('');
    } else {
      setSubInId(p.id);
      setSubOutId('');
    }
  };

  const persistSubstitution = useCallback(
    async (outgoingPlayerId: string, incomingPlayerId: string): Promise<boolean> => {
      if (!canControlLiveMatch || matchIsFinished || !effectiveMatchId) return false;
      const check = handleSubstitution({
        outgoingPlayerId,
        incomingPlayerId,
        currentTimestamp: currentMatchSeconds,
        events,
        currentOnFieldPlayerIds: onFieldIds,
        generateId: newEventId,
      });
      if (!check.ok) return false;

      setSaveError(null);
      const ts = currentMatchSeconds;
      const outPartial: Omit<MatchEngineEvent, 'id'> = {
        type: 'sub_out',
        timestamp: ts,
        playerId: outgoingPlayerId,
      };
      const inPartial: Omit<MatchEngineEvent, 'id'> = {
        type: 'sub_in',
        timestamp: ts,
        playerId: incomingPlayerId,
      };
      const tempOut = newEventId();
      const tempIn = newEventId();
      setEvents((prev) => [
        { ...inPartial, id: tempIn },
        { ...outPartial, id: tempOut },
        ...prev,
      ]);
      const payloads = [
        engineEventToInsertPayload(effectiveMatchId, outPartial, half),
        engineEventToInsertPayload(effectiveMatchId, inPartial, half),
      ];
      const { ids, error } = await saveMatchEvents(payloads);
      if (error || ids.length < 2) {
        console.error('[LiveMatch] saveMatchEvents subs', error);
        setSaveError(error ?? 'Wechsel speichern fehlgeschlagen.');
        setEvents((prev) => prev.filter((e) => e.id !== tempOut && e.id !== tempIn));
        return false;
      }
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id === tempOut) return { ...outPartial, id: ids[0] };
          if (e.id === tempIn) return { ...inPartial, id: ids[1] };
          return e;
        }),
      );
      return true;
    },
    [canControlLiveMatch, matchIsFinished, effectiveMatchId, currentMatchSeconds, events, onFieldIds, half],
  );

  const confirmSub = async () => {
    if (matchIsFinished) return;
    const ok = await persistSubstitution(subOutId, subInId);
    if (!ok) return;
    setSubOpen(false);
    setSubOutId('');
    setSubInId('');
  };

  const confirmWechselSection = async () => {
    if (matchIsFinished) return;
    const ok = await persistSubstitution(wechselOutId, wechselInId);
    if (!ok) return;
    setWechselOutId('');
    setWechselInId('');
  };

  const filteredEvents = useMemo(() => {
    const list = [...events].sort((a, b) => b.timestamp - a.timestamp);
    if (eventsFilter === 'goals') return list.filter((e) => e.type === 'goal');
    if (eventsFilter === 'subs') return list.filter((e) => e.type === 'sub_out' || e.type === 'sub_in');
    return list;
  }, [events, eventsFilter]);

  const eventLabel = (ev: MatchEngineEvent): string => {
    const name = ev.playerId ? rosterById.get(ev.playerId)?.name : undefined;
    switch (ev.type) {
      case 'start':
        return 'Anpfiff';
      case 'goal':
        if (!ev.playerId) return 'Tor Gast';
        return `Tor · ${name ?? '?'}`;
      case 'sub_out':
        return `Raus${name ? `: ${name}` : ''}`;
      case 'sub_in':
        return `Rein${name ? `: ${name}` : ''}`;
      case 'pause':
        return 'Pause';
      case 'resume':
        return 'Weiter';
      case 'end':
        return 'Spielende';
      default:
        return ev.type;
    }
  };

  const selectClass =
    'mt-1 w-full min-h-[52px] rounded-2xl border border-white/15 bg-black/50 px-3 text-base text-white focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/40';

  const ampelDot = (s: ReturnType<typeof getPlaytimeStatus>) =>
    s === 'red' ? 'bg-red-500' : s === 'yellow' ? 'bg-amber-400' : 'bg-emerald-500';

  if (pageLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] text-white">
        <p className="text-sm text-white/60">Lade Live-Daten…</p>
      </div>
    );
  }

  if (!effectiveMatchId) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a0a] p-4 text-white">
        {pageError ? (
          <p className="text-sm text-red-400">{pageError}</p>
        ) : (
          <p>Kein Live-Spiel aktiv</p>
        )}
        <Link to="/app/termine" className="mt-4 inline-block text-sm font-semibold text-emerald-400 underline">
          Zum Spielplan
        </Link>
      </div>
    );
  }

  if (playersLoading && roster.length === 0) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] text-white">
        <p className="text-sm text-white/60">Kader wird geladen…</p>
      </div>
    );
  }

  if (playersError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-2 bg-[#0a0a0a] px-4 text-center text-white">
        <p className="text-sm text-red-400">{playersError}</p>
        <p className="text-xs text-white/50">Spieler kommen aus der Tabelle „players“ (aktuelle Mannschaftssaison).</p>
      </div>
    );
  }

  if (!teamSeasonForRoster) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-2 bg-[#0a0a0a] px-4 text-center text-white">
        <p className="text-sm text-white/70">Spiel hat keine Mannschaftssaison.</p>
        <Link to="/app/termine" className="text-sm font-semibold text-emerald-400 underline">
          Zum Spielplan
        </Link>
      </div>
    );
  }

  if (roster.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-2 bg-[#0a0a0a] px-4 text-center text-white">
        <p className="text-sm text-white/70">Kein Team / keine Spieler für dieses Spiel.</p>
        <p className="text-xs text-white/45">
          Wähle die passende Mannschaftssaison oder lege Spieler im Team an.
        </p>
        <Link to="/app/termine" className="mt-2 text-sm font-semibold text-emerald-400 underline">
          Zum Spielplan
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] pb-28 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f0f0f]/95 px-3 pt-3 pb-4 backdrop-blur-md">
        <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 shadow-lg shadow-black/25">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/25 text-sm font-black text-emerald-200"
                aria-hidden
              >
                {(homeName.slice(0, 1) || 'H').toUpperCase()}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-xs font-semibold text-white/90">{homeName}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Heim</p>
              </div>
            </div>
            <div
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                matchIsFinished
                  ? 'bg-white/15 text-white/70'
                  : hasClockStarted
                    ? 'bg-emerald-600/30 text-emerald-200'
                    : 'bg-white/10 text-white/55'
              }`}
            >
              {matchIsFinished ? 'Beendet' : hasClockStarted ? 'Live' : 'Bereit'}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <div className="min-w-0 text-right">
                <p className="truncate text-xs font-semibold text-white/90">{headerOpponent}</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Gast</p>
              </div>
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-sm font-black text-amber-100"
                aria-hidden
              >
                {(headerOpponent.slice(0, 1) || 'G').toUpperCase()}
              </div>
            </div>
          </div>
          {(!canControlLiveMatch || matchIsFinished) && (
            <p className="mt-3 text-center text-[11px] text-white/45">
              Zuschaueransicht · Anzeige nur, kein Ticker
            </p>
          )}
          {saveError && (
            <p className="mt-2 text-center text-xs font-medium text-amber-400/95" role="alert">
              {saveError}
            </p>
          )}
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-4xl font-black tabular-nums text-white sm:text-5xl">{scoreHome}</span>
            <span className="text-2xl font-light text-white/40">:</span>
            <span className="text-4xl font-black tabular-nums text-white sm:text-5xl">{scoreAway}</span>
          </div>
          <p className="mt-2 text-center text-sm font-semibold">
            {matchIsFinished ? (
              <span className="text-white/60">Spiel beendet</span>
            ) : (
              <span className="text-emerald-400/90">{half}. Halbzeit</span>
            )}
          </p>
          <div
            className={`mt-2 text-center text-3xl font-mono font-bold tabular-nums sm:text-4xl ${
              matchIsFinished ? 'text-white/50' : isRunning ? 'text-emerald-400' : 'text-white/60'
            }`}
          >
            {formatClock(currentMatchSeconds)}
          </div>
          {canControlLiveMatch && !matchIsFinished && (
            <>
              <div className="mt-3">
                <label
                  className="text-[10px] font-bold uppercase tracking-wider text-white/45"
                  htmlFor="heim-tor-schuetze"
                >
                  Torschütze · Heim
                </label>
                <select
                  id="heim-tor-schuetze"
                  className={selectClass}
                  value={homeGoalScorerId}
                  onChange={(e) => setHomeGoalScorerId(e.target.value)}
                  disabled={matchIsFinished}
                >
                  <option value="">Spieler wählen…</option>
                  {squadRosterSorted.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number} · {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={matchIsFinished || !homeGoalScorerId}
                  onClick={async () => {
                    const ok = await persistSingle({
                      type: 'goal',
                      timestamp: currentMatchSeconds,
                      playerId: homeGoalScorerId,
                    });
                    if (!ok) return;
                    setScoreHome((s) => {
                      const n = s + 1;
                      if (effectiveMatchId) void updateMatchRow(effectiveMatchId, { score_home: n });
                      return n;
                    });
                  }}
                  className="min-h-[44px] flex-1 rounded-xl bg-white/10 py-2 text-sm font-bold text-emerald-400 active:bg-white/15 disabled:opacity-35"
                >
                  + Tor Heim
                </button>
                <button
                  type="button"
                  disabled={matchIsFinished}
                  onClick={async () => {
                    const ok = await persistSingle({
                      type: 'goal',
                      timestamp: currentMatchSeconds,
                    });
                    if (!ok) return;
                    setScoreAway((s) => {
                      const n = s + 1;
                      if (effectiveMatchId) void updateMatchRow(effectiveMatchId, { score_away: n });
                      return n;
                    });
                  }}
                  className="min-h-[44px] flex-1 rounded-xl bg-white/10 py-2 text-sm font-bold text-amber-200/90 active:bg-white/15 disabled:opacity-35"
                >
                  + Tor Gast
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onStartClick}
                  disabled={isRunning || matchIsFinished}
                  className="min-h-[48px] flex-1 rounded-2xl bg-emerald-600 px-3 text-base font-bold text-white shadow-lg shadow-emerald-900/40 disabled:opacity-40 active:scale-[0.98]"
                >
                  {!hasClockStarted ? 'Anpfiff' : 'Weiter'}
                </button>
                <button
                  type="button"
                  onClick={onPauseClick}
                  disabled={!isRunning || matchIsFinished}
                  className="min-h-[48px] flex-1 rounded-2xl bg-amber-600 px-3 text-base font-bold text-white disabled:opacity-40 active:scale-[0.98]"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={onEndClick}
                  disabled={matchIsFinished}
                  className="min-h-[48px] flex-1 rounded-2xl bg-red-700 px-3 text-base font-bold text-white disabled:opacity-40 active:scale-[0.98]"
                >
                  Ende
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (matchIsFinished) return;
                  startSecondHalf();
                }}
                disabled={matchIsFinished}
                className="mt-2 w-full min-h-[40px] rounded-xl border border-white/15 text-sm font-semibold text-white/70 active:bg-white/5 disabled:opacity-35"
              >
                2. Halbzeit (Uhr ≥ 25:00)
              </button>
            </>
          )}
        </div>
      </header>

      <div className="sticky top-[var(--live-header-h,auto)] z-30 border-b border-white/10 bg-[#0a0a0a] px-3 py-3">
        <div className="mx-auto flex max-w-lg gap-1 rounded-2xl bg-white/5 p-1">
          <button
            type="button"
            className={`${tabBtn} ${mainTab === 'overview' ? tabActive : tabIdle}`}
            onClick={() => setMainTab('overview')}
          >
            Übersicht
          </button>
          <button
            type="button"
            className={`${tabBtn} ${mainTab === 'lineup' ? tabActive : tabIdle}`}
            onClick={() => setMainTab('lineup')}
          >
            Aufstellung
          </button>
          <button
            type="button"
            className={`${tabBtn} ${mainTab === 'events' ? tabActive : tabIdle}`}
            onClick={() => setMainTab('events')}
          >
            Events
          </button>
          <button
            type="button"
            className={`${tabBtn} ${mainTab === 'time' ? tabActive : tabIdle}`}
            onClick={() => setMainTab('time')}
          >
            Zeit
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-3 py-4">
        {mainTab === 'overview' && (
          <div className="space-y-6">
            {canControlLiveMatch && !matchIsFinished && (
            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Wechsel</h2>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-red-400/90" htmlFor="wechsel-raus">
                    Raus
                  </label>
                  <select
                    id="wechsel-raus"
                    className={selectClass}
                    value={wechselOutId}
                    onChange={(e) => setWechselOutId(e.target.value)}
                    disabled={matchIsFinished}
                  >
                    <option value="">Spieler wählen…</option>
                    {fieldPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number} · {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-emerald-400/90" htmlFor="wechsel-rein">
                    Rein
                  </label>
                  <select
                    id="wechsel-rein"
                    className={selectClass}
                    value={wechselInId}
                    onChange={(e) => setWechselInId(e.target.value)}
                    disabled={matchIsFinished}
                  >
                    <option value="">Spieler wählen…</option>
                    {benchPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number} · {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={confirmWechselSection}
                  disabled={matchIsFinished || !wechselOutId || !wechselInId}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-emerald-600 text-base font-bold text-white disabled:opacity-35 active:scale-[0.99]"
                >
                  Wechsel bestätigen
                </button>
              </div>
            </section>
            )}

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Spielzeit</h2>
              <ul className="space-y-2">
                {sortRosterByNumber(roster.filter((p) => squadPlayerIds.includes(p.id))).map((p) => {
                  const sec = playtimes[p.id] ?? 0;
                  const st = getPlaytimeStatus(sec, currentMatchSeconds, squadPlayerIds.length);
                  const onF = onFieldIds.includes(p.id);
                  return (
                    <li
                      key={p.id}
                      className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 ${
                        onF ? 'border-emerald-500/35 bg-emerald-950/25' : 'border-white/10 bg-white/[0.04] opacity-80'
                      }`}
                    >
                      <span className={`h-3 w-3 shrink-0 rounded-full ${ampelDot(st)}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {p.number || '–'} · {p.name}
                        </p>
                        <p className="text-xs text-white/45">{onF ? 'Am Feld' : 'Bank / außerhalb'}</p>
                      </div>
                      <span className="font-mono text-lg font-bold tabular-nums text-emerald-400">
                        {formatClock(sec)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Spielverlauf</h2>
              <ul className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                {events
                  .filter((e) => e.type !== 'pause')
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 12)
                  .map((ev) => (
                    <li
                      key={ev.id}
                      className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-sm active:bg-white/5"
                    >
                      <span className="w-10 shrink-0 font-mono text-xs text-white/50">
                        {formatMinute(ev.timestamp)}
                      </span>
                      <span className="text-lg">{eventIcon(ev.type)}</span>
                      <span className="min-w-0 flex-1 font-medium leading-snug">{eventLabel(ev)}</span>
                    </li>
                  ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Am Feld (7)</h2>
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 to-black/80 p-4">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-emerald-500/80">
                  Mini-Spielfeld
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {fieldPlayers.slice(0, 7).map((p) => (
                    <div
                      key={p.id}
                      className="flex w-[30%] min-w-[92px] max-w-[120px] flex-col items-center justify-center rounded-xl border border-white/10 bg-black/40 px-1 py-3"
                    >
                      <span className="text-lg font-black text-emerald-400">{p.number || '–'}</span>
                      <span className="mt-1 max-w-full truncate text-center text-xs font-semibold text-white">
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {mainTab === 'lineup' && (
          <div className="space-y-4">
            {canControlLiveMatch && (
              <p className="text-sm text-white/55">Tippe einen Spieler für Wechsel.</p>
            )}
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-emerald-500">Am Feld</h3>
              <ul className="space-y-2">
                {fieldPlayers.map((p) => (
                  <li key={p.id}>
                    {canControlLiveMatch && !matchIsFinished ? (
                      <button
                        type="button"
                        onClick={() => openSubFromPlayer(p)}
                        className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-emerald-600/40 bg-emerald-950/30 px-4 py-3 text-left active:bg-emerald-900/40"
                      >
                        <span className="text-lg font-bold text-emerald-400">{p.number || '–'}</span>
                        <span className="flex-1 px-3 text-base font-semibold">{p.name}</span>
                        <span className="rounded-full bg-emerald-600/30 px-2 py-1 text-xs font-bold text-emerald-300">
                          AM FELD
                        </span>
                      </button>
                    ) : (
                      <div className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-emerald-600/30 bg-emerald-950/20 px-4 py-3">
                        <span className="text-lg font-bold text-emerald-400">{p.number || '–'}</span>
                        <span className="flex-1 px-3 text-base font-semibold">{p.name}</span>
                        <span className="rounded-full bg-emerald-600/20 px-2 py-1 text-xs font-bold text-emerald-300/90">
                          AM FELD
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-white/40">Bank</h3>
              <ul className="space-y-2">
                {benchPlayers.map((p) => (
                  <li key={p.id}>
                    {canControlLiveMatch && !matchIsFinished ? (
                      <button
                        type="button"
                        onClick={() => openSubFromPlayer(p)}
                        className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left active:bg-white/10"
                      >
                        <span className="text-lg font-bold text-white/50">{p.number || '–'}</span>
                        <span className="flex-1 px-3 text-base font-semibold">{p.name}</span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white/50">
                          BANK
                        </span>
                      </button>
                    ) : (
                      <div className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 opacity-90">
                        <span className="text-lg font-bold text-white/50">{p.number || '–'}</span>
                        <span className="flex-1 px-3 text-base font-semibold">{p.name}</span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white/50">
                          BANK
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mainTab === 'events' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(
                [
                  ['all', 'Alle'],
                  ['goals', 'Tore'],
                  ['subs', 'Wechsel'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEventsFilter(key)}
                  className={`min-h-[44px] flex-1 rounded-xl px-2 text-sm font-bold ${
                    eventsFilter === key ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
              {filteredEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex min-h-[52px] items-center gap-3 rounded-xl border-b border-white/5 px-3 py-2 last:border-0"
                >
                  <span className="w-10 font-mono text-xs text-white/45">{formatMinute(ev.timestamp)}</span>
                  <span className="text-lg">{eventIcon(ev.type)}</span>
                  <span className="flex-1 text-sm font-medium">{eventLabel(ev)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mainTab === 'time' && (
          <div className="space-y-2">
            <p className="mb-2 text-sm text-white/55">Effektive Spielzeit (ohne Pausen)</p>
            <ul className="space-y-2">
              {sortRosterByNumber(roster.filter((p) => squadPlayerIds.includes(p.id))).map((p) => {
                const sec = playtimes[p.id] ?? 0;
                const st = getPlaytimeStatus(sec, currentMatchSeconds, squadPlayerIds.length);
                const onF = onFieldIds.includes(p.id);
                return (
                  <li
                    key={p.id}
                    className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 ${
                      onF ? 'border-emerald-500/35 bg-emerald-950/20' : 'border-white/10 bg-white/[0.04] opacity-85'
                    }`}
                  >
                    <span className={`h-3 w-3 shrink-0 rounded-full ${ampelDot(st)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {p.number || '–'} · {p.name}
                      </p>
                      <p className="text-xs text-white/45">{onF ? 'Am Feld' : 'Bank'}</p>
                    </div>
                    <span className="font-mono text-lg font-bold tabular-nums text-emerald-400">
                      {formatClock(sec)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {subOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm"
          role="presentation"
          onClick={() => setSubOpen(false)}
        >
          <div
            className="max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141414] px-4 pb-8 pt-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="text-center text-lg font-bold">Wechsel</h3>
            <p className="mt-1 text-center text-sm text-white/50">Raus + Rein wählen, dann bestätigen</p>

            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-red-400/90">Raus (vom Feld)</p>
                <div className="flex flex-wrap gap-2">
                  {fieldPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSubOutId(p.id)}
                      className={`min-h-[48px] min-w-[100px] flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                        subOutId === p.id ? 'bg-red-600 text-white' : 'bg-white/10 text-white active:bg-white/20'
                      }`}
                    >
                      {p.number || '–'} {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-emerald-400/90">Rein (von der Bank)</p>
                <div className="flex flex-wrap gap-2">
                  {benchPlayers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSubInId(p.id)}
                      className={`min-h-[48px] min-w-[100px] flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                        subInId === p.id ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white active:bg-white/20'
                      }`}
                    >
                      {p.number || '–'} {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={matchIsFinished || !subOutId || !subInId}
              onClick={confirmSub}
              className="mt-6 flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white disabled:opacity-35 active:scale-[0.99]"
            >
              ✔ Wechsel bestätigen
            </button>
            <button
              type="button"
              onClick={() => setSubOpen(false)}
              className="mt-3 w-full min-h-[48px] rounded-2xl border border-white/15 text-base font-semibold text-white/80"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMatchScreen;
