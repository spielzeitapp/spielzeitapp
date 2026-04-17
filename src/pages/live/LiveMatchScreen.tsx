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
  'flex-1 px-0.5 pb-3 pt-2 text-[11px] font-semibold tracking-wide transition-colors sm:px-1 sm:text-xs border-b-[3px] min-h-[48px]';
const tabActive = 'border-red-500 text-white';
const tabIdle = 'border-transparent text-white/40 hover:text-white/70';

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
  const [homeGoalModalOpen, setHomeGoalModalOpen] = useState(false);
  const [homeGoalPickId, setHomeGoalPickId] = useState<string>('');

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

  const homeScorerCandidates = useMemo(() => sortRosterByNumber(fieldPlayers), [fieldPlayers]);

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

  /** Nur für UI: Stand nach jedem Tor (chronologisch), kein Einfluss auf Persistenz. */
  const goalScoreBadgeByEventId = useMemo(() => {
    const sorted = sortMatchEventsChronologically(events);
    let h = 0;
    let a = 0;
    const map = new Map<string, string>();
    for (const ev of sorted) {
      if (ev.type === 'goal') {
        if (ev.playerId) h += 1;
        else a += 1;
        map.set(ev.id, `${h}:${a}`);
      }
    }
    return map;
  }, [events]);

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

  const renderTimelineRow = (
    ev: MatchEngineEvent,
    index: number,
    listLength: number,
    showGoalScoreBadge: boolean,
  ) => {
    const isGoal = ev.type === 'goal';
    const isSub = ev.type === 'sub_out' || ev.type === 'sub_in';
    const pl = ev.playerId ? rosterById.get(ev.playerId) : undefined;
    const scoreStr =
      showGoalScoreBadge && isGoal ? goalScoreBadgeByEventId.get(ev.id) ?? null : null;
    const iconTile = isGoal
      ? 'bg-gradient-to-b from-red-950 to-black text-red-100 shadow-[inset_0_1px_0_rgba(248,113,113,0.2)] ring-1 ring-red-600/50'
      : isSub
        ? 'bg-zinc-900 text-red-400 shadow-inner ring-1 ring-red-800/45'
        : 'bg-zinc-900/85 text-white/55 ring-1 ring-white/12';

    return (
      <li key={ev.id} className="relative flex gap-0 pb-5 last:pb-0">
        <div className="flex w-14 shrink-0 flex-col items-end pr-2 pt-1 sm:w-[3.75rem]">
          <span className="text-lg font-black tabular-nums leading-none text-white sm:text-xl">
            {formatMinute(ev.timestamp)}
          </span>
        </div>
        <div className="relative flex w-5 shrink-0 flex-col items-center pt-2">
          {index < listLength - 1 ? (
            <div
              className="absolute top-3 bottom-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-red-600/55 via-red-900/35 to-red-950/20"
              aria-hidden
            />
          ) : null}
          <div
            className="relative z-10 h-2.5 w-2.5 shrink-0 rounded-full bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.65)] ring-2 ring-black"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`flex min-h-[4.25rem] items-stretch gap-3 rounded-xl border border-white/[0.07] bg-gradient-to-br from-zinc-950/98 to-black px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.45)] ${
              isGoal ? 'border-red-800/30' : isSub ? 'border-red-950/25' : ''
            }`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg ${iconTile}`}
              aria-hidden
            >
              {eventIcon(ev.type)}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              {isGoal && ev.playerId ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-500">Tor Heim</p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-white">
                    {pl?.name ?? '?'}
                    {pl?.number != null && String(pl.number).trim() !== '' ? (
                      <span className="text-white/45"> ({pl.number})</span>
                    ) : null}
                  </p>
                </>
              ) : isGoal && !ev.playerId ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-400">Tor Gast</p>
                  <p className="mt-1 text-xs text-white/50">Gegentor</p>
                </>
              ) : isSub ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Wechsel</p>
                  <p
                    className={`mt-1 text-sm font-semibold leading-snug ${
                      ev.type === 'sub_out' ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {eventLabel(ev)}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-white/90">{eventLabel(ev)}</p>
              )}
            </div>
            {scoreStr ? (
              <div className="flex shrink-0 items-start pt-0.5">
                <span className="rounded-md border border-red-600/45 bg-red-950/55 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-red-100">
                  {scoreStr}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </li>
    );
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
    <div className="min-h-[100dvh] bg-black pb-28 text-white">
      <header className="sticky top-0 z-40 border-b border-red-950/50 bg-black/95 px-3 pt-3 pb-3 backdrop-blur-md">
        <div
          className="relative mx-auto max-w-lg overflow-hidden rounded-2xl border border-red-600/45 bg-black px-3 py-5 shadow-[0_0_48px_rgba(220,38,38,0.22),0_0_1px_rgba(248,113,113,0.35),inset_0_1px_0_rgba(255,255,255,0.07)] sm:px-5 sm:py-6"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 130% 90% at 50% -25%, rgba(153,27,27,0.45), transparent 50%), radial-gradient(ellipse 80% 50% at 80% 100%, rgba(127,29,29,0.2), transparent 45%), linear-gradient(180deg, rgba(9,9,11,0.97) 0%, rgba(0,0,0,1) 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(127,29,29,0.03) 2px, rgba(127,29,29,0.03) 4px)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-red-950/35 via-transparent to-transparent"
            aria-hidden
          />
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 sm:gap-x-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-black text-white shadow-inner ring-2 ring-red-900/55 sm:h-[4.5rem] sm:w-[4.5rem] sm:text-base"
                aria-hidden
              >
                {(homeName.slice(0, 1) || 'H').toUpperCase()}
              </div>
              <div className="min-w-0 py-0.5 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500 sm:text-[11px]">Heim</p>
                <p className="line-clamp-2 text-sm font-bold leading-tight text-white sm:text-[15px]">{homeName}</p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col items-center px-1 sm:px-2">
              <div
                className={`mb-2.5 flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] shadow-sm sm:text-[11px] ${
                  matchIsFinished
                    ? 'bg-zinc-700/95 text-zinc-200 ring-1 ring-white/15'
                    : hasClockStarted
                      ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)] ring-1 ring-red-400/70'
                      : 'bg-zinc-800/90 text-zinc-400 ring-1 ring-white/10'
                }`}
              >
                {!matchIsFinished && hasClockStarted ? (
                  <span className="text-[11px] leading-none text-white" aria-hidden>
                    ●
                  </span>
                ) : null}
                {matchIsFinished ? 'Beendet' : hasClockStarted ? 'Live' : 'Bereit'}
              </div>
              <div className="flex items-baseline justify-center gap-1.5 sm:gap-2">
                <span className="text-5xl font-black tabular-nums tracking-tighter text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] sm:text-6xl">
                  {scoreHome}
                </span>
                <span className="pb-1 text-3xl font-extralight text-white/25 sm:text-4xl">:</span>
                <span className="text-5xl font-black tabular-nums tracking-tighter text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] sm:text-6xl">
                  {scoreAway}
                </span>
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-zinc-500 sm:text-xs">
                {matchIsFinished ? (
                  <span className="text-zinc-500">Spiel beendet</span>
                ) : (
                  <span>{half}. Halbzeit</span>
                )}
              </p>
              <div
                className={`mt-1 text-center text-lg font-mono font-bold tabular-nums sm:text-xl ${
                  matchIsFinished ? 'text-zinc-500' : hasClockStarted && isRunning ? 'text-red-500' : 'text-red-500/75'
                }`}
              >
                {formatClock(currentMatchSeconds)}
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-3">
              <div className="min-w-0 py-0.5 text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 sm:text-[11px]">Gast</p>
                <p className="line-clamp-2 text-sm font-bold leading-tight text-white sm:text-[15px]">{headerOpponent}</p>
              </div>
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-black text-amber-100 shadow-inner ring-2 ring-red-900/50 sm:h-[4.5rem] sm:w-[4.5rem] sm:text-base"
                aria-hidden
              >
                {(headerOpponent.slice(0, 1) || 'G').toUpperCase()}
              </div>
            </div>
          </div>

          {(!canControlLiveMatch || matchIsFinished) && (
            <p className="relative mt-2 text-center text-[10px] text-white/30">Zuschaueransicht</p>
          )}
          {saveError && (
            <p className="relative mt-2 text-center text-xs font-medium text-amber-400/95" role="alert">
              {saveError}
            </p>
          )}

          {canControlLiveMatch && !matchIsFinished && (
            <>
              <div className="relative mt-5 flex gap-2">
                <button
                  type="button"
                  disabled={matchIsFinished}
                  onClick={() => {
                    setHomeGoalPickId('');
                    setHomeGoalModalOpen(true);
                  }}
                  className="flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-red-600 to-red-800 px-2 text-[10px] font-bold text-white shadow-[0_4px_20px_rgba(220,38,38,0.4)] ring-1 ring-red-400/50 active:brightness-95 disabled:opacity-35 sm:text-xs"
                >
                  <span className="text-sm brightness-110 contrast-125" aria-hidden>
                    ⚽
                  </span>
                  <span className="truncate">+ Tor Heim</span>
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
                  className="flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-600 bg-zinc-900/95 px-2 text-[10px] font-bold text-white shadow-inner active:bg-zinc-800 disabled:opacity-35 sm:text-xs"
                >
                  <span className="text-sm text-white drop-shadow-sm" aria-hidden>
                    ⚽
                  </span>
                  <span className="truncate">+ Tor Gast</span>
                </button>
                <button
                  type="button"
                  disabled={matchIsFinished}
                  onClick={() => setMainTab('overview')}
                  className="flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-900/50 bg-zinc-950 px-2 text-[10px] font-bold text-white/95 active:bg-zinc-900 disabled:opacity-35 sm:text-xs"
                >
                  <span className="text-sm text-red-500" aria-hidden>
                    🔁
                  </span>
                  <span className="truncate">Wechsel</span>
                </button>
                <button
                  type="button"
                  onClick={onEndClick}
                  disabled={matchIsFinished}
                  className="flex min-h-[42px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-red-600/70 bg-zinc-950 px-2 text-[10px] font-bold text-red-200 active:bg-red-950/30 disabled:opacity-35 sm:text-xs"
                >
                  <span className="text-sm text-red-500" aria-hidden>
                    ⏹
                  </span>
                  <span className="truncate">Spiel beenden</span>
                </button>
              </div>

              <div className="relative mt-2 flex flex-wrap gap-1.5 border-t border-white/5 pt-2">
                <button
                  type="button"
                  onClick={onStartClick}
                  disabled={isRunning || matchIsFinished}
                  className="min-h-[34px] flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 text-[10px] font-medium text-white/80 disabled:opacity-40 sm:text-xs"
                >
                  {!hasClockStarted ? 'Anpfiff' : 'Weiter'}
                </button>
                <button
                  type="button"
                  onClick={onPauseClick}
                  disabled={!isRunning || matchIsFinished}
                  className="min-h-[34px] flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 text-[10px] font-medium text-white/80 disabled:opacity-40 sm:text-xs"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (matchIsFinished) return;
                    startSecondHalf();
                  }}
                  disabled={matchIsFinished}
                  className="min-h-[34px] w-full rounded-md border border-red-900/30 bg-red-950/20 px-2 text-[10px] font-medium text-red-200/80 disabled:opacity-35 sm:w-auto sm:flex-1 sm:text-xs"
                >
                  2. Halbzeit
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="sticky top-[var(--live-header-h,auto)] z-30 border-b border-red-950/35 bg-black/98 px-3 pt-1 pb-0">
        <div className="mx-auto flex max-w-lg items-end justify-between gap-0">
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
              <ul className="space-y-3">
                {sortRosterByNumber(roster.filter((p) => squadPlayerIds.includes(p.id))).map((p) => {
                  const sec = playtimes[p.id] ?? 0;
                  const st = getPlaytimeStatus(sec, currentMatchSeconds, squadPlayerIds.length);
                  const onF = onFieldIds.includes(p.id);
                  return (
                    <li
                      key={p.id}
                      className={`flex min-h-[64px] items-center gap-4 rounded-2xl border px-4 py-4 ${
                        onF
                          ? 'border-emerald-500/35 bg-gradient-to-br from-emerald-950/55 via-black/40 to-black shadow-[0_0_28px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/25'
                          : 'border-white/[0.06] bg-zinc-950/50 opacity-85 ring-1 ring-white/[0.04]'
                      }`}
                    >
                      <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${ampelDot(st)}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-white">
                          {p.number || '–'} · {p.name}
                        </p>
                        <p
                          className={`mt-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
                            onF ? 'text-emerald-400' : 'text-white/38'
                          }`}
                        >
                          {onF ? 'Am Feld' : 'Auf der Bank'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-2xl font-black tabular-nums tracking-tight ${
                          onF ? 'text-red-500' : 'text-white/40'
                        }`}
                      >
                        {formatClock(sec)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Wechsel-Vorschläge</h2>
              <div className="space-y-3">
                <div className="rounded-2xl border border-emerald-800/35 bg-gradient-to-br from-emerald-950/35 to-black/80 p-4 ring-1 ring-emerald-700/15">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/95">
                    Spielzeit erreicht
                  </p>
                  <p className="mt-3 text-sm text-white/40">Hinweise zu Einwechslungen erscheinen hier.</p>
                </div>
                <div className="rounded-2xl border border-amber-800/35 bg-gradient-to-br from-amber-950/25 to-black/80 p-4 ring-1 ring-amber-700/15">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400/95">
                    Wenig Spielzeit
                  </p>
                  <p className="mt-3 text-sm text-white/40">Optionen für mehr Einsatzzeit erscheinen hier.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Spielverlauf</h2>
              <ul className="rounded-2xl border border-red-950/30 bg-black/50 px-1 py-4 sm:px-2">
                {events
                  .filter((e) => e.type !== 'pause')
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 12)
                  .map((ev, i, arr) => renderTimelineRow(ev, i, arr.length, true))}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                Am Feld ({fieldPlayers.length})
              </h2>
              <div className="relative overflow-hidden rounded-2xl border-2 border-red-900/40 bg-gradient-to-b from-[#0a100a] via-[#050805] to-black p-4 shadow-[0_0_36px_rgba(127,29,29,0.2)]">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg, transparent, transparent 10px, rgba(220,38,38,0.35) 10px, rgba(220,38,38,0.35) 11px)',
                  }}
                  aria-hidden
                />
                <p className="relative mb-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-red-500/90">
                  Mini-Spielfeld
                </p>
                <div className="relative mx-auto max-w-sm rounded-lg border border-red-800/50 bg-[#071207] p-3 ring-1 ring-red-950/60">
                  <div
                    className="pointer-events-none absolute inset-2 rounded-md border border-dashed border-red-800/35"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-red-700/40"
                    aria-hidden
                  />
                  <div className="relative flex flex-wrap justify-center gap-2">
                    {fieldPlayers.slice(0, 7).map((p) => (
                      <div
                        key={p.id}
                        className="flex w-[30%] min-w-[88px] max-w-[118px] flex-col items-center justify-center rounded-2xl border border-red-900/45 bg-black/70 px-1.5 py-2.5 shadow-[0_0_14px_rgba(220,38,38,0.12)] ring-1 ring-black"
                      >
                        <span className="text-base font-black tabular-nums text-red-400">{p.number || '–'}</span>
                        <span className="mt-1 max-w-full truncate text-center text-[11px] font-semibold leading-tight text-white">
                          {p.name}
                        </span>
                      </div>
                    ))}
                  </div>
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
            <div className="flex gap-1.5 sm:gap-2">
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
                  className={`min-h-[34px] flex-1 rounded-full px-2 py-1.5 text-[11px] font-bold tracking-wide transition-colors sm:min-h-[36px] sm:text-xs ${
                    eventsFilter === key
                      ? 'bg-red-600 text-white shadow-[0_0_18px_rgba(220,38,38,0.35)] ring-1 ring-red-400/45'
                      : 'bg-zinc-950 text-white/42 ring-1 ring-white/[0.07] hover:text-white/65'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {filteredEvents.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.06] bg-zinc-950/40 px-4 py-8 text-center text-sm text-white/45">
                Keine Events für diesen Filter.
              </p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto rounded-2xl border border-red-950/30 bg-black/50 px-1 py-4 sm:px-2">
                {filteredEvents.map((ev, i, arr) => renderTimelineRow(ev, i, arr.length, true))}
              </ul>
            )}
          </div>
        )}

        {mainTab === 'time' && (
          <div className="space-y-2">
            <p className="mb-2 text-sm text-white/55">Effektive Spielzeit (ohne Pausen)</p>
            <ul className="space-y-3">
              {sortRosterByNumber(roster.filter((p) => squadPlayerIds.includes(p.id))).map((p) => {
                const sec = playtimes[p.id] ?? 0;
                const st = getPlaytimeStatus(sec, currentMatchSeconds, squadPlayerIds.length);
                const onF = onFieldIds.includes(p.id);
                return (
                  <li
                    key={p.id}
                    className={`flex min-h-[64px] items-center gap-4 rounded-2xl border px-4 py-4 ${
                      onF
                        ? 'border-emerald-500/35 bg-gradient-to-br from-emerald-950/55 via-black/40 to-black shadow-[0_0_28px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/25'
                        : 'border-white/[0.06] bg-zinc-950/50 opacity-85 ring-1 ring-white/[0.04]'
                    }`}
                  >
                    <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${ampelDot(st)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-white">
                        {p.number || '–'} · {p.name}
                      </p>
                      <p
                        className={`mt-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
                          onF ? 'text-emerald-400' : 'text-white/38'
                        }`}
                      >
                        {onF ? 'Am Feld' : 'Auf der Bank'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-2xl font-black tabular-nums tracking-tight ${
                        onF ? 'text-red-500' : 'text-white/40'
                      }`}
                    >
                      {formatClock(sec)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {homeGoalModalOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm"
          role="presentation"
          onClick={() => setHomeGoalModalOpen(false)}
        >
          <div
            className="max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141414] px-4 pb-8 pt-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="text-center text-lg font-bold">Heimtor</h3>
            <p className="mt-1 text-center text-sm text-white/50">Torschütze wählen, dann bestätigen</p>

            <div className="mt-5">
              <p className="mb-2 text-xs font-bold uppercase text-emerald-400/90">Am Feld</p>
              <div className="flex flex-wrap gap-2">
                {homeScorerCandidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setHomeGoalPickId(p.id)}
                    className={`min-h-[48px] min-w-[100px] flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                      homeGoalPickId === p.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/10 text-white active:bg-white/20'
                    }`}
                  >
                    {p.number || '–'} {p.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!homeGoalPickId}
              onClick={async () => {
                if (!homeGoalPickId || !effectiveMatchId) return;
                const ok = await persistSingle({
                  type: 'goal',
                  timestamp: currentMatchSeconds,
                  playerId: homeGoalPickId,
                });
                if (!ok) return;
                setScoreHome((s) => {
                  const n = s + 1;
                  if (effectiveMatchId) void updateMatchRow(effectiveMatchId, { score_home: n });
                  return n;
                });
                setHomeGoalModalOpen(false);
                setHomeGoalPickId('');
              }}
              className="mt-6 flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white disabled:opacity-35 active:scale-[0.99]"
            >
              Tor bestätigen
            </button>
            <button
              type="button"
              onClick={() => setHomeGoalModalOpen(false)}
              className="mt-3 w-full min-h-[48px] rounded-2xl border border-white/15 text-base font-semibold text-white/80"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

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
