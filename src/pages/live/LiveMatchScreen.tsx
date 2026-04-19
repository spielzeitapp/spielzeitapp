import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { usePlayers } from '../../hooks/usePlayers';
import { useMatchTimer } from '../../hooks/useMatchTimer';
import {
  MATCH_HALF_DURATION_SEC,
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
import { getClubLogo, getOurTeamDisplayName, getTeamInitials } from '../../lib/teamLogos';

const HOME_FALLBACK = 'Unser Team';

/** Logo-Kachel: gleiche Größe/Stil wie Gegner; bei Fehler Initialen (wie Match-Karten-Fallback). */
function LiveMatchLogoTile({
  src,
  initialsFrom,
  liveGlow,
  size = 'md',
}: {
  src: string;
  initialsFrom: string;
  liveGlow: boolean;
  size?: 'md' | 'hero';
}) {
  const [failed, setFailed] = useState(false);
  const glow = liveGlow ? 'shadow-[0_0_12px_rgba(255,0,0,0.3)]' : '';
  const box =
    size === 'hero'
      ? 'h-16 w-16 sm:h-[4.25rem] sm:w-[4.25rem]'
      : 'h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem]';
  const imgClass =
    size === 'hero'
      ? 'max-h-[3.25rem] max-w-[3.25rem] object-contain p-0.5 sm:max-h-[3.5rem] sm:max-w-[3.5rem]'
      : 'max-h-11 max-w-11 object-contain p-0.5 sm:max-h-[3rem] sm:max-w-[3rem]';
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-red-500/40 bg-zinc-950/95 ${box} ${glow}`}
    >
      {!failed ? (
        <img
          src={src}
          alt=""
          className={imgClass}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="select-none text-base font-black tabular-nums text-white sm:text-lg" aria-hidden>
          {getTeamInitials(initialsFrom)}
        </span>
      )}
    </div>
  );
}

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinute(ts: number): string {
  const min = Math.floor(ts / 60);
  return `${min}'`;
}

/** Anzeige ohne Jugend-Staffel-Suffix im Hauptnamen (z. B. „ … U11“). */
function cleanTeamDisplayName(name: string): string {
  const t = (name || '').trim();
  if (!t) return '';
  const noU = t.replace(/\s+U\d{1,2}\b.*$/i, '').trim();
  return noU || t;
}

/** Drittel-/Halbzeit-Stand aus Event-Zeitstempeln (gleiche Grenzen wie Uhr). */
function buildPeriodScoreLine(events: MatchEngineEvent[], currentMatchSeconds: number): string {
  const b1 = MATCH_HALF_DURATION_SEC;
  const b2 = MATCH_HALF_DURATION_SEC * 2;
  const sorted = sortMatchEventsChronologically(events);
  const p1 = [0, 0];
  const p2 = [0, 0];
  const p3 = [0, 0];
  for (const e of sorted) {
    if (e.type !== 'goal') continue;
    const t = e.timestamp;
    const homeGoal = Boolean(e.playerId);
    if (t < b1) {
      if (homeGoal) p1[0] += 1;
      else p1[1] += 1;
    } else if (t < b2) {
      if (homeGoal) p2[0] += 1;
      else p2[1] += 1;
    } else {
      if (homeGoal) p3[0] += 1;
      else p3[1] += 1;
    }
  }
  const seg = (h: number, a: number, started: boolean) => (started ? `${h}:${a}` : '-:-');
  const s1 = seg(p1[0], p1[1], currentMatchSeconds > 0 || p1[0] + p1[1] > 0);
  const s2 = seg(p2[0], p2[1], currentMatchSeconds >= b1 || p2[0] + p2[1] > 0);
  const s3 = seg(p3[0], p3[1], currentMatchSeconds >= b2 || p3[0] + p3[1] > 0);
  return `(${s1} | ${s2} | ${s3})`;
}

const tabPillBase =
  'min-h-[44px] flex-1 rounded-full border px-2 text-[10px] font-bold uppercase tracking-wide transition-all sm:px-3 sm:text-[11px]';
const tabPillActive =
  'border-red-500/60 bg-gradient-to-b from-red-700 to-red-950 text-white shadow-[0_6px_22px_rgba(220,38,38,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]';
const tabPillIdle =
  'border-white/10 bg-zinc-950/90 text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-white/18 hover:text-zinc-200';

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
  const homeDisplayName = cleanTeamDisplayName(homeName);
  const awayDisplayName = cleanTeamDisplayName(headerOpponent);
  /** Ohne API-Erweiterung: neutraler Anzeige-Spieltyp (Zielbild). */
  const matchTypeDisplay = 'Freundschaftsspiel';
  const [mainTab, setMainTab] = useState<'overview' | 'lineup' | 'events' | 'time'>('overview');
  const [eventsFilter, setEventsFilter] = useState<EventsFilter>('all');

  const [subOpen, setSubOpen] = useState(false);
  const [subOutId, setSubOutId] = useState<string>('');
  const [subInId, setSubInId] = useState<string>('');

  const [wechselOutId, setWechselOutId] = useState<string>('');
  const [wechselInId, setWechselInId] = useState<string>('');
  const [homeGoalModalOpen, setHomeGoalModalOpen] = useState(false);
  const [homeGoalPickId, setHomeGoalPickId] = useState<string>('');
  const [endMatchConfirmOpen, setEndMatchConfirmOpen] = useState(false);

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

  const periodScoreLine = useMemo(
    () => buildPeriodScoreLine(events, currentMatchSeconds),
    [events, currentMatchSeconds],
  );

  const periodDisplayLine = useMemo(() => {
    if (matchIsFinished) return 'SPIEL BEENDET';
    const lp = matchRow?.live_period;
    if (typeof lp === 'number' && lp >= 1 && lp <= 3) return `${lp}. DRITTEL`;
    return `${half}. HALBZEIT`;
  }, [matchIsFinished, matchRow?.live_period, half]);

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
    const isHomeGoal = isGoal && Boolean(ev.playerId);
    const isAwayGoal = isGoal && !ev.playerId;
    const pl = ev.playerId ? rosterById.get(ev.playerId) : undefined;
    const scoreStr =
      showGoalScoreBadge && isGoal ? goalScoreBadgeByEventId.get(ev.id) ?? null : null;
    const iconTile = isHomeGoal
      ? 'bg-gradient-to-b from-emerald-800 to-emerald-950 text-white shadow-[inset_0_1px_0_rgba(167,243,208,0.25)] ring-1 ring-emerald-400/55'
      : isAwayGoal
        ? 'bg-gradient-to-b from-red-800 to-black text-red-100 shadow-[inset_0_1px_0_rgba(248,113,113,0.2)] ring-1 ring-red-500/55'
        : isSub
          ? 'bg-zinc-800 text-zinc-200 shadow-inner ring-1 ring-white/15'
          : 'bg-zinc-900/85 text-white/55 ring-1 ring-white/12';

    const cardBorder = isHomeGoal
      ? 'border-emerald-500/45 shadow-[0_0_20px_rgba(16,185,129,0.12)]'
      : isAwayGoal
        ? 'border-red-600/45 shadow-[0_0_20px_rgba(220,38,38,0.14)]'
        : isSub
          ? 'border-white/12'
          : 'border-white/[0.08]';

    const scorePillClass = isHomeGoal
      ? 'rounded-full border border-emerald-400/50 bg-emerald-950/80 px-2.5 py-1 font-mono text-[11px] font-black tabular-nums text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.25)]'
      : 'rounded-full border border-red-500/50 bg-red-950/80 px-2.5 py-1 font-mono text-[11px] font-black tabular-nums text-red-100 shadow-[0_0_14px_rgba(220,38,38,0.25)]';

    return (
      <li key={ev.id} className="relative flex gap-0 pb-5 last:pb-0">
        <div className="flex w-[3.25rem] shrink-0 flex-col items-end pr-2 pt-1.5 sm:w-16">
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
            className={`flex min-h-[4.25rem] items-stretch gap-3 rounded-2xl border-2 bg-gradient-to-br from-zinc-950 to-black px-3.5 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.55)] ${cardBorder}`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${iconTile}`}
              aria-hidden
            >
              {eventIcon(ev.type)}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              {isHomeGoal ? (
                <>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-400">Tor</p>
                  <p className="mt-0.5 truncate text-xs font-bold text-white">{homeDisplayName}</p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-white">
                    {pl?.name ?? '?'}
                    {pl?.number != null && String(pl.number).trim() !== '' ? (
                      <span className="text-white/45"> ({pl.number})</span>
                    ) : null}
                  </p>
                </>
              ) : isAwayGoal ? (
                <>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-red-400">Tor</p>
                  <p className="mt-0.5 truncate text-xs font-bold text-white">{awayDisplayName}</p>
                  <p className="mt-1 text-xs font-medium text-white/55">Gegentor</p>
                </>
              ) : isSub ? (
                <>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">Wechsel</p>
                  <p
                    className={`mt-1 text-sm font-semibold leading-snug ${
                      ev.type === 'sub_out' ? 'text-red-300' : 'text-emerald-300'
                    }`}
                  >
                    {eventLabel(ev)}
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-white/90">{eventLabel(ev)}</p>
              )}
            </div>
            {scoreStr ? (
              <div className="flex shrink-0 items-start pt-0.5">
                <span className={scorePillClass}>{scoreStr}</span>
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

  const homeLogoLookupName =
    selectedTeamSeason?.team?.name?.trim() && selectedTeamSeason.team.name.trim() !== HOME_FALLBACK
      ? selectedTeamSeason.team.name.trim()
      : getOurTeamDisplayName();
  const homeLogoSrc = getClubLogo(homeLogoLookupName);
  const awayLogoSrc = getClubLogo(headerOpponent);
  const logoLiveGlow = !matchIsFinished;

  return (
    <div className="min-h-[100dvh] bg-black pb-28 text-white">
      <header className="sticky top-0 z-40 border-b border-red-950/40 bg-black/95 px-3 pt-2 pb-3 backdrop-blur-md">
        <div
          className={[
            'relative mx-auto max-w-lg overflow-hidden rounded-2xl bg-gradient-to-b from-black via-black to-red-950/40',
            'px-[15px] pt-3 pb-4 sm:pb-5',
            matchIsFinished
              ? 'border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'border-2 border-red-500/55 shadow-[0_0_56px_rgba(255,0,0,0.42),0_0_1px_rgba(255,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_0_32px_rgba(127,29,29,0.2)]',
          ].join(' ')}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.38]"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(153,27,27,0.4), transparent 55%)',
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-1.5 pb-2 text-center">
            <div
              className={`flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-[0.26em] sm:text-[11px] ${
                matchIsFinished
                  ? 'bg-zinc-800 text-zinc-200 ring-1 ring-white/18'
                  : hasClockStarted
                    ? 'bg-gradient-to-b from-red-600 to-red-950 text-white shadow-[0_0_28px_rgba(239,68,68,0.65),0_0_48px_rgba(220,38,38,0.25)] ring-2 ring-red-400/65'
                    : 'bg-zinc-900 text-zinc-400 ring-1 ring-white/14'
              }`}
            >
              {!matchIsFinished && hasClockStarted ? (
                <span className="text-[12px] leading-none text-red-100" aria-hidden>
                  ●
                </span>
              ) : null}
              {matchIsFinished ? 'ENDSTAND' : hasClockStarted ? 'LIVE' : 'BEREIT'}
            </div>
            <p className="text-sm font-bold tracking-wide text-white sm:text-[15px]">{matchTypeDisplay}</p>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-500 drop-shadow-[0_0_14px_rgba(239,68,68,0.55)] sm:text-xs">
              {periodDisplayLine}
            </p>
          </div>

          <div className="relative mt-1 flex flex-col items-center px-1">
            <div className="flex items-center justify-center gap-4 sm:gap-6">
              <span className="text-5xl font-black tabular-nums tracking-tight text-white drop-shadow-[0_4px_28px_rgba(0,0,0,0.92)] sm:text-[3.5rem]">
                {scoreHome}
              </span>
              <span
                className="select-none pb-1 text-5xl font-extralight leading-none text-white/35 sm:text-[3.25rem]"
                aria-hidden
              >
                :
              </span>
              <span className="text-5xl font-black tabular-nums tracking-tight text-white drop-shadow-[0_4px_28px_rgba(0,0,0,0.92)] sm:text-[3.5rem]">
                {scoreAway}
              </span>
            </div>
            <p className="mt-2 text-center font-mono text-[11px] font-bold tabular-nums tracking-wide text-white/80 sm:text-xs">
              {periodScoreLine}
            </p>
          </div>

          <div className="relative mt-2 space-y-1 border-b border-white/[0.1] pb-3 text-center">
            {matchRow?.location ? (
              <p className="text-[13px] font-semibold text-zinc-300">📍 {matchRow.location}</p>
            ) : (
              <p className="text-[13px] font-semibold text-zinc-500">📍 —</p>
            )}
            <p
              className={`font-mono text-2xl font-black tabular-nums sm:text-[1.75rem] ${
                matchIsFinished ? 'text-zinc-500' : 'text-red-500 drop-shadow-[0_0_16px_rgba(239,68,68,0.45)]'
              }`}
            >
              ⏱ {formatClock(currentMatchSeconds)}
            </p>
          </div>

          <div className="relative mt-3 grid grid-cols-2 gap-3 px-0.5 sm:gap-5">
            <div className="flex min-w-0 flex-col items-center text-center">
              <LiveMatchLogoTile
                src={homeLogoSrc}
                initialsFrom={homeLogoLookupName}
                liveGlow={logoLiveGlow}
                size="hero"
              />
              <p className="mt-2 line-clamp-2 w-full max-w-[11.5rem] text-[14px] font-bold leading-tight text-white sm:text-[15px]">
                {homeDisplayName}
              </p>
              {canControlLiveMatch && !matchIsFinished ? (
                <button
                  type="button"
                  onClick={() => {
                    setHomeGoalPickId('');
                    setHomeGoalModalOpen(true);
                  }}
                  className="mt-2 flex min-h-[44px] w-full max-w-[11.5rem] items-center justify-center rounded-xl border-2 border-emerald-400/55 bg-gradient-to-b from-emerald-500 to-emerald-950 px-2 text-[13px] font-black uppercase tracking-wide text-white shadow-[0_0_22px_rgba(16,185,129,0.35)] active:scale-[0.98]"
                >
                  + TOR
                </button>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col items-center text-center">
              <LiveMatchLogoTile
                src={awayLogoSrc}
                initialsFrom={headerOpponent}
                liveGlow={logoLiveGlow}
                size="hero"
              />
              <p className="mt-2 line-clamp-2 w-full max-w-[11.5rem] text-[14px] font-bold leading-tight text-white sm:text-[15px]">
                {awayDisplayName}
              </p>
              {canControlLiveMatch && !matchIsFinished ? (
                <button
                  type="button"
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
                  className="mt-2 flex min-h-[44px] w-full max-w-[11.5rem] items-center justify-center rounded-xl border-2 border-red-500/60 bg-gradient-to-b from-red-600 to-red-950 px-2 text-[13px] font-black uppercase tracking-wide text-white shadow-[0_0_22px_rgba(220,38,38,0.4)] active:scale-[0.98]"
                >
                  + TOR
                </button>
              ) : null}
            </div>
          </div>

          {(!canControlLiveMatch || matchIsFinished) && (
            <p className="relative mt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Zuschaueransicht
            </p>
          )}
          {saveError && (
            <p className="relative mt-2 text-center text-xs font-medium text-amber-400/95" role="alert">
              {saveError}
            </p>
          )}

          {canControlLiveMatch && !matchIsFinished && (
            <>
              <div className="relative mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onStartClick}
                  disabled={isRunning || matchIsFinished}
                  className={[
                    'min-h-[50px] flex-1 rounded-xl border-2 px-1.5 text-[11px] font-black uppercase tracking-wide active:scale-[0.98] sm:min-h-[52px] sm:text-[12px]',
                    isRunning || matchIsFinished
                      ? 'border-emerald-950/60 bg-emerald-950/25 text-emerald-900/40'
                      : !hasClockStarted
                        ? 'border-emerald-400/65 bg-gradient-to-b from-emerald-500 to-emerald-950 text-white shadow-[0_0_26px_rgba(16,185,129,0.38)]'
                        : 'border-emerald-700/55 bg-gradient-to-b from-emerald-800 to-emerald-950 text-emerald-50',
                  ].join(' ')}
                >
                  {!hasClockStarted ? 'BEGINN' : 'WEITER'}
                </button>
                <button
                  type="button"
                  onClick={onPauseClick}
                  disabled={!isRunning || matchIsFinished}
                  className={[
                    'min-h-[50px] flex-1 rounded-xl border-2 px-1.5 text-[11px] font-black uppercase tracking-wide active:scale-[0.98] sm:min-h-[52px] sm:text-[12px]',
                    isRunning && !matchIsFinished
                      ? 'border-amber-400/70 bg-gradient-to-b from-amber-500 to-amber-900 text-black shadow-[0_0_26px_rgba(245,158,11,0.42)]'
                      : 'border-amber-950/50 bg-amber-950/25 text-amber-900/35',
                  ].join(' ')}
                >
                  PAUSE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (matchIsFinished) return;
                    startSecondHalf();
                  }}
                  disabled={matchIsFinished || currentMatchSeconds >= MATCH_HALF_DURATION_SEC}
                  className={[
                    'min-h-[50px] flex-1 rounded-xl border-2 px-1.5 text-[11px] font-black uppercase tracking-wide active:scale-[0.98] sm:min-h-[52px] sm:text-[12px]',
                    matchIsFinished || currentMatchSeconds >= MATCH_HALF_DURATION_SEC
                      ? 'border-red-950/50 bg-red-950/20 text-red-900/35'
                      : 'border-red-500/55 bg-gradient-to-b from-red-800 to-red-950 text-red-50 shadow-[0_0_18px_rgba(220,38,38,0.22)]',
                  ].join(' ')}
                >
                  ENDE
                </button>
              </div>

              <button
                type="button"
                onClick={() => setMainTab('overview')}
                className="relative mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-white/18 bg-zinc-900 text-[13px] font-black uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-[0.99]"
              >
                <span aria-hidden>⇄</span>
                WECHSEL
              </button>

              <button
                type="button"
                onClick={() => setEndMatchConfirmOpen(true)}
                className="relative mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-red-500/70 bg-zinc-950 text-[12px] font-black uppercase tracking-wide text-red-100 shadow-[0_0_20px_rgba(220,38,38,0.15)] active:scale-[0.99]"
              >
                <span className="text-base" aria-hidden>
                  🏁
                </span>
                SPIEL ABSCHLIESSEN
              </button>
            </>
          )}
        </div>
      </header>

      <div className="sticky top-[var(--live-header-h,auto)] z-30 border-b border-red-950/40 bg-black/98 px-3 py-2.5">
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1.5 sm:gap-2">
          <button
            type="button"
            className={`${tabPillBase} ${mainTab === 'overview' ? tabPillActive : tabPillIdle}`}
            onClick={() => setMainTab('overview')}
          >
            Übersicht
          </button>
          <button
            type="button"
            className={`${tabPillBase} ${mainTab === 'lineup' ? tabPillActive : tabPillIdle}`}
            onClick={() => setMainTab('lineup')}
          >
            Aufstellung
          </button>
          <button
            type="button"
            className={`${tabPillBase} ${mainTab === 'events' ? tabPillActive : tabPillIdle}`}
            onClick={() => setMainTab('events')}
          >
            Events
          </button>
          <button
            type="button"
            className={`${tabPillBase} ${mainTab === 'time' ? tabPillActive : tabPillIdle}`}
            onClick={() => setMainTab('time')}
          >
            Statistik
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
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">Liveticker</h2>
                <button
                  type="button"
                  onClick={() => setMainTab('events')}
                  className="shrink-0 rounded-full border-2 border-red-500/50 bg-gradient-to-b from-red-900/90 to-zinc-950 px-3.5 py-2 text-[10px] font-black uppercase tracking-wide text-red-50 shadow-[0_4px_18px_rgba(220,38,38,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] transition-transform hover:scale-[1.03] active:scale-[0.98] sm:text-[11px]"
                >
                  Alle Events →
                </button>
              </div>
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

      {endMatchConfirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => setEndMatchConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border-2 border-red-500/55 bg-zinc-950 p-5 shadow-[0_0_40px_rgba(0,0,0,0.85)] sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-match-title"
          >
            <h3 id="end-match-title" className="text-xl font-black text-white sm:text-2xl">
              Spiel wirklich abschließen?
            </h3>
            <p className="mt-3 text-[15px] font-medium leading-snug text-zinc-300 sm:text-base">
              Das Spiel wird beendet und als Endstand gespeichert.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-row-reverse">
              <button
                type="button"
                className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-red-600 to-red-950 text-base font-black uppercase tracking-wide text-white shadow-[0_0_24px_rgba(220,38,38,0.35)] active:scale-[0.99]"
                onClick={async () => {
                  setEndMatchConfirmOpen(false);
                  await onEndClick();
                }}
              >
                Abschließen
              </button>
              <button
                type="button"
                className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl border-2 border-white/20 bg-zinc-900 text-base font-bold text-white active:scale-[0.99]"
                onClick={() => setEndMatchConfirmOpen(false)}
              >
                Abbrechen
              </button>
            </div>
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
