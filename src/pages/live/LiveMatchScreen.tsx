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
      ? 'h-[3.15rem] w-[3.15rem] md:h-[3.85rem] md:w-[3.85rem] lg:h-16 lg:w-16'
      : 'h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem]';
  const imgClass =
    size === 'hero'
      ? 'max-h-[2.85rem] max-w-[2.85rem] object-contain p-0.5 md:max-h-[3.45rem] md:max-w-[3.45rem] lg:max-h-[3.55rem] lg:max-w-[3.55rem]'
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

/** Kurze Spielstätte: erste Zeile, bei Komma meist nur erster Teil (ohne volle Adresse). */
function shortVenueLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  const oneLine = raw.split(/\r?\n/)[0].trim();
  const comma = oneLine.indexOf(',');
  if (comma > 0 && comma < oneLine.length - 1) {
    const first = oneLine.slice(0, comma).trim();
    if (first.length >= 3 && first.length <= 44) return first;
  }
  if (oneLine.length <= 38) return oneLine;
  const cut = oneLine.slice(0, 35).trimEnd();
  return `${cut}…`;
}

/** Anzeige ohne Jugend-Staffel (inkl. U11 / u11 / Klammern). */
function cleanTeamDisplayName(name: string): string {
  const raw = (name || '').trim();
  if (!raw) return '';
  let t = raw
    .replace(/\s*[\(\[]\s*U\d{1,2}\s*[\)\]]/gi, '')
    .replace(/\s*-\s*U\d{1,2}\b.*$/i, '')
    .replace(/\s+U\d{1,2}\b.*$/i, '')
    .replace(/\bU\d{1,2}\b/gi, '')
    .replace(/\bu\d{1,2}\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  t = t.replace(/[\s\-–]+$/g, '').trim();
  return t || raw;
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
  'min-w-[4.75rem] shrink-0 rounded-full border px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide transition-all md:min-w-0 md:flex-1 md:px-3 md:py-2.5 md:text-[10px] lg:min-h-[48px] lg:text-[11px]';
const tabPillActive =
  'border-red-500/80 bg-gradient-to-b from-red-600 to-red-950 text-white shadow-[0_6px_20px_rgba(220,38,38,0.45),inset_0_1px_0_rgba(255,255,255,0.14)] md:shadow-[0_8px_26px_rgba(220,38,38,0.5)]';
const tabPillIdle =
  'border-zinc-500/55 bg-zinc-900 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-zinc-400 hover:text-white';

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

  const venueShort = useMemo(() => shortVenueLabel(matchRow?.location), [matchRow?.location]);

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
      <li key={ev.id} className="relative flex gap-0 pb-3.5 last:pb-0 md:pb-5">
        <div className="flex w-12 shrink-0 flex-col items-end pr-1.5 pt-1 md:w-16 md:pr-2 md:pt-1.5">
          <span className="text-base font-black tabular-nums leading-none text-white md:text-lg">
            {formatMinute(ev.timestamp)}
          </span>
        </div>
        <div className="relative flex w-4 shrink-0 flex-col items-center pt-1.5 md:w-5 md:pt-2">
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
            className={`flex min-h-[3.5rem] items-stretch gap-2 rounded-xl border-2 bg-gradient-to-br from-zinc-950 to-black px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)] md:min-h-[4.25rem] md:gap-3 md:rounded-2xl md:px-3.5 md:py-3 md:shadow-[0_12px_32px_rgba(0,0,0,0.55)] ${cardBorder}`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base md:h-11 md:w-11 md:rounded-xl md:text-lg ${iconTile}`}
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

  const layoutShell = 'mx-auto w-full max-w-lg md:max-w-2xl lg:max-w-3xl';

  return (
    <div className="min-h-[100dvh] bg-black pb-28 text-white">
      <header className="sticky top-0 z-40 border-b border-red-950/40 bg-black/95 px-2 pt-1 pb-1.5 backdrop-blur-md md:px-5 md:pb-2 md:pt-1.5">
        <div className={layoutShell}>
        <div
          className={[
            'relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-black via-zinc-950 to-red-950/35',
            'px-2.5 pt-1.5 pb-2 md:px-5 md:pt-3 md:pb-4',
            matchIsFinished
              ? 'border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'border-2 border-red-500/70 shadow-[0_0_64px_rgba(239,68,68,0.48),0_0_1px_rgba(254,202,202,0.5),0_12px_40px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-28px_48px_rgba(127,29,29,0.18)]',
          ].join(' ')}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.42]"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 115% 70% at 50% -15%, rgba(220,38,38,0.38), transparent 52%)',
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-0.5 pb-0.5 text-center md:gap-1 md:pb-1">
            <div
              className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.26em] md:px-4 md:py-1.5 md:text-[10px] ${
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
            <p className="text-[12px] font-bold tracking-wide text-white md:text-sm">{matchTypeDisplay}</p>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)] md:text-[10px]">
              {periodDisplayLine}
            </p>
            {hasClockStarted && !isRunning && !matchIsFinished ? (
              <p className="mt-0.5 max-w-[18rem] text-[9px] font-bold uppercase leading-tight tracking-wide text-amber-400 md:max-w-none md:text-[10px]">
                Pause · laufendes Drittel unterbrochen · mit WEITER weiter
              </p>
            ) : null}
          </div>

          {/* Hauptbereich: 3 Spalten, Score absoluter Mittelpunkt */}
          <div className="relative mt-1.5 rounded-lg bg-black/45 px-0.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-6px_16px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.06] md:mt-2 md:rounded-xl md:px-2 md:py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-1 md:gap-x-3 lg:gap-x-5">
              {/* Links */}
              <div className="flex min-w-0 flex-col items-center text-center">
                <LiveMatchLogoTile
                  src={homeLogoSrc}
                  initialsFrom={homeLogoLookupName}
                  liveGlow={logoLiveGlow}
                  size="hero"
                />
                <p className="mt-0.5 line-clamp-2 w-full px-0.5 text-[11px] font-bold leading-tight text-white md:mt-1 md:text-[13px] lg:text-[14px]">
                  {homeDisplayName}
                </p>
                {canControlLiveMatch && !matchIsFinished ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHomeGoalPickId('');
                      setHomeGoalModalOpen(true);
                    }}
                    className="mt-0.5 flex h-10 w-full max-w-[9.25rem] items-center justify-center gap-0.5 rounded-lg bg-gradient-to-b from-[#16a34a] to-[#22c55e] px-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_12px_rgba(22,163,74,0.35)] active:scale-[0.98] md:mt-1 md:h-11 md:max-w-[11.5rem] md:gap-1 md:rounded-xl md:px-2 md:text-[11px] lg:h-12 lg:max-w-[13rem] lg:text-[12px] lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_22px_rgba(34,197,94,0.4)]"
                  >
                    <span className="text-[12px] leading-none md:text-[14px]" aria-hidden>
                      ⚽
                    </span>
                    + TOR
                  </button>
                ) : null}
              </div>

              {/* Mitte: Score, Timer, Drittel, kurze Location */}
              <div className="relative flex min-w-[7.25rem] max-w-[9.5rem] flex-col items-center border-white/[0.06] px-0.5 text-center md:min-w-[11rem] md:max-w-[15rem] md:border-x md:px-2 lg:min-w-[12.5rem] lg:max-w-[17rem] lg:px-3">
                <div
                  className={[
                    'flex items-baseline justify-center gap-3.5 md:gap-8 lg:gap-10',
                    matchIsFinished ? '' : 'drop-shadow-[0_0_18px_rgba(239,68,68,0.28)] md:drop-shadow-[0_0_32px_rgba(239,68,68,0.38)]',
                  ].join(' ')}
                >
                  <span className="text-[2.55rem] font-black tabular-nums leading-none tracking-tight text-white md:text-[3.65rem] lg:text-[4.15rem]">
                    {scoreHome}
                  </span>
                  <span
                    className="select-none px-0.5 pb-0.5 text-[2.1rem] font-extralight leading-none text-white/40 md:text-[3.1rem] lg:text-[3.45rem]"
                    aria-hidden
                  >
                    :
                  </span>
                  <span className="text-[2.55rem] font-black tabular-nums leading-none tracking-tight text-white md:text-[3.65rem] lg:text-[4.15rem]">
                    {scoreAway}
                  </span>
                </div>
                <p
                  className={`mt-0.5 font-mono text-[1.2rem] font-black tabular-nums leading-none tracking-tight md:mt-2 md:text-[2.1rem] lg:text-[2.45rem] ${
                    matchIsFinished ? 'text-zinc-500' : 'text-[#ef4444]'
                  } ${!matchIsFinished ? 'md:drop-shadow-[0_0_18px_rgba(239,68,68,0.55)]' : ''}`}
                >
                  {formatClock(currentMatchSeconds)}
                </p>
                <p className="mt-1 w-full text-center font-mono text-[8px] font-semibold leading-tight tracking-wide text-zinc-400 md:mt-2 md:text-[9px] lg:text-[10px]">
                  {periodScoreLine}
                </p>
                {venueShort ? (
                  <p className="mt-0.5 line-clamp-2 max-w-full px-0.5 text-center text-[9px] font-medium leading-snug text-zinc-400 md:mt-1.5 md:text-[10px] lg:text-[11px]">
                    📍 {venueShort}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[9px] font-medium text-zinc-500 md:text-[10px]">📍 —</p>
                )}
              </div>

              {/* Rechts */}
              <div className="flex min-w-0 flex-col items-center text-center">
                <LiveMatchLogoTile
                  src={awayLogoSrc}
                  initialsFrom={headerOpponent}
                  liveGlow={logoLiveGlow}
                  size="hero"
                />
                <p className="mt-0.5 line-clamp-2 w-full px-0.5 text-[11px] font-bold leading-tight text-white md:mt-1 md:text-[13px] lg:text-[14px]">
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
                    className="mt-0.5 flex h-10 w-full max-w-[9.25rem] items-center justify-center gap-0.5 rounded-lg bg-gradient-to-b from-[#dc2626] to-[#ef4444] px-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_12px_rgba(220,38,38,0.38)] active:scale-[0.98] md:mt-1 md:h-11 md:max-w-[11.5rem] md:gap-1 md:rounded-xl md:px-2 md:text-[11px] lg:h-12 lg:max-w-[13rem] lg:text-[12px] lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_22px_rgba(239,68,68,0.42)]"
                  >
                    <span className="text-[12px] leading-none md:text-[14px]" aria-hidden>
                      ⚽
                    </span>
                    + TOR
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {(!canControlLiveMatch || matchIsFinished) && (
            <p className="relative mt-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400 md:mt-2.5">
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
              <div className="relative mt-1.5 flex w-full overflow-hidden rounded-lg border-2 border-zinc-700/90 bg-zinc-950 shadow-[0_6px_24px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.05)] md:mt-2 md:rounded-xl md:shadow-[0_10px_36px_rgba(0,0,0,0.75)]">
                <button
                  type="button"
                  onClick={onStartClick}
                  disabled={isRunning || matchIsFinished}
                  className={[
                    'flex min-h-[40px] flex-1 items-center justify-center border-r border-black/50 px-0.5 text-[9px] font-black uppercase tracking-wide transition-colors active:scale-[0.99] md:min-h-[50px] md:px-1 md:text-[11px] lg:min-h-[54px] lg:text-[12px]',
                    isRunning || matchIsFinished
                      ? 'bg-emerald-950/95 text-emerald-800/40'
                      : 'bg-gradient-to-b from-emerald-950 via-emerald-950 to-black text-emerald-100 shadow-[inset_0_1px_0_rgba(16,185,129,0.14)]',
                  ].join(' ')}
                >
                  {!hasClockStarted ? 'BEGINN' : 'WEITER'}
                </button>
                <button
                  type="button"
                  onClick={onPauseClick}
                  disabled={!isRunning || matchIsFinished}
                  className={[
                    'flex min-h-[40px] flex-1 items-center justify-center border-r border-black/50 px-0.5 text-[9px] font-black uppercase tracking-wide transition-colors active:scale-[0.99] md:min-h-[50px] md:px-1 md:text-[11px] lg:min-h-[54px] lg:text-[12px]',
                    isRunning && !matchIsFinished
                      ? 'bg-gradient-to-b from-amber-400 to-amber-700 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_22px_rgba(249,115,22,0.42)] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(249,115,22,0.45)]'
                      : 'bg-amber-950/75 text-amber-100/45',
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
                    'flex min-h-[40px] flex-1 items-center justify-center px-0.5 text-[9px] font-black uppercase tracking-wide transition-colors active:scale-[0.99] md:min-h-[50px] md:px-1 md:text-[11px] lg:min-h-[54px] lg:text-[12px]',
                    matchIsFinished || currentMatchSeconds >= MATCH_HALF_DURATION_SEC
                      ? 'bg-red-950/70 text-red-900/40'
                      : 'bg-gradient-to-b from-red-900 to-red-950 text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_16px_rgba(220,38,38,0.22)] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(220,38,38,0.25)]',
                  ].join(' ')}
                >
                  ENDE
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMainTab('overview');
                  window.requestAnimationFrame(() => {
                    document.getElementById('live-wechsel-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  });
                }}
                className="relative mt-1.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-zinc-500/60 bg-zinc-950 text-[11px] font-black uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-[0.99] md:mt-2 md:min-h-[50px] md:rounded-xl md:text-[13px] lg:mx-auto lg:max-w-2xl"
              >
                <span className="text-base text-white" aria-hidden>
                  ⇄
                </span>
                WECHSEL
              </button>

              <button
                type="button"
                onClick={() => setEndMatchConfirmOpen(true)}
                className="relative mt-1.5 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg border-2 border-red-500 bg-black/40 text-[10px] font-bold uppercase tracking-wide text-red-500 shadow-none active:scale-[0.99] md:mt-2 md:min-h-[48px] md:rounded-xl md:text-[12px] lg:mx-auto lg:max-w-2xl"
              >
                <span className="text-base" aria-hidden>
                  🚩
                </span>
                SPIEL ABSCHLIESSEN
              </button>
            </>
          )}
        </div>
        </div>
      </header>

      <div className="sticky top-[var(--live-header-h,auto)] z-30 border-b border-red-950/40 bg-black/98 px-2 py-2 md:px-5 md:py-2.5">
        <div
          className={`${layoutShell} flex max-w-full flex-nowrap items-stretch justify-start gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] md:justify-between md:gap-2 md:overflow-visible [&::-webkit-scrollbar]:hidden`}
        >
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

      <div className={`${layoutShell} px-2 py-3 md:px-5 md:py-5`}>
        {mainTab === 'overview' && (
          <div className="space-y-6">
            {canControlLiveMatch && !matchIsFinished && (
            <section id="live-wechsel-section">
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
