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
  size?: 'md' | 'hero' | 'heroLg';
}) {
  const [failed, setFailed] = useState(false);
  const glow = liveGlow ? 'shadow-[0_0_12px_rgba(255,0,0,0.3)]' : '';
  const round = size === 'heroLg' ? 'rounded-full' : 'rounded-xl';
  const box =
    size === 'heroLg'
      ? 'h-[4.25rem] w-[4.25rem] sm:h-[4.75rem] sm:w-[4.75rem]'
      : size === 'hero'
        ? 'h-14 w-14'
        : 'h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem]';
  const imgClass =
    size === 'heroLg'
      ? 'max-h-[3.35rem] max-w-[3.35rem] object-contain p-0.5 sm:max-h-[3.65rem] sm:max-w-[3.65rem]'
      : size === 'hero'
        ? 'max-h-11 max-w-11 object-contain p-0.5'
        : 'max-h-11 max-w-11 object-contain p-0.5 sm:max-h-[3rem] sm:max-w-[3rem]';
  const initialsClass =
    size === 'heroLg'
      ? 'select-none text-lg font-black tabular-nums text-white sm:text-xl'
      : 'select-none text-base font-black tabular-nums text-white sm:text-lg';
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-red-500/30 bg-zinc-950/95 ${round} ${box} ${glow}`}
    >
      {!failed ? (
        <img
          src={src}
          alt=""
          className={imgClass}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={initialsClass} aria-hidden>
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

/** Flache Tab-Leiste (ÖFB-Richtung): unten Akzent, weniger „Pill“-Gewicht. */
const tabNavWrap =
  'flex w-full gap-0 overflow-x-auto border-b border-neutral-800 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const tabNavBtnBase =
  'shrink-0 whitespace-nowrap border-b-2 border-transparent px-2.5 py-2 text-xs font-semibold text-gray-500 transition-colors sm:px-3 sm:text-sm md:flex-1 md:px-2 md:text-center';
const tabNavBtnActive = 'border-red-500 text-white';
const tabNavBtnIdle = 'hover:text-gray-300';

/** Eltern/Fan/Spieler: Pill-Tabs (Anschluss an Termine-/Kader-Filter). */
const spectatorTabWrap =
  'mt-0 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const spectatorTabBtnBase =
  'flex h-9 min-h-9 shrink-0 flex-1 items-center justify-center rounded-full border px-2 text-center text-xs font-semibold transition-colors sm:text-sm';
const spectatorTabBtnActive = 'border-red-600/60 bg-red-600 text-white shadow-sm';
const spectatorTabBtnIdle =
  'border-white/[0.08] bg-zinc-900/95 text-gray-300 hover:border-red-500/25 hover:bg-zinc-800 hover:text-white';

const liveCardShell =
  'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-black shadow-[0_6px_28px_rgba(0,0,0,0.35)]';

function eventIcon(t: MatchEventType): string {
  if (t === 'goal') return '⚽';
  if (t === 'sub_out' || t === 'sub_in') return '⇄';
  if (t === 'start') return '▶';
  if (t === 'pause') return '⏸';
  if (t === 'resume') return '▶';
  if (t === 'end') return '⏹';
  return '•';
}

function newEventId(): string {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Liveticker-Zeilen für Zuschauer: chronologisch, Wechsel-Paar an gleicher Minute zusammen. */
function buildSpectatorTickerRows(events: MatchEngineEvent[]): { key: string; items: MatchEngineEvent[] }[] {
  const asc = sortMatchEventsChronologically(events);
  const rows: { key: string; items: MatchEngineEvent[] }[] = [];
  let i = 0;
  while (i < asc.length) {
    const e = asc[i];
    const n = asc[i + 1];
    if (e.type === 'sub_out' && n?.type === 'sub_in' && n.timestamp === e.timestamp) {
      rows.push({ key: `subpair_${e.id}_${n.id}`, items: [e, n] });
      i += 2;
    } else {
      rows.push({ key: e.id, items: [e] });
      i += 1;
    }
  }
  return rows;
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
    if (!matchRow) return;
    const fromDb = lineupData;
    let squad: string[] = [];
    let starting: string[] = [];
    if (fromDb && (fromDb.squadPlayerIds.length > 0 || fromDb.startingPlayerIds.length > 0)) {
      squad = [...fromDb.squadPlayerIds];
      starting = [...fromDb.startingPlayerIds].slice(0, 7);
    }
    setSquadPlayerIds(squad);
    setStartingPlayerIds(starting);
  }, [matchRow, lineupData]);

  const homeName = selectedTeamSeason?.team?.name ?? HOME_FALLBACK;

  const headerOpponent = opponentLabel;
  const homeDisplayName = cleanTeamDisplayName(homeName);
  const awayDisplayName = cleanTeamDisplayName(headerOpponent);
  /** Ohne API-Erweiterung: neutraler Anzeige-Spieltyp (Zielbild). */
  const matchTypeDisplay = 'Freundschaftsspiel';
  const [mainTab, setMainTab] = useState<'overview' | 'lineup' | 'events' | 'time'>('overview');
  const [eventsFilter, setEventsFilter] = useState<EventsFilter>('all');

  useEffect(() => {
    if (!canControlLiveMatch && mainTab === 'time') {
      setMainTab('overview');
    }
  }, [canControlLiveMatch, mainTab]);

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
    const list = onFieldIds.map((id) => rosterById.get(id) ?? { id, name: '—', number: 0 });
    return sortRosterByNumber(list);
  }, [onFieldIds, rosterById]);

  const benchPlayers = useMemo(() => {
    const ids = getBenchPlayers(squadPlayerIds, onFieldIds);
    const list = ids.map((id) => rosterById.get(id) ?? { id, name: '—', number: 0 });
    return sortRosterByNumber(list);
  }, [squadPlayerIds, onFieldIds, rosterById]);

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

  const spectatorTickerRows = useMemo(() => buildSpectatorTickerRows(events), [events]);

  const spectatorLastActionEvent = useMemo(() => {
    const ranked = events.filter((e) => e.type !== 'pause');
    if (ranked.length === 0) return null;
    return [...ranked].sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id))[0] ?? null;
  }, [events]);

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
    if (typeof lp === 'number' && lp >= 1 && lp <= 3) return `${lp}. Drittel`;
    return `${half}. Drittel`;
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

  const parentLiveEventDescription = (ev: MatchEngineEvent): string => {
    const name = ev.playerId ? rosterById.get(ev.playerId)?.name : undefined;
    switch (ev.type) {
      case 'start':
        return ev.timestamp === 0 ? 'Anpfiff' : 'Weiter im Spiel';
      case 'resume':
        return 'Weiter nach Pause';
      case 'end':
        return 'Schlusspfiff';
      case 'goal':
        if (!ev.playerId) return `Tor für ${awayDisplayName || 'Gast'}`;
        return name ? `${name} trifft` : 'Tor für uns';
      case 'sub_out':
        return name ? `${name} wechselt aus` : 'Auswechslung';
      case 'sub_in':
        return name ? `${name} wechselt ein` : 'Einwechslung';
      case 'pause':
        return 'Kurze Unterbrechung';
      default:
        return ev.type;
    }
  };

  const renderTimelineRow = (
    ev: MatchEngineEvent,
    index: number,
    listLength: number,
    showGoalScoreBadge: boolean,
    friendlyFeed = false,
  ) => {
    const isGoal = ev.type === 'goal';
    const isSub = ev.type === 'sub_out' || ev.type === 'sub_in';
    const isHomeGoal = isGoal && Boolean(ev.playerId);
    const isAwayGoal = isGoal && !ev.playerId;
    const pl = ev.playerId ? rosterById.get(ev.playerId) : undefined;
    const scoreStr =
      showGoalScoreBadge && isGoal ? goalScoreBadgeByEventId.get(ev.id) ?? null : null;
    const iconTile = isHomeGoal
      ? 'bg-green-700 text-white'
      : isAwayGoal
        ? 'bg-red-700 text-white'
        : isSub
          ? friendlyFeed
            ? 'bg-sky-900 text-sky-100'
            : 'bg-zinc-800 text-zinc-200'
          : 'bg-zinc-800 text-zinc-400';

    const cardBorder = isHomeGoal
      ? 'border-green-600/50'
      : isAwayGoal
        ? 'border-red-600/50'
        : isSub
          ? friendlyFeed
            ? 'border-sky-700/40'
            : 'border-zinc-600'
          : 'border-zinc-700';

    const scorePillClass = isHomeGoal
      ? 'rounded-full border border-green-600 bg-green-950/90 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-green-100 md:px-2.5 md:py-1 md:text-[11px]'
      : 'rounded-full border border-red-600 bg-red-950/90 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-red-100 md:px-2.5 md:py-1 md:text-[11px]';

    return (
      <li key={ev.id} className="relative flex gap-0 pb-2.5 last:pb-0 md:pb-3">
        <div className="flex w-11 shrink-0 flex-col items-end pr-1 pt-0.5 md:w-14 md:pr-1.5">
          <span className="text-sm font-bold tabular-nums leading-none text-white md:text-base">
            {formatMinute(ev.timestamp)}
          </span>
        </div>
        <div className="relative flex w-3 shrink-0 flex-col items-center pt-1 md:w-4">
          {index < listLength - 1 ? (
            <div
              className={`absolute top-2.5 bottom-0 left-1/2 w-1 -translate-x-1/2 rounded-full ${
                friendlyFeed ? 'bg-red-600/35' : 'bg-zinc-700'
              }`}
              aria-hidden
            />
          ) : null}
          <div className="relative z-10 h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`flex min-h-0 items-stretch gap-2 rounded-lg border bg-zinc-950 px-2 py-1.5 md:gap-2 md:px-2.5 md:py-2 ${cardBorder}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm md:h-9 md:w-9 md:text-base ${iconTile}`}
              aria-hidden
            >
              {eventIcon(ev.type)}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              {isHomeGoal ? (
                <>
                  <span className="inline-flex rounded-full border border-green-600 bg-green-950/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-100">
                    Tor
                  </span>
                  {friendlyFeed ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-gray-300">für {homeDisplayName}</p>
                  ) : null}
                  <p className="mt-1 truncate text-sm font-semibold leading-snug text-white">
                    {pl?.name ?? '?'}
                    {pl?.number != null && String(pl.number).trim() !== '' ? (
                      <span className="text-gray-300"> ({pl.number})</span>
                    ) : null}
                  </p>
                </>
              ) : isAwayGoal ? (
                <>
                  <span className="inline-flex rounded-full border border-green-600 bg-green-950/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-100">
                    Tor
                  </span>
                  {friendlyFeed ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-white">für {awayDisplayName}!</p>
                  ) : (
                    <p className="mt-1 truncate text-xs font-semibold text-gray-300">{awayDisplayName}</p>
                  )}
                </>
              ) : isSub ? (
                <>
                  {!friendlyFeed ? (
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">Wechsel</p>
                  ) : null}
                  <p
                    className={`${friendlyFeed ? '' : 'mt-1 '}text-sm font-semibold leading-snug ${
                      ev.type === 'sub_out' ? 'text-red-300' : 'text-emerald-300'
                    }`}
                  >
                    {friendlyFeed ? parentLiveEventDescription(ev) : eventLabel(ev)}
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-white/90">
                  {friendlyFeed ? parentLiveEventDescription(ev) : eventLabel(ev)}
                </p>
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

  const renderSpectatorTickerRow = (
    row: { key: string; items: MatchEngineEvent[] },
    index: number,
    rowCount: number,
  ) => {
    const ev = row.items[0];
    const minute = formatMinute(ev.timestamp);
    const isLast = index === rowCount - 1;
    const lineEl = !isLast ? (
      <div className="absolute top-2 bottom-0 left-1/2 w-px -translate-x-1/2 bg-red-600/35" aria-hidden />
    ) : null;

    let body: React.ReactNode;
    if (row.items.length === 2 && row.items[0].type === 'sub_out' && row.items[1].type === 'sub_in') {
      const outP = rosterById.get(row.items[0].playerId ?? '')?.name ?? '?';
      const inP = rosterById.get(row.items[1].playerId ?? '')?.name ?? '?';
      body = (
        <>
          <p className="text-[10px] font-black uppercase tracking-wide text-sky-400">Wechsel</p>
          <p className="mt-1 text-[13px] font-bold leading-snug text-emerald-400">IN {inP}</p>
          <p className="mt-0.5 text-[13px] font-bold leading-snug text-red-300">OUT {outP}</p>
        </>
      );
    } else if (ev.type === 'goal') {
      const pl = ev.playerId ? rosterById.get(ev.playerId) : undefined;
      const badge = goalScoreBadgeByEventId.get(ev.id);
      body = (
        <>
          <p className="text-[10px] font-black uppercase tracking-wide text-green-400">Tor</p>
          {ev.playerId ? (
            <p className="mt-1 truncate text-sm font-bold text-white">{pl?.name ?? '?'}</p>
          ) : (
            <p className="mt-1 truncate text-sm font-bold text-white">{awayDisplayName}</p>
          )}
          {badge ? (
            <p className="mt-1 font-mono text-sm font-black tabular-nums text-white">{badge}</p>
          ) : null}
        </>
      );
    } else {
      body = (
        <p className="text-[13px] font-semibold leading-snug text-gray-200">{parentLiveEventDescription(ev)}</p>
      );
    }

    return (
      <li key={row.key} className="flex gap-2 pb-2 last:pb-0">
        <div className="w-10 shrink-0 pt-1 text-right text-xs font-bold tabular-nums text-gray-400">{minute}</div>
        <div className="relative flex w-3 shrink-0 flex-col items-center pt-1">
          {lineEl}
          <div className="relative z-10 mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
        </div>
        <div className={`min-w-0 flex-1 px-3 py-2 ${liveCardShell}`}>{body}</div>
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

  const layoutShell = 'mx-auto w-full max-w-lg md:max-w-2xl lg:max-w-3xl';
  const spectatorView = !canControlLiveMatch;
  const matchboardVisible = spectatorView || (canControlLiveMatch && mainTab === 'overview');

  return (
    <div
      className={
        spectatorView
          ? 'flex min-h-[100dvh] flex-col bg-black text-white'
          : 'min-h-[100dvh] bg-black pb-28 text-white'
      }
    >
      <header
        className={`sticky top-0 z-50 shrink-0 border-b border-red-500/30 bg-black shadow-[0_1px_0_rgba(0,0,0,1)] ${
          spectatorView ? '' : 'backdrop-blur-md'
        }`}
      >
        <div
          className={`${layoutShell} ${
            spectatorView ? 'px-2 pb-1 pt-0 md:px-4 md:pb-1 md:pt-0' : 'px-2 pb-2 pt-1 md:px-4 md:pb-2 md:pt-1.5'
          }`}
        >
          {matchboardVisible && (
            <div
              className={`mx-auto mb-0 w-full max-w-md ${
                spectatorView
                  ? `${liveCardShell} border-red-500/25 p-2 md:p-2.5`
                  : 'rounded-xl border border-red-500/30 bg-black p-3 md:p-4'
              }`}
            >
              <div
                className={`flex flex-col items-center text-center ${
                  spectatorView ? 'gap-0 pb-0.5' : 'gap-0.5 pb-1'
                }`}
              >
                <div
                  className={`flex items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                    matchIsFinished
                      ? 'bg-neutral-800 text-gray-300'
                      : hasClockStarted
                        ? 'bg-red-600 text-white'
                        : 'bg-neutral-800 text-gray-300'
                  }`}
                >
                  {!matchIsFinished && hasClockStarted ? (
                    <span className="text-[9px] leading-none" aria-hidden>
                      ●
                    </span>
                  ) : null}
                  {matchIsFinished ? 'ENDSTAND' : hasClockStarted ? 'LIVE' : 'BEREIT'}
                </div>
                <p className="text-xs font-semibold text-white">{matchTypeDisplay}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-300">{periodDisplayLine}</p>
              </div>

              <div
                className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start ${
                  spectatorView ? 'mt-0.5 gap-x-1' : 'mt-1 gap-x-2'
                }`}
              >
                <div className="flex min-w-0 flex-col items-center text-center">
                  <LiveMatchLogoTile
                    src={homeLogoSrc}
                    initialsFrom={homeLogoLookupName}
                    liveGlow={false}
                    size={spectatorView ? 'heroLg' : 'hero'}
                  />
                  <p className="mt-1 line-clamp-2 w-full max-w-[9rem] break-words text-xs font-semibold leading-tight text-white">
                    {homeDisplayName}
                  </p>
                  {canControlLiveMatch && !matchIsFinished ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHomeGoalPickId('');
                        setHomeGoalModalOpen(true);
                      }}
                      className="mt-1 flex h-10 w-full max-w-[9rem] items-center justify-center rounded-xl bg-green-600 px-3 text-sm font-semibold text-white hover:bg-green-500"
                    >
                      + TOR
                    </button>
                  ) : null}
                </div>

                <div className="flex min-w-[6.75rem] max-w-[8.5rem] flex-col items-center px-0.5 text-center">
                  <div className="flex items-baseline justify-center gap-3">
                    <span className="text-5xl font-black tabular-nums tracking-wide text-[#FFFFFF]">{scoreHome}</span>
                    <span className="select-none text-3xl font-light leading-none text-white/50" aria-hidden>
                      :
                    </span>
                    <span className="text-5xl font-black tabular-nums tracking-wide text-[#FFFFFF]">{scoreAway}</span>
                  </div>
                  <p
                    className={`mt-0.5 font-mono text-lg font-semibold tabular-nums leading-none ${
                      matchIsFinished ? 'text-gray-500' : 'text-[#ef4444]'
                    }`}
                  >
                    {formatClock(currentMatchSeconds)}
                  </p>
                  <p className="mt-1 font-mono text-xs tabular-nums leading-tight text-white opacity-70">{periodScoreLine}</p>
                </div>

                <div className="flex min-w-0 flex-col items-center text-center">
                  <LiveMatchLogoTile
                    src={awayLogoSrc}
                    initialsFrom={headerOpponent}
                    liveGlow={false}
                    size={spectatorView ? 'heroLg' : 'hero'}
                  />
                  <p className="mt-1 line-clamp-2 w-full max-w-[9rem] break-words text-xs font-semibold leading-tight text-white">
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
                      className="mt-1 flex h-10 w-full max-w-[9rem] items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-500"
                    >
                      + TOR
                    </button>
                  ) : null}
                </div>
              </div>

              {saveError && (
                <p className="mt-1 text-center text-xs font-medium text-amber-400" role="alert">
                  {saveError}
                </p>
              )}

              {canControlLiveMatch && !matchIsFinished && (
                <div className="mt-3 space-y-2 border-t border-red-500/30 pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onStartClick}
                      disabled={isRunning || matchIsFinished}
                      className={[
                        'flex h-10 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold',
                        isRunning || matchIsFinished
                          ? 'bg-neutral-900 text-gray-600'
                          : 'bg-neutral-800 text-white hover:bg-neutral-700',
                      ].join(' ')}
                    >
                      <span aria-hidden>▶</span>
                      {!hasClockStarted ? 'Beginn' : 'Weiter'}
                    </button>
                    <button
                      type="button"
                      onClick={onPauseClick}
                      disabled={!isRunning || matchIsFinished}
                      className={[
                        'flex h-10 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold',
                        isRunning && !matchIsFinished
                          ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                          : 'bg-neutral-900 text-gray-600',
                      ].join(' ')}
                    >
                      <span aria-hidden>⏸</span>
                      Pause
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (matchIsFinished) return;
                        startSecondHalf();
                      }}
                      disabled={matchIsFinished || currentMatchSeconds >= MATCH_HALF_DURATION_SEC}
                      className={[
                        'flex h-10 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold',
                        matchIsFinished || currentMatchSeconds >= MATCH_HALF_DURATION_SEC
                          ? 'bg-neutral-900 text-gray-600'
                          : 'bg-red-600 text-white hover:bg-red-500',
                      ].join(' ')}
                    >
                      <span aria-hidden>■</span>
                      Ende
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
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500 bg-neutral-900 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    <span aria-hidden>⇄</span>
                    Wechsel
                  </button>

                  <button
                    type="button"
                    onClick={() => setEndMatchConfirmOpen(true)}
                    className="flex h-10 w-full items-center justify-center rounded-xl border border-red-500 bg-transparent text-sm font-semibold text-red-500 hover:bg-red-500 hover:text-white"
                  >
                    SPIEL ABSCHLIESSEN
                  </button>
                </div>
              )}
            </div>
          )}

          {spectatorView ? (
            <nav className={spectatorTabWrap} aria-label="Live-Ansicht">
              <button
                type="button"
                className={`${spectatorTabBtnBase} ${mainTab === 'overview' ? spectatorTabBtnActive : spectatorTabBtnIdle}`}
                onClick={() => setMainTab('overview')}
              >
                Übersicht
              </button>
              <button
                type="button"
                className={`${spectatorTabBtnBase} ${mainTab === 'lineup' ? spectatorTabBtnActive : spectatorTabBtnIdle}`}
                onClick={() => setMainTab('lineup')}
              >
                Aufstellung
              </button>
              <button
                type="button"
                className={`${spectatorTabBtnBase} ${mainTab === 'events' ? spectatorTabBtnActive : spectatorTabBtnIdle}`}
                onClick={() => setMainTab('events')}
              >
                Liveticker
              </button>
            </nav>
          ) : (
            <nav
              className={`${tabNavWrap} ${mainTab === 'overview' ? 'mt-3' : 'mt-2'}`}
              aria-label="Live-Ansicht"
            >
              <button
                type="button"
                className={`${tabNavBtnBase} ${mainTab === 'overview' ? tabNavBtnActive : tabNavBtnIdle}`}
                onClick={() => setMainTab('overview')}
              >
                Übersicht
              </button>
              <button
                type="button"
                className={`${tabNavBtnBase} ${mainTab === 'lineup' ? tabNavBtnActive : tabNavBtnIdle}`}
                onClick={() => setMainTab('lineup')}
              >
                Aufstellung
              </button>
              <button
                type="button"
                className={`${tabNavBtnBase} ${mainTab === 'events' ? tabNavBtnActive : tabNavBtnIdle}`}
                onClick={() => setMainTab('events')}
              >
                Liveticker
              </button>
              <button
                type="button"
                className={`${tabNavBtnBase} ${mainTab === 'time' ? tabNavBtnActive : tabNavBtnIdle}`}
                onClick={() => setMainTab('time')}
              >
                Statistik
              </button>
            </nav>
          )}
        </div>
      </header>

      <div
        className={
          spectatorView
            ? `min-h-0 flex-1 overflow-y-auto overscroll-y-contain ${layoutShell} px-2 pb-24 pt-1`
            : `${layoutShell} px-2 py-3 md:px-5 md:py-4 pb-28`
        }
      >
        {mainTab === 'overview' && (
          <div className="space-y-3">
            {canControlLiveMatch ? (
              <>
                {canControlLiveMatch && !matchIsFinished && (
                  <section id="live-wechsel-section">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-300">Wechsel</h2>
                    <div className="space-y-3 rounded-xl border border-red-500/30 bg-black p-3">
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
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-300">Spielzeit</h2>
                  <ul className="space-y-3">
                    {sortRosterByNumber(roster.filter((p) => squadPlayerIds.includes(p.id))).map((p) => {
                      const sec = playtimes[p.id] ?? 0;
                      const st = getPlaytimeStatus(sec, currentMatchSeconds, squadPlayerIds.length);
                      const onF = onFieldIds.includes(p.id);
                      return (
                        <li
                          key={p.id}
                          className={`flex min-h-[52px] items-center gap-2 rounded-xl border px-3 py-2.5 ${
                            onF
                              ? 'border-emerald-600/40 bg-zinc-950'
                              : 'border-red-500/20 bg-zinc-950/80 opacity-90'
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
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-300">Wechsel-Vorschläge</h2>
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
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-300">Liveticker</h2>
                  </div>
                  <ul className="rounded-xl border border-red-500/30 bg-black px-1 py-2 sm:px-2 sm:py-3">
                    {events
                      .filter((e) => e.type !== 'pause')
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .slice(0, 12)
                      .map((ev, i, arr) => renderTimelineRow(ev, i, arr.length, true))}
                  </ul>
                </section>

                <section>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-300">
                    Startaufstellung ({fieldPlayers.length})
                  </h2>
                  <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-black p-3">
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.05]"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(0deg, transparent, transparent 10px, rgba(220,38,38,0.35) 10px, rgba(220,38,38,0.35) 11px)',
                      }}
                      aria-hidden
                    />
                    <div className="relative mx-auto max-w-sm rounded-lg border border-red-500/25 bg-zinc-950 p-2">
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
                            className="flex w-[30%] min-w-[80px] max-w-[108px] flex-col items-center justify-center rounded-lg border border-red-500/25 bg-black px-1 py-2"
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
              </>
            ) : (
              <div className="space-y-1.5">
                <section>
                  <h2 className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    Letzte Aktion
                  </h2>
                  {spectatorLastActionEvent ? (
                    <div className={`px-3 py-2.5 ${liveCardShell} border-red-500/20`}>
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-black/50 text-base"
                          aria-hidden
                        >
                          {eventIcon(spectatorLastActionEvent.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] font-bold tabular-nums text-gray-400">
                            {formatMinute(spectatorLastActionEvent.timestamp)}
                          </p>
                          {spectatorLastActionEvent.type === 'goal' && spectatorLastActionEvent.playerId ? (
                            <>
                              <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-green-400">
                                Tor
                              </p>
                              <p className="truncate text-sm font-bold text-white">
                                {rosterById.get(spectatorLastActionEvent.playerId)?.name ?? '?'}
                              </p>
                              <p className="text-[11px] text-gray-500">{homeDisplayName}</p>
                            </>
                          ) : spectatorLastActionEvent.type === 'goal' ? (
                            <>
                              <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-green-400">
                                Tor
                              </p>
                              <p className="text-sm font-bold text-white">{awayDisplayName}</p>
                            </>
                          ) : spectatorLastActionEvent.type === 'sub_out' ||
                            spectatorLastActionEvent.type === 'sub_in' ? (
                            <>
                              <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-sky-400">
                                Wechsel
                              </p>
                              <p className="mt-0.5 text-sm font-semibold leading-snug text-white">
                                {parentLiveEventDescription(spectatorLastActionEvent)}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-gray-400">
                                {spectatorLastActionEvent.type === 'start'
                                  ? 'Spiel'
                                  : spectatorLastActionEvent.type === 'end'
                                    ? 'Ende'
                                    : spectatorLastActionEvent.type === 'resume'
                                      ? 'Weiter'
                                      : 'Ereignis'}
                              </p>
                              <p className="mt-0.5 text-sm font-semibold leading-snug text-white">
                                {parentLiveEventDescription(spectatorLastActionEvent)}
                              </p>
                            </>
                          )}
                        </div>
                        {spectatorLastActionEvent.type === 'goal' &&
                        goalScoreBadgeByEventId.get(spectatorLastActionEvent.id) ? (
                          <span className="shrink-0 self-start rounded-full border border-green-600/80 bg-green-950/90 px-2 py-0.5 font-mono text-[11px] font-black tabular-nums text-green-100">
                            {goalScoreBadgeByEventId.get(spectatorLastActionEvent.id)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p
                      className={`px-3 py-2.5 text-center text-xs text-gray-500 ${liveCardShell} border-red-500/15`}
                    >
                      Sobald etwas passiert, erscheint hier die letzte wichtige Spielaktion.
                    </p>
                  )}
                </section>
                <section>
                  <h2 className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    Spielinfo
                  </h2>
                  <div className={`space-y-1.5 px-3 py-2 ${liveCardShell} border-red-500/15`}>
                    <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Wettbewerb
                      </span>
                      <span className="max-w-[65%] text-right text-xs font-medium text-white">{matchTypeDisplay}</span>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Abschnitt
                      </span>
                      <span className="max-w-[65%] text-right text-xs font-medium text-gray-200">
                        {periodDisplayLine}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Laufzeit
                      </span>
                      <span className="font-mono text-xs font-bold tabular-nums text-[#ef4444]">
                        {formatClock(currentMatchSeconds)}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {mainTab === 'lineup' && (
          <div className="space-y-3">
            {canControlLiveMatch ? (
              <p className="text-sm text-gray-400">Tippe einen Spieler für Wechsel.</p>
            ) : null}
            {fieldPlayers.length === 0 && benchPlayers.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center text-sm text-gray-400">
                Noch keine Aufstellung veröffentlicht.
              </p>
            ) : (
              <>
                <div className="text-xs text-yellow-300">
                  role: {canControlLiveMatch ? 'trainer' : 'spectator'}
                  {' | '}fieldPlayers: [{fieldPlayers.map((p) => p.name).join(', ')}]
                  {' | '}benchPlayers: [{benchPlayers.map((p) => p.name).join(', ')}]
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase text-emerald-500">Startaufstellung</h3>
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
                          </button>
                        ) : (
                          <div className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-emerald-600/40 bg-emerald-950/30 px-4 py-3">
                            <span className="text-lg font-bold text-emerald-400">{p.number || '–'}</span>
                            <span className="flex-1 px-3 text-base font-semibold text-white">{p.name}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase text-gray-400">Ersatzbank</h3>
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
                          </button>
                        ) : (
                          <div className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                            <span className="text-lg font-bold text-white/50">{p.number || '–'}</span>
                            <span className="flex-1 px-3 text-base font-semibold text-white">{p.name}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {mainTab === 'events' && (
          <div className="space-y-3">
            {canControlLiveMatch ? (
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
                    className={`min-h-[36px] flex-1 rounded-lg px-2 py-1.5 text-xs font-bold tracking-wide transition-colors sm:text-sm ${
                      eventsFilter === key
                        ? 'bg-red-500 text-white'
                        : 'border border-red-500/20 bg-neutral-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            {(canControlLiveMatch ? filteredEvents : spectatorTickerRows).length === 0 ? (
              <p className={`px-4 py-8 text-center text-sm text-gray-400 ${liveCardShell} border-red-500/20`}>
                {canControlLiveMatch ? 'Keine Einträge für diesen Filter.' : 'Noch keine Spielereignisse.'}
              </p>
            ) : canControlLiveMatch ? (
              <ul className="max-h-[60vh] overflow-y-auto rounded-xl border border-red-500/30 bg-black px-1 py-2 sm:px-2 sm:py-3">
                {filteredEvents.map((ev, i, arr) => renderTimelineRow(ev, i, arr.length, true))}
              </ul>
            ) : (
              <ul className="rounded-xl border border-red-500/25 bg-black/40 px-1 py-2">
                {spectatorTickerRows.map((row, i) =>
                  renderSpectatorTickerRow(row, i, spectatorTickerRows.length),
                )}
              </ul>
            )}
          </div>
        )}

        {canControlLiveMatch && mainTab === 'time' && (
          <div className="space-y-2">
            <p className="mb-2 text-sm text-gray-400">Effektive Spielzeit (ohne Pausen)</p>
            <ul className="space-y-3">
              {sortRosterByNumber(roster.filter((p) => squadPlayerIds.includes(p.id))).map((p) => {
                const sec = playtimes[p.id] ?? 0;
                const st = getPlaytimeStatus(sec, currentMatchSeconds, squadPlayerIds.length);
                const onF = onFieldIds.includes(p.id);
                return (
                  <li
                    key={p.id}
                    className={`flex min-h-[52px] items-center gap-2 rounded-xl border px-3 py-2.5 ${
                      onF
                        ? 'border-emerald-600/40 bg-zinc-950'
                        : 'border-red-500/20 bg-zinc-950/80 opacity-90'
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

      {mainTab === 'overview' ? (
        <button
          type="button"
          className="pointer-events-auto fixed bottom-24 right-3 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-neutral-900 text-base font-bold text-white shadow-sm hover:bg-neutral-800 md:bottom-28 md:right-5"
          onClick={() => setMainTab('events')}
          aria-label="Zum Liveticker"
        >
          →
        </button>
      ) : null}

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
