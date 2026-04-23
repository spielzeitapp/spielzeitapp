import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { usePlayers } from '../../hooks/usePlayers';
import { useMatchTimer } from '../../hooks/useMatchTimer';
import {
  buildPauseDelimitedPeriodScoreLine,
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
  deleteMatchEventById,
  fetchMatchEvents,
  getMatchLiveClockStatus,
  saveMatchEvent,
  saveMatchEvents,
  updateMatchRow,
  type LiveMatchRow,
} from '../../lib/liveMatchService';
import { playerItemToRoster, type RosterPlayer } from '../../lib/rosterPlayer';
import { supabase } from '../../lib/supabaseClient';
import { getClubLogo, getOurTeamDisplayName } from '../../lib/teamLogos';
import { isValidLogoUrl } from '../../utils/logoResolver';

const HOME_FALLBACK = 'Unser Team';

/** Gleiche Grafik wie WelcomeScreen (`public/intro/welcome-hero.png`). */
function matchboardWelcomeHeroSrc(): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = 'intro/welcome-hero.png';
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

/** Logo-Kachel: gleiche Größe/Stil wie Gegner; bei Fehler Initialen (wie Match-Karten-Fallback). */
function LiveMatchLogoTile({
  src,
  liveGlow,
  size = 'md',
}: {
  src: string;
  liveGlow: boolean;
  size?: 'md' | 'hero' | 'heroLg' | 'schedule' | 'board';
}) {
  const [imgSrc, setImgSrc] = useState(isValidLogoUrl(src) ? src : '/logos/placeholder-shield-a.png');
  useEffect(() => {
    setImgSrc(isValidLogoUrl(src) ? src : '/logos/placeholder-shield-a.png');
  }, [src]);
  const glow = liveGlow ? 'shadow-[0_0_12px_rgba(255,0,0,0.3)]' : '';
  const box =
    size === 'board'
      ? 'h-[5.25rem] w-[5.25rem] sm:h-28 sm:w-28'
      : size === 'schedule'
        ? 'h-12 w-12'
        : size === 'heroLg'
          ? 'h-[6.25rem] w-[6.25rem] sm:h-[6.75rem] sm:w-[6.75rem] md:h-[7.25rem] md:w-[7.25rem]'
          : size === 'hero'
            ? 'h-14 w-14'
            : 'h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem]';
  const imgClass =
    size === 'board'
      ? 'h-full w-full max-h-[4.75rem] max-w-[4.75rem] object-contain drop-shadow-[0_0_16px_rgba(255,255,255,0.2)] sm:max-h-[6.5rem] sm:max-w-[6.5rem]'
      : size === 'schedule'
        ? 'h-12 w-12 object-contain drop-shadow'
        : size === 'heroLg'
          ? 'max-h-[5rem] max-w-[5rem] object-contain p-0.5 sm:max-h-[5.5rem] sm:max-w-[5.5rem] md:max-h-[6rem] md:max-w-[6rem]'
          : size === 'hero'
            ? 'max-h-11 max-w-11 object-contain p-0.5'
            : 'max-h-11 max-w-11 object-contain p-0.5 sm:max-h-[3rem] sm:max-w-[3rem]';
  return (
    <div className={`flex shrink-0 items-center justify-center ${box} ${glow}`}>
      <img
        src={imgSrc}
        alt=""
        className={imgClass}
        onError={() => {
          if (imgSrc !== '/logos/placeholder-shield-a.png') setImgSrc('/logos/placeholder-shield-a.png');
        }}
      />
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

/** Kurzes Kürzel (z. B. USG, SKN) – nicht mit Ortsnamen verwechseln. */
function tokenLooksLikeAbbrev(t: string): boolean {
  const s = (t || '').trim();
  if (s.length < 2 || s.length > 8) return false;
  const noDot = s.replace(/\./g, '');
  if (noDot.length < 2) return false;
  if (/^[A-Z0-9.]+$/i.test(s) && noDot.length <= 6) return true;
  return /^[A-ZÄÖÜ]{2,6}$/.test(s);
}

/**
 * Matchboard: oben Kürzel, unten Vereinsname.
 * Unterstützt „USG Alpenvorland“ und „Alpenvorland USG“; ein Wort nur unten.
 */
function matchboardAbbrevAndClub(full: string): { abbrev: string; club: string } {
  const trimmed = (full || '').trim();
  if (!trimmed) return { abbrev: '', club: '' };
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return { abbrev: '', club: trimmed };

  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const firstAbbr = tokenLooksLikeAbbrev(first);
  const lastAbbr = tokenLooksLikeAbbrev(last);

  if (firstAbbr && !lastAbbr) {
    return { abbrev: first, club: tokens.slice(1).join(' ') };
  }
  if (lastAbbr && !firstAbbr) {
    return { abbrev: last, club: tokens.slice(0, -1).join(' ') };
  }
  return { abbrev: first, club: tokens.slice(1).join(' ') };
}

/** Kürzel + Verein unter Logo oder am Board; `tight` = weniger Abstand (Zielbild). */
function MatchboardTeamNameLines({
  parts,
  align,
  tight = false,
}: {
  parts: { abbrev: string; club: string };
  align: 'left' | 'right' | 'center';
  tight?: boolean;
}) {
  const textAlign = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  const abbrevCls = tight
    ? `min-h-[1em] text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-white/95 sm:text-[11px] ${textAlign}`
    : `min-h-[1em] text-xs font-medium uppercase leading-tight tracking-widest text-white ${textAlign}`;
  const clubCls = tight
    ? `mt-0.5 text-sm font-semibold leading-snug text-white sm:text-base ${textAlign}`
    : `mt-1 text-lg font-semibold leading-snug text-white sm:text-xl md:text-2xl ${textAlign}`;
  return (
    <div className="w-full min-w-0 hyphens-none">
      <div className={abbrevCls}>
        {parts.abbrev ? (
          <span className="block">{parts.abbrev}</span>
        ) : (
          <span className="invisible block" aria-hidden>
            .
          </span>
        )}
      </div>
      <div className={clubCls}>
        <span className="block break-words [word-break:normal] [text-wrap:balance]">{parts.club || '\u00a0'}</span>
      </div>
    </div>
  );
}

/** Trainer-Tabs: unter dem Matchboard, Stadium/Premium-Anmutung. */
const tabNavWrap =
  'mt-2 flex w-full gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const tabNavBtnBase =
  'shrink-0 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200 sm:px-4 sm:text-sm md:flex-1 md:text-center';
const tabNavBtnActive =
  'bg-gradient-to-b from-red-600 to-red-800 text-white shadow-[0_4px_24px_rgba(220,38,38,0.35)]';
const tabNavBtnIdle =
  'text-gray-500 hover:bg-white/[0.04] hover:text-gray-200';

/** Zuschauer-Tabs: gleiche Familie wie Trainer. */
const spectatorTabWrap =
  'mt-3 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/55 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const spectatorTabBtnBase =
  'flex h-10 min-h-10 shrink-0 flex-1 items-center justify-center rounded-xl border border-transparent px-2 text-center text-xs font-semibold transition-all duration-200 sm:text-sm';
const spectatorTabBtnActive =
  'border-red-500/25 bg-gradient-to-b from-red-600 to-red-800 text-white shadow-[0_4px_22px_rgba(220,38,38,0.32)]';
const spectatorTabBtnIdle =
  'text-gray-500 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-gray-200';

const liveCardShell =
  'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-black shadow-[0_6px_28px_rgba(0,0,0,0.35)]';

/** Trainer-Matchboard: einheitliche Höhe/Rundung für Steuerung + Score-Tap-Zellen. */
const mbBtnH = 'h-10 min-h-10';
const mbRound = 'rounded-xl';
const mbRowBtn = `flex ${mbBtnH} touch-manipulation items-center justify-center gap-1.5 ${mbRound} px-3 text-xs font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40`;

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

function recomputeScoresFromEvents(evts: MatchEngineEvent[]): { home: number; away: number } {
  const sorted = sortMatchEventsChronologically(evts);
  let home = 0;
  let away = 0;
  for (const e of sorted) {
    if (e.type !== 'goal') continue;
    if (e.playerId) home += 1;
    else away += 1;
  }
  return { home, away };
}

function findLastGoalEventIdForSide(events: MatchEngineEvent[], side: 'home' | 'away'): string | null {
  const sorted = sortMatchEventsChronologically(events);
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const e = sorted[i];
    if (e.type !== 'goal') continue;
    if (side === 'home' && e.playerId) return e.id;
    if (side === 'away' && !e.playerId) return e.id;
  }
  return null;
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
  const navigate = useNavigate();
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

  const { currentMatchSeconds, half } = useMatchTimer({
    elapsedSeconds: matchRow?.live_elapsed_seconds ?? 0,
    isRunning: matchRow?.live_is_running ?? false,
    hasEnded: matchRow?.status === 'finished',
    startedAtISO: matchRow?.live_started_at ?? null,
  });

  const hasClockStarted = useMemo(
    () => Boolean(matchRow?.live_started_at) || events.some((e) => e.type === 'start'),
    [matchRow?.live_started_at, events],
  );

  const matchIsFinished = matchRow?.status === 'finished';
  const matchClockStatus = useMemo(
    () => getMatchLiveClockStatus(matchRow, { hasClockStarted }),
    [matchRow, hasClockStarted],
  );
  const isRunning = matchClockStatus === 'live';
  const isPaused = matchClockStatus === 'paused';

  useEffect(() => {
    if (!matchRow) return;
    const o = matchRow.opponent?.trim();
    setOpponentLabel(o || 'Gegner');
    setScoreHome(Number(matchRow.score_home ?? 0));
    setScoreAway(Number(matchRow.score_away ?? 0));
  }, [matchRow]);

  useEffect(() => {
    if (!matchRow) {
      setSquadPlayerIds([]);
      setStartingPlayerIds([]);
      return;
    }
    if (!lineupData) {
      setSquadPlayerIds([]);
      setStartingPlayerIds([]);
      return;
    }
    setSquadPlayerIds([...lineupData.squadPlayerIds]);
    setStartingPlayerIds([...lineupData.startingPlayerIds].slice(0, 7));
  }, [matchRow, lineupData]);

  const homeName = selectedTeamSeason?.team?.name ?? HOME_FALLBACK;

  const headerOpponent = opponentLabel;
  const homeDisplayName = cleanTeamDisplayName(homeName);
  const awayDisplayName = cleanTeamDisplayName(headerOpponent);
  const homeNameParts = matchboardAbbrevAndClub(homeDisplayName);
  const awayNameParts = matchboardAbbrevAndClub(awayDisplayName);
  /** Ohne API-Erweiterung: neutraler Anzeige-Spieltyp (Zielbild). */
  const matchTypeDisplay = 'Freundschaftsspiel';
  const [mainTab, setMainTab] = useState<'overview' | 'lineup' | 'events' | 'time'>('overview');
  const [eventsFilter, setEventsFilter] = useState<EventsFilter>('all');

  useEffect(() => {
    if (!canControlLiveMatch && mainTab === 'time') {
      setMainTab('overview');
    }
  }, [canControlLiveMatch, mainTab]);

  const [wechselSheetOpen, setWechselSheetOpen] = useState(false);

  const [wechselOutId, setWechselOutId] = useState<string>('');
  const [wechselInId, setWechselInId] = useState<string>('');
  const closeWechselSheet = useCallback(() => {
    setWechselOutId('');
    setWechselInId('');
    setWechselSheetOpen(false);
  }, []);
  const openWechselSheet = useCallback(() => {
    setWechselOutId('');
    setWechselInId('');
    setWechselSheetOpen(true);
  }, []);
  useEffect(() => {
    if (wechselSheetOpen && mainTab !== 'overview') closeWechselSheet();
  }, [wechselSheetOpen, mainTab, closeWechselSheet]);
  const [homeGoalModalOpen, setHomeGoalModalOpen] = useState(false);
  const [homeGoalPickId, setHomeGoalPickId] = useState<string>('');
  const [endeConfirmOpen, setEndeConfirmOpen] = useState(false);
  const [spielAbschlussOpen, setSpielAbschlussOpen] = useState(false);
  const [calendarFinalized, setCalendarFinalized] = useState(false);
  const [goalUndoOffer, setGoalUndoOffer] = useState<{
    eventId: string;
    side: 'home' | 'away';
    prevHome: number;
    prevAway: number;
  } | null>(null);
  const [goalUndoToastClosing, setGoalUndoToastClosing] = useState(false);
  const goalUndoTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const goalUndoFadeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const scoresRef = useRef({ home: 0, away: 0 });
  const homeGoalLpTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const homeGoalSuppressClickRef = useRef(false);
  const awayGoalLpTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const awayGoalSuppressClickRef = useRef(false);

  const clearGoalUndoTimer = useCallback(() => {
    if (goalUndoTimerRef.current != null) {
      window.clearTimeout(goalUndoTimerRef.current);
      goalUndoTimerRef.current = null;
    }
    if (goalUndoFadeTimerRef.current != null) {
      window.clearTimeout(goalUndoFadeTimerRef.current);
      goalUndoFadeTimerRef.current = null;
    }
    setGoalUndoToastClosing(false);
  }, []);

  const totalsFromEvents = useMemo(() => recomputeScoresFromEvents(events), [events]);
  /**
   * Gesamtstand nur aus Events + Matchzeile (DB), nie aus separat hochgezähltem Local-State —
   * sonst +1 im Handler und max(totals, state) = Doppelzählung beim Tor.
   */
  const displayScoreHome = Math.max(
    totalsFromEvents.home,
    Number(matchRow?.score_home ?? 0),
  );
  const displayScoreAway = Math.max(
    totalsFromEvents.away,
    Number(matchRow?.score_away ?? 0),
  );

  useEffect(() => {
    scoresRef.current = { home: displayScoreHome, away: displayScoreAway };
  }, [displayScoreHome, displayScoreAway]);

  useEffect(() => {
    if (!effectiveMatchId || matchRow?.status !== 'finished') {
      setCalendarFinalized(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select('status')
        .eq('match_id', effectiveMatchId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setCalendarFinalized(false);
        return;
      }
      if (!data) setCalendarFinalized(true);
      else setCalendarFinalized(data.status === 'finished');
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveMatchId, matchRow?.status]);

  useEffect(() => () => clearGoalUndoTimer(), [clearGoalUndoTimer]);

  useEffect(
    () => () => {
      if (homeGoalLpTimerRef.current != null) window.clearTimeout(homeGoalLpTimerRef.current);
      if (awayGoalLpTimerRef.current != null) window.clearTimeout(awayGoalLpTimerRef.current);
    },
    [],
  );

  const offerGoalUndo = useCallback(
    (payload: { eventId: string; side: 'home' | 'away'; prevHome: number; prevAway: number }) => {
      clearGoalUndoTimer();
      setGoalUndoOffer(payload);
      setGoalUndoToastClosing(false);
      goalUndoFadeTimerRef.current = window.setTimeout(() => {
        setGoalUndoToastClosing(true);
        goalUndoFadeTimerRef.current = null;
      }, 2400);
      goalUndoTimerRef.current = window.setTimeout(() => {
        setGoalUndoOffer(null);
        setGoalUndoToastClosing(false);
        goalUndoTimerRef.current = null;
      }, 3000);
    },
    [clearGoalUndoTimer],
  );

  const goalUndoRef = useRef(goalUndoOffer);
  useEffect(() => {
    goalUndoRef.current = goalUndoOffer;
  }, [goalUndoOffer]);

  const undoLastGoal = useCallback(async () => {
    const offer = goalUndoRef.current;
    if (!offer?.eventId?.trim() || !effectiveMatchId) return;
    clearGoalUndoTimer();
    setGoalUndoOffer(null);
    const { eventId, prevHome, prevAway } = offer;
    const { error } = await deleteMatchEventById(eventId.trim());
    if (error) {
      setSaveError(error);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setScoreHome(prevHome);
    setScoreAway(prevAway);
    const { error: rowErr } = await updateMatchRow(effectiveMatchId, {
      score_home: prevHome,
      score_away: prevAway,
    });
    if (rowErr) setSaveError(rowErr);
  }, [effectiveMatchId, clearGoalUndoTimer]);

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
    const list = ids.map((id) => rosterById.get(id) ?? { id, name: '—', number: 0 });
    return sortRosterByNumber(list);
  }, [squadPlayerIds, onFieldIds, rosterById]);

  const homeScorerCandidates = useMemo(() => sortRosterByNumber(fieldPlayers), [fieldPlayers]);

  const playtimes = useMemo(
    () => calculatePlayerPlaytimes(startingPlayerIds, squadPlayerIds, events, currentMatchSeconds),
    [startingPlayerIds, squadPlayerIds, events, currentMatchSeconds],
  );

  const persistSingle = useCallback(
    async (partial: Omit<MatchEngineEvent, 'id'>): Promise<{ ok: boolean; savedId?: string }> => {
      if (!effectiveMatchId) return { ok: false };
      setSaveError(null);
      const tempId = newEventId();
      const optimistic: MatchEngineEvent = { ...partial, id: tempId };
      setEvents((prev) => [optimistic, ...prev]);
      if (partial.type === 'start' || partial.type === 'pause' || partial.type === 'resume' || partial.type === 'end') {
        return { ok: true };
      }
      const payload = engineEventToInsertPayload(effectiveMatchId, partial, half);
      const { id, error } = await saveMatchEvent(payload);
      if (error || !id) {
        console.error('[LiveMatch] saveMatchEvent', error);
        setSaveError(error ?? 'Ereignis konnte nicht gespeichert werden.');
        setEvents((prev) => prev.filter((e) => e.id !== tempId));
        return { ok: false };
      }
      const mid = effectiveMatchId;
      setEvents((prev) => {
        const mapped = prev.map((e) => (e.id === tempId ? { ...partial, id } : e));
        if (partial.type === 'goal') {
          const { home: nh, away: na } = recomputeScoresFromEvents(mapped);
          queueMicrotask(() => {
            setScoreHome(nh);
            setScoreAway(na);
            void updateMatchRow(mid, { score_home: nh, score_away: na }).then(({ error: rowErr }) => {
              if (rowErr) setSaveError(rowErr);
            });
          });
        }
        return mapped;
      });
      return { ok: true, savedId: id };
    },
    [effectiveMatchId, half],
  );

  const onStartClick = async () => {
    if (!canControlLiveMatch || matchIsFinished || isRunning || !effectiveMatchId) return;
    if (!hasClockStarted) {
      const { ok } = await persistSingle({ type: 'start', timestamp: 0 });
      if (!ok) return;
      const ts = new Date().toISOString();
      const { error } = await updateMatchRow(effectiveMatchId, {
        status: 'live',
        live_started_at: ts,
        live_is_running: true,
        live_elapsed_seconds: 0,
      });
      if (error) setSaveError(error);
      else
        setMatchRow((prev) =>
          prev ? { ...prev, status: 'live', live_started_at: ts, live_is_running: true, live_elapsed_seconds: 0 } : null,
        );
    } else {
      const { ok } = await persistSingle({ type: 'resume', timestamp: currentMatchSeconds });
      if (!ok) return;
      const ts = new Date().toISOString();
      const frozen = currentMatchSeconds;
      const { error } = await updateMatchRow(effectiveMatchId, {
        status: 'live',
        live_started_at: ts,
        live_is_running: true,
        live_elapsed_seconds: frozen,
      });
      if (error) setSaveError(error);
      else
        setMatchRow((prev) =>
          prev
            ? { ...prev, status: 'live', live_started_at: ts, live_is_running: true, live_elapsed_seconds: frozen }
            : null,
        );
    }
  };

  const onPauseClick = async () => {
    if (!canControlLiveMatch || !isRunning || matchIsFinished || !effectiveMatchId) return;
    const { ok } = await persistSingle({ type: 'pause', timestamp: currentMatchSeconds });
    if (!ok) return;
    const frozen = currentMatchSeconds;
    const { error } = await updateMatchRow(effectiveMatchId, {
      live_elapsed_seconds: frozen,
      live_is_running: false,
    });
    if (error) setSaveError(error);
    else setMatchRow((prev) => (prev ? { ...prev, live_elapsed_seconds: frozen, live_is_running: false } : null));
  };

  /** Ende: Uhr stoppen, Match in DB beenden, Endstand aus Toren — ohne Kalender-Termin (kommt bei „Spiel abschließen“). */
  const persistMatchEndWithoutCalendar = async () => {
    if (!canControlLiveMatch || matchIsFinished || !effectiveMatchId) return;
    const frozen = currentMatchSeconds;
    const { home: fh, away: fa } = recomputeScoresFromEvents(events);
    const { ok } = await persistSingle({ type: 'end', timestamp: frozen });
    if (!ok) return;
    const { error } = await updateMatchRow(effectiveMatchId, {
      status: 'finished',
      live_is_running: false,
      live_elapsed_seconds: frozen,
      live_period: half,
      score_home: fh,
      score_away: fa,
    });
    if (error) setSaveError(error);
    else {
      setScoreHome(fh);
      setScoreAway(fa);
      setMatchRow((prev) =>
        prev
          ? {
              ...prev,
              status: 'finished',
              live_is_running: false,
              live_elapsed_seconds: frozen,
              live_period: half,
              score_home: fh,
              score_away: fa,
            }
          : null,
      );
    }
  };

  /** Nachgelagert: verknüpften Kalender-Termin abschließen (events.status). */
  const finalizeCalendarForMatch = async () => {
    if (!effectiveMatchId || calendarFinalized) return;
    const { error } = await supabase.from('events').update({ status: 'finished' }).eq('match_id', effectiveMatchId);
    if (error) setSaveError(error.message);
    else {
      setCalendarFinalized(true);
      setSpielAbschlussOpen(false);
      navigate('/app');
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

  const confirmWechselSection = async () => {
    if (matchIsFinished) return;
    const ok = await persistSubstitution(wechselOutId, wechselInId);
    if (!ok) return;
    closeWechselSheet();
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
    () => buildPauseDelimitedPeriodScoreLine(events, Boolean(matchIsFinished)),
    [events, matchIsFinished],
  );

  const lastHomeGoalEventId = useMemo(() => findLastGoalEventIdForSide(events, 'home'), [events]);
  const lastAwayGoalEventId = useMemo(() => findLastGoalEventIdForSide(events, 'away'), [events]);

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

  const layoutShell = 'mx-auto w-full max-w-none';
  const spectatorView = !canControlLiveMatch;
  const matchboardVisible = spectatorView || (canControlLiveMatch && mainTab === 'overview');
  const liveBadgeAnimating = hasClockStarted && isRunning && !matchIsFinished;
  const liveBadgeShell =
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] sm:px-3 sm:text-[11px] uppercase';
  const liveBadgeClassName = `${liveBadgeShell} ${
    matchIsFinished
      ? 'border-red-500/45 bg-gradient-to-b from-red-900 to-red-950 text-red-100 shadow-[0_0_22px_rgba(220,38,38,0.45)]'
      : hasClockStarted
        ? `border-red-400/60 bg-gradient-to-b from-red-600 via-red-900 to-red-950 text-red-50 shadow-[0_0_28px_rgba(255,40,40,0.55),0_0_48px_rgba(220,38,38,0.25)]${liveBadgeAnimating ? ' animate-live-badge-strong' : ''}`
        : 'border-white/20 bg-zinc-900/95 text-white/55 shadow-[0_0_10px_rgba(0,0,0,0.35)]'
  }`;
  /** Nur Ziffer: Tap = Tor, Long-press = Undo (kein Ball-Icon). */
  const scoreTapHome = `${mbRowBtn} gap-0 min-h-[48px] min-w-[2.85rem] shrink-0 rounded-xl border border-emerald-400/40 bg-gradient-to-b from-emerald-950/92 to-black/75 px-3 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_26px_rgba(16,185,129,0.35)] hover:border-emerald-300/50 hover:shadow-[0_0_32px_rgba(16,185,129,0.42)] active:scale-[0.97] sm:min-w-[3.1rem] sm:px-3.5`;
  const scoreTapAway = `${mbRowBtn} gap-0 min-h-[48px] min-w-[2.85rem] shrink-0 rounded-xl border border-red-400/45 bg-gradient-to-b from-red-950/92 to-black/75 px-3 text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_26px_rgba(239,68,68,0.38),0_0_12px_rgba(255,255,255,0.06)] hover:border-red-300/50 hover:shadow-[0_0_32px_rgba(239,68,68,0.45)] active:scale-[0.97] sm:min-w-[3.1rem] sm:px-3.5`;
  const mbStart = `${mbRowBtn} rounded-xl border border-emerald-400/50 bg-gradient-to-b from-emerald-600/80 to-emerald-950/85 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_22px_rgba(16,185,129,0.35)] hover:from-emerald-500/85 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]`;
  /** Pause als linke Hauptaktion — dunkelgrün wie Zielbild, klar von Beginn/Weiter (hellgrün) getrennt. */
  const mbPausePrimary = `${mbRowBtn} rounded-xl border border-emerald-800/55 bg-gradient-to-b from-emerald-950/92 to-black/85 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_16px_rgba(6,78,59,0.35)] hover:border-emerald-600/45 hover:from-emerald-900/88`;
  const mbEnd = `${mbRowBtn} rounded-xl border border-red-500/50 bg-gradient-to-b from-red-600/75 to-red-950/88 text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(220,38,38,0.38)] hover:from-red-500/78 hover:shadow-[0_0_32px_rgba(220,38,38,0.45)]`;
  const mbWechsel = `${mbRowBtn} w-full rounded-xl border border-white/22 bg-zinc-950/85 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/30 hover:bg-zinc-900/90`;
  const mbSpielEnde = `${mbRowBtn} w-full rounded-xl border-2 border-amber-400/65 bg-black/90 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_18px_rgba(245,158,11,0.12)] hover:border-amber-300/75 hover:bg-black enabled:hover:shadow-[0_0_22px_rgba(245,158,11,0.22)]`;

  const clearHomeGoalLongPress = () => {
    if (homeGoalLpTimerRef.current != null) {
      window.clearTimeout(homeGoalLpTimerRef.current);
      homeGoalLpTimerRef.current = null;
    }
  };
  const clearAwayGoalLongPress = () => {
    if (awayGoalLpTimerRef.current != null) {
      window.clearTimeout(awayGoalLpTimerRef.current);
      awayGoalLpTimerRef.current = null;
    }
  };
  const onHomeGoalScorePointerDown = () => {
    if (spectatorView || !canControlLiveMatch || matchIsFinished) return;
    homeGoalSuppressClickRef.current = false;
    clearHomeGoalLongPress();
    homeGoalLpTimerRef.current = window.setTimeout(() => {
      homeGoalLpTimerRef.current = null;
      if (lastHomeGoalEventId) {
        homeGoalSuppressClickRef.current = true;
        const next = events.filter((ev) => ev.id !== lastHomeGoalEventId);
        const prev = recomputeScoresFromEvents(next);
        offerGoalUndo({
          eventId: lastHomeGoalEventId,
          side: 'home',
          prevHome: prev.home,
          prevAway: prev.away,
        });
      }
    }, 550);
  };
  const onAwayGoalScorePointerDown = () => {
    if (spectatorView || !canControlLiveMatch || matchIsFinished) return;
    awayGoalSuppressClickRef.current = false;
    clearAwayGoalLongPress();
    awayGoalLpTimerRef.current = window.setTimeout(() => {
      awayGoalLpTimerRef.current = null;
      if (lastAwayGoalEventId) {
        awayGoalSuppressClickRef.current = true;
        const next = events.filter((ev) => ev.id !== lastAwayGoalEventId);
        const prev = recomputeScoresFromEvents(next);
        offerGoalUndo({
          eventId: lastAwayGoalEventId,
          side: 'away',
          prevHome: prev.home,
          prevAway: prev.away,
        });
      }
    }, 550);
  };

  const renderLastActionOverview = (headingClass: string) => {
    const ev = spectatorLastActionEvent;
    return (
      <section>
        <h2 className={headingClass}>Letzte Aktion</h2>
        {ev ? (
          <div className={`px-3 py-2.5 ${liveCardShell} border-red-500/20`}>
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-black/50 text-base"
                aria-hidden
              >
                {eventIcon(ev.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] font-bold tabular-nums text-gray-400">{formatMinute(ev.timestamp)}</p>
                {ev.type === 'goal' && ev.playerId ? (
                  <>
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-green-400">Tor</p>
                    <p className="truncate text-sm font-bold text-white">{rosterById.get(ev.playerId)?.name ?? '?'}</p>
                    <p className="text-[11px] text-gray-500">{homeDisplayName}</p>
                  </>
                ) : ev.type === 'goal' ? (
                  <>
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-green-400">Tor</p>
                    <p className="text-sm font-bold text-white">{awayDisplayName}</p>
                  </>
                ) : ev.type === 'sub_out' || ev.type === 'sub_in' ? (
                  <>
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-sky-400">Wechsel</p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-white">{parentLiveEventDescription(ev)}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-gray-400">
                      {ev.type === 'start' ? 'Spiel' : ev.type === 'end' ? 'Ende' : ev.type === 'resume' ? 'Weiter' : 'Ereignis'}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-white">{parentLiveEventDescription(ev)}</p>
                  </>
                )}
              </div>
              {ev.type === 'goal' && goalScoreBadgeByEventId.get(ev.id) ? (
                <span className="shrink-0 self-start rounded-full border border-green-600/80 bg-green-950/90 px-2 py-0.5 font-mono text-[11px] font-black tabular-nums text-green-100">
                  {goalScoreBadgeByEventId.get(ev.id)}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <p className={`px-3 py-2.5 text-center text-xs text-gray-500 ${liveCardShell} border-red-500/15`}>
            Sobald etwas passiert, erscheint hier die letzte wichtige Spielaktion.
          </p>
        )}
      </section>
    );
  };

  /** Steuerzeile: [Status] [Timer] [Ende] — gleiche Höhe, Logik unverändert. */
  const trainerClockRowBtn = 'h-10 min-h-10 w-full sm:h-11 sm:min-h-11';
  const renderTrainerClockActionRow = (gapClass: string) => {
    if (matchIsFinished) return null;
    return (
      <div className={`grid grid-cols-3 items-stretch ${gapClass}`}>
        {matchClockStatus === 'live' ? (
          <button
            type="button"
            onClick={() => void onPauseClick()}
            disabled={matchClockStatus === 'finished'}
            aria-label="Spiel anhalten"
            className={`${mbPausePrimary} ${trainerClockRowBtn} px-2 text-[11px] sm:text-xs`}
          >
            <span aria-hidden>⏸</span>
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onStartClick()}
            disabled={matchClockStatus === 'finished' || matchClockStatus === 'live'}
            aria-label={matchClockStatus === 'paused' ? 'Spiel fortsetzen' : 'Spiel beginnen'}
            className={`${mbStart} ${trainerClockRowBtn} px-2 text-[11px] sm:text-xs`}
          >
            <span aria-hidden>▶</span>
            {matchClockStatus === 'paused' ? 'Weiter' : 'Beginn'}
          </button>
        )}
        <div className="flex min-w-0 items-stretch justify-center px-0.5">
          <span
            className="liveTimer inline-flex h-full w-full min-w-0 items-center justify-center rounded-full bg-red-600 px-2 font-mono text-sm font-bold tabular-nums leading-none text-white shadow-[0_0_26px_rgba(220,38,38,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] sm:text-base"
            aria-live="polite"
          >
            {formatClock(currentMatchSeconds)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEndeConfirmOpen(true)}
          disabled={matchClockStatus === 'finished' || matchClockStatus === 'not_started'}
          aria-label="Spiel beenden"
          className={`${mbEnd} ${trainerClockRowBtn} px-2 text-[11px] sm:text-xs`}
        >
          <span aria-hidden>⏹</span>
          Ende
        </button>
      </div>
    );
  };

  /** Höhe unter globalem App-Header (main pt-24); Matchboard+Tabs fix, Inhalt scrollt (inkl. pb-28 für Bottom-Nav). */
  const liveShellOuter =
    'relative flex h-[calc(100svh-6rem)] max-h-[calc(100svh-6rem)] flex-col overflow-hidden text-white';

  return (
    <div className={liveShellOuter}>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover opacity-[0.22] brightness-[0.42] saturate-[0.72]"
          style={{
            backgroundImage: `url(${matchboardWelcomeHeroSrc()})`,
            backgroundPosition: 'center 43%',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-red-950/65 to-black/85" />
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
      <header
        className={`shrink-0 border-b border-red-500/35 bg-black/78 shadow-[0_4px_32px_rgba(0,0,0,0.5)] backdrop-blur-md ${
          spectatorView ? '' : ''
        }`}
      >
        <div
          className={`${layoutShell} ${
            spectatorView ? 'px-2 pb-1 pt-0 md:px-4 md:pb-1 md:pt-0' : 'px-2 pb-1.5 pt-0.5 md:px-4 md:pb-1.5 md:pt-1'
          }`}
        >
          {matchboardVisible && (
            <div
              className={`relative mx-auto mb-0 w-full max-w-none overflow-hidden rounded-2xl border border-red-500/30 bg-black/82 shadow-[0_0_40px_rgba(239,68,68,0.18),0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md ${
                spectatorView ? 'md:max-w-xl' : 'md:max-w-2xl'
              }`}
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl bg-cover opacity-[0.12] brightness-[0.4] saturate-[0.68]"
                style={{
                  backgroundImage: `url(${matchboardWelcomeHeroSrc()})`,
                  backgroundPosition: 'center 43%',
                }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-black/80 via-red-950/65 to-black/85" />
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.12) 28%, rgba(0,0,0,0.18) 72%, rgba(0,0,0,0.62) 100%)',
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background:
                    'radial-gradient(ellipse 118% 88% at 50% 48%, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.08) 52%, rgba(0,0,0,0.45) 100%)',
                }}
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.55]"
                style={{
                  background:
                    'radial-gradient(ellipse 92% 52% at 50% -8%, rgba(220,38,38,0.12), transparent 58%)',
                }}
              />
              <div className="relative z-[1] w-full px-[15px] py-2.5 pb-1.5">
                {matchTypeDisplay ? (
                  <div className="flex justify-center">
                    <p className="text-lg font-semibold text-white sm:text-xl">{matchTypeDisplay}</p>
                  </div>
                ) : null}

                <div className={`flex justify-center ${matchTypeDisplay ? 'mt-2' : 'mt-1.5'}`}>
                  <div className={liveBadgeClassName}>
                    {hasClockStarted && !matchIsFinished ? (
                      <span className="text-[10px] leading-none text-red-100 sm:text-[11px]" aria-hidden>
                        ●
                      </span>
                    ) : null}
                    {matchIsFinished ? 'Endstand' : hasClockStarted ? 'Live' : 'Bereit'}
                  </div>
                </div>

                {/* Logo + Namen unter Logo | Score + Labels + Perioden | Logo + Namen */}
                <div className={`flex items-start justify-between gap-2 sm:gap-3 ${matchTypeDisplay ? 'mt-3' : 'mt-2.5'}`}>
                  <div className="flex min-w-0 w-[30%] max-w-[9.5rem] flex-col items-center sm:max-w-[10.5rem]">
                    <LiveMatchLogoTile src={homeLogoSrc} liveGlow={false} size="board" />
                    <div className="mt-1.5 w-full px-0.5">
                      <MatchboardTeamNameLines parts={homeNameParts} align="center" tight />
                    </div>
                  </div>

                  <div className="flex min-w-0 shrink flex-col items-center gap-1 px-0.5 sm:px-1">
                    {!spectatorView && canControlLiveMatch && !matchIsFinished ? (
                      <div className="flex items-start justify-center gap-1 sm:gap-2 motion-safe:transition-transform motion-safe:duration-300">
                        <div className="flex min-w-0 flex-col items-center gap-0.5">
                          <button
                            type="button"
                            aria-label="Heimtor erfassen. Lange drücken für Rückgängig."
                            className={scoreTapHome}
                            onContextMenu={(e) => e.preventDefault()}
                            onPointerDown={onHomeGoalScorePointerDown}
                            onPointerUp={clearHomeGoalLongPress}
                            onPointerLeave={clearHomeGoalLongPress}
                            onPointerCancel={clearHomeGoalLongPress}
                            onClick={() => {
                              if (homeGoalSuppressClickRef.current) {
                                homeGoalSuppressClickRef.current = false;
                                return;
                              }
                              setHomeGoalPickId('');
                              setHomeGoalModalOpen(true);
                            }}
                          >
                            <span className="text-4xl font-bold tabular-nums leading-none sm:text-5xl">
                              {displayScoreHome}
                            </span>
                          </button>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/95 sm:text-[11px]">
                            HEIM
                          </span>
                        </div>
                        <span
                          className="shrink-0 select-none pt-1 text-3xl font-bold leading-none text-white/90 tabular-nums sm:pt-1.5 sm:text-4xl"
                          aria-hidden
                        >
                          :
                        </span>
                        <div className="flex min-w-0 flex-col items-center gap-0.5">
                          <button
                            type="button"
                            aria-label="Gasttor erfassen. Lange drücken für Rückgängig."
                            className={scoreTapAway}
                            onContextMenu={(e) => e.preventDefault()}
                            onPointerDown={onAwayGoalScorePointerDown}
                            onPointerUp={clearAwayGoalLongPress}
                            onPointerLeave={clearAwayGoalLongPress}
                            onPointerCancel={clearAwayGoalLongPress}
                            onClick={async () => {
                              if (awayGoalSuppressClickRef.current) {
                                awayGoalSuppressClickRef.current = false;
                                return;
                              }
                              const before = recomputeScoresFromEvents(events);
                              const res = await persistSingle({
                                type: 'goal',
                                timestamp: currentMatchSeconds,
                              });
                              if (!res.ok || !res.savedId) return;
                              offerGoalUndo({
                                eventId: res.savedId,
                                side: 'away',
                                prevHome: before.home,
                                prevAway: before.away,
                              });
                            }}
                          >
                            <span className="text-4xl font-bold tabular-nums leading-none sm:text-5xl">
                              {displayScoreAway}
                            </span>
                          </button>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-400/90 sm:text-[11px]">
                            GAST
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center justify-center motion-safe:transition-transform motion-safe:duration-300">
                          <span className="text-center text-5xl font-bold leading-none text-white tabular-nums whitespace-nowrap sm:text-6xl">
                            {displayScoreHome}
                            <span className="mx-1.5 text-white/85 sm:mx-2">:</span>
                            {displayScoreAway}
                          </span>
                        </div>
                        {!matchIsFinished ? (
                          <span
                            className="liveTimer inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-1 font-mono text-base font-bold tabular-nums leading-none text-white shadow-[0_0_26px_rgba(220,38,38,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] sm:text-lg"
                            aria-live="polite"
                          >
                            {formatClock(currentMatchSeconds)}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <p className="mt-0.5 w-full text-center font-mono text-[10px] font-medium tabular-nums leading-none text-white/88 sm:text-[11px]">
                      <span className="inline-block whitespace-nowrap tracking-[-0.01em]">{periodScoreLine}</span>
                    </p>
                  </div>

                  <div className="flex min-w-0 w-[30%] max-w-[9.5rem] flex-col items-center sm:max-w-[10.5rem]">
                    <LiveMatchLogoTile src={awayLogoSrc} liveGlow={false} size="board" />
                    <div className="mt-1.5 w-full px-0.5">
                      <MatchboardTeamNameLines parts={awayNameParts} align="center" tight />
                    </div>
                  </div>
                </div>
              </div>

              {!spectatorView && canControlLiveMatch ? (
                <div className="relative z-[1] mt-0 space-y-1 border-t border-red-500/35 bg-black/55 px-[15px] py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_-12px_32px_rgba(220,38,38,0.12)] backdrop-blur-md">
                  {renderTrainerClockActionRow('gap-1.5')}

                  {!matchIsFinished ? (
                    <button
                      type="button"
                      onClick={openWechselSheet}
                      className={mbWechsel}
                    >
                      <span aria-hidden>⇄</span>
                      Wechsel
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={!matchIsFinished || calendarFinalized}
                    onClick={() => {
                      if (matchIsFinished && !calendarFinalized) setSpielAbschlussOpen(true);
                    }}
                    className={`${mbSpielEnde} gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-[11px] disabled:opacity-35`}
                  >
                    <span aria-hidden>🏆</span>
                    {calendarFinalized ? 'Termin abgeschlossen' : 'Spiel abschließen'}
                  </button>
                </div>
              ) : null}

              {saveError ? (
                <p
                  className="border-t border-white/10 bg-black/80 px-[15px] py-2 text-center text-xs font-medium text-amber-400"
                  role="alert"
                >
                  {saveError}
                </p>
              ) : null}
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
            <nav className={tabNavWrap} aria-label="Live-Ansicht">
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
        className={`relative min-h-0 flex-1 ${
          canControlLiveMatch && mainTab === 'overview' && wechselSheetOpen && !matchIsFinished
            ? 'overflow-hidden'
            : 'overflow-y-auto'
        } overscroll-y-contain [-webkit-overflow-scrolling:touch] ${layoutShell} px-2 py-2 pb-28 pt-1 md:px-4 lg:px-5 md:py-4`}
      >
        {mainTab === 'overview' && (
          <div className={canControlLiveMatch ? 'space-y-2' : 'space-y-3'}>
            {canControlLiveMatch ? (
              <>
                <div>{renderLastActionOverview('mb-1 text-xs font-bold uppercase tracking-[0.2em] text-gray-300')}</div>
                <section>
                  <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-gray-300">Spielinfo</h2>
                  <div className={`grid grid-cols-2 gap-2 px-3 py-2 ${liveCardShell} border-red-500/15 sm:grid-cols-4`}>
                    <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Abschnitt</p>
                      <p className="mt-0.5 truncate text-xs font-medium text-gray-200">{periodDisplayLine}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Laufzeit</p>
                      <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[#ef4444]">
                        {formatClock(currentMatchSeconds)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Am Feld</p>
                      <p className="mt-0.5 text-xs font-medium text-white">{fieldPlayers.length}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Bank</p>
                      <p className="mt-0.5 text-xs font-medium text-white">{benchPlayers.length}</p>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="space-y-1.5">
                {renderLastActionOverview('mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500')}
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
                {fieldPlayers.length > 0 ? (
                  <section>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-red-400/90">Spielfeld</h3>
                    <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-black p-2 sm:p-3">
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
                ) : null}
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase text-emerald-500">Startaufstellung</h3>
                  <ul className="space-y-2">
                    {fieldPlayers.map((p) => (
                      <li key={p.id}>
                        <div className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-emerald-600/40 bg-emerald-950/30 px-4 py-3">
                          <span className="text-lg font-bold text-emerald-400">{p.number || '–'}</span>
                          <span className="flex-1 px-3 text-base font-semibold text-white">{p.name}</span>
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
                          <span className="flex-1 px-3 text-base font-semibold text-white">{p.name}</span>
                        </div>
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
            <section>
              <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-gray-300">Wechsel-Vorschläge</h2>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-800/35 bg-gradient-to-br from-emerald-950/30 to-black/80 px-2.5 py-2 ring-1 ring-emerald-700/12">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/95">Spielzeit erreicht</p>
                  <p className="mt-1 text-[11px] leading-snug text-white/42">Hinweise zu Einwechslungen folgen.</p>
                </div>
                <div className="rounded-xl border border-amber-800/35 bg-gradient-to-br from-amber-950/22 to-black/80 px-2.5 py-2 ring-1 ring-amber-700/12">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400/95">Wenig Spielzeit</p>
                  <p className="mt-1 text-[11px] leading-snug text-white/42">Mehr Einsatzzeit: Hinweise folgen.</p>
                </div>
              </div>
            </section>
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

      {canControlLiveMatch && mainTab === 'overview' && wechselSheetOpen && !matchIsFinished ? (
        <div
          className="absolute inset-0 z-[70] flex items-start justify-center bg-black/58 backdrop-blur-sm"
          role="presentation"
          onClick={closeWechselSheet}
        >
          <div
            className="relative flex h-full max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border-t border-red-500/30 bg-zinc-900 shadow-[0_18px_44px_rgba(0,0,0,0.72)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wechsel-sheet-title"
          >
            <div className="shrink-0 border-b border-white/10 px-4 pb-2 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-600" aria-hidden />
              <h3 id="wechsel-sheet-title" className="text-center text-xl font-semibold text-white">
                Wechsel
              </h3>
              <p className="mt-1 text-center text-sm leading-tight text-zinc-400">
                Raus + Rein wählen, dann bestätigen
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2 [-webkit-overflow-scrolling:touch]">
              <div className="mt-2">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-400">Am Feld · Raus</p>
                <div
                  className="relative min-h-[108px] rounded-xl border border-red-500/30 bg-gradient-to-b from-red-950/25 via-black/55 to-black/85 p-1.5 sm:min-h-[116px]"
                  aria-label="Spielfeld"
                >
                  <div className="flex min-h-[88px] flex-wrap content-center justify-center gap-1 sm:min-h-[92px]">
                    {fieldPlayers.length === 0 ? (
                      <p className="text-[11px] text-white/45">Keine Feldspieler</p>
                    ) : (
                      fieldPlayers.map((p) => {
                        const sel = wechselOutId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setWechselOutId(p.id)}
                            className={`flex max-w-[32%] min-w-0 flex-1 basis-[28%] flex-col items-center justify-center gap-px rounded-lg px-0.5 py-1 text-center transition active:scale-[0.98] sm:max-w-[30%] ${
                              sel
                                ? 'border-2 border-red-500 bg-red-950/85 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]'
                                : 'border border-white/15 bg-black/55'
                            }`}
                          >
                            <span
                              className={`font-mono text-xs font-black tabular-nums ${sel ? 'text-red-200' : 'text-red-400/90'}`}
                            >
                              {p.number || '–'}
                            </span>
                            <span className="w-full hyphens-none text-[9px] font-semibold leading-tight text-white [overflow-wrap:break-word] [word-break:normal]">
                              {p.name}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">Bank · Rein</p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {benchPlayers.length === 0 ? (
                    <p className="col-span-full py-1.5 text-center text-[11px] text-white/45">Keine Bankspieler</p>
                  ) : (
                    benchPlayers.map((p) => {
                      const sel = wechselInId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setWechselInId(p.id)}
                          className={`flex min-h-[58px] flex-col items-center justify-center gap-px rounded-lg border px-0.5 py-1 text-center transition active:scale-[0.98] ${
                            sel
                              ? 'border-2 border-emerald-400 bg-emerald-950/65 shadow-[0_0_0_1px_rgba(52,211,153,0.35)]'
                              : 'border border-white/15 bg-black/55'
                          }`}
                        >
                          <span
                            className={`font-mono text-xs font-black tabular-nums ${sel ? 'text-emerald-200' : 'text-emerald-400/85'}`}
                          >
                            {p.number || '–'}
                          </span>
                          <span className="w-full hyphens-none text-[9px] font-semibold leading-tight text-white [overflow-wrap:break-word] [word-break:normal]">
                            {p.name}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div
              className="shrink-0 border-t border-white/10 bg-zinc-900/98 p-4 shadow-[0_-10px_28px_rgba(0,0,0,0.55)]"
              style={{
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
              }}
            >
              <div className="flex flex-row gap-2">
                <button
                  type="button"
                  onClick={closeWechselSheet}
                  className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-white/20 text-sm font-semibold text-white active:scale-[0.99]"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => void confirmWechselSection()}
                  disabled={matchIsFinished || !wechselOutId || !wechselInId}
                  className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-green-600 px-2 text-sm font-semibold text-white disabled:opacity-40 active:scale-[0.99]"
                >
                  Wechsel bestätigen
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
                const before = recomputeScoresFromEvents(events);
                const res = await persistSingle({
                  type: 'goal',
                  timestamp: currentMatchSeconds,
                  playerId: homeGoalPickId,
                });
                if (!res.ok || !res.savedId) return;
                offerGoalUndo({
                  eventId: res.savedId,
                  side: 'home',
                  prevHome: before.home,
                  prevAway: before.away,
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

      {endeConfirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => setEndeConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border-2 border-red-500/55 bg-zinc-950 p-5 shadow-[0_0_40px_rgba(0,0,0,0.85)] sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ende-match-title"
          >
            <h3 id="ende-match-title" className="text-xl font-black text-white sm:text-2xl">
              Spiel beenden?
            </h3>
            <p className="mt-3 text-[15px] font-medium leading-snug text-zinc-300 sm:text-base">
              Die Uhr stoppt, der Live-Modus endet und der Endstand wird gespeichert. Anschließend kannst du den Kalender-Termin mit{' '}
              <span className="font-semibold text-white">Spiel abschließen</span> abschließen.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-row-reverse">
              <button
                type="button"
                className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-red-600 to-red-950 text-base font-black uppercase tracking-wide text-white shadow-[0_0_24px_rgba(220,38,38,0.35)] active:scale-[0.99]"
                onClick={async () => {
                  setEndeConfirmOpen(false);
                  await persistMatchEndWithoutCalendar();
                }}
              >
                Ende
              </button>
              <button
                type="button"
                className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl border-2 border-white/20 bg-zinc-900 text-base font-bold text-white active:scale-[0.99]"
                onClick={() => setEndeConfirmOpen(false)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {spielAbschlussOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={() => setSpielAbschlussOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border-2 border-amber-500/45 bg-zinc-950 p-5 shadow-[0_0_40px_rgba(0,0,0,0.85)] sm:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spiel-abschluss-title"
          >
            <h3 id="spiel-abschluss-title" className="text-xl font-black text-white sm:text-2xl">
              Kalender abschließen?
            </h3>
            <p className="mt-3 text-[15px] font-medium leading-snug text-zinc-300 sm:text-base">
              Der verknüpfte Termin wird im Spielplan als beendet markiert. Danach wechselt die Ansicht zur App-Übersicht.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-row-reverse">
              <button
                type="button"
                className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-amber-600 to-amber-950 text-base font-black uppercase tracking-wide text-white shadow-[0_0_20px_rgba(245,158,11,0.28)] active:scale-[0.99]"
                onClick={() => void finalizeCalendarForMatch()}
              >
                Abschließen
              </button>
              <button
                type="button"
                className="flex min-h-[52px] flex-1 items-center justify-center rounded-xl border-2 border-white/20 bg-zinc-900 text-base font-bold text-white active:scale-[0.99]"
                onClick={() => setSpielAbschlussOpen(false)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {canControlLiveMatch && !matchIsFinished && goalUndoOffer ? (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] left-1/2 z-[70] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2">
          <div
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border border-red-400/45 bg-gradient-to-b from-red-900/95 via-red-950/95 to-black/95 px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.5),0_0_26px_rgba(220,38,38,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-md transition-all duration-300 ${
              goalUndoToastClosing ? 'translate-y-2 scale-[0.985] opacity-0' : 'translate-y-0 scale-100 opacity-100'
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-white">Rückgängig</p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-red-100/90">
                Tor für {goalUndoOffer.side === 'home' ? homeDisplayName || 'Heim' : awayDisplayName || 'Gast'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void undoLastGoal()}
              className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
            >
              ↶ Rückgängig
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
};

export default LiveMatchScreen;
