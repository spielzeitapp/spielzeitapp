import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { usePlayers } from '../../hooks/usePlayers';
import { useMatchTimer } from '../../hooks/useMatchTimer';
import {
  calculatePlayerPlaytimes,
  getBenchPlayers,
  getCurrentOnFieldBySlot,
  getCurrentOnFieldPlayers,
  getPlaytimeStatus,
  handleSubstitution,
  sortMatchEventsChronologically,
  type MatchEngineEvent,
  type MatchEventType,
} from '../../lib/matchEngine';
import {
  engineEventToInsertPayload,
  fetchEventIsHomeByMatchId,
  fetchFirstLiveMatch,
  fetchLineupForLiveMatch,
  fetchMatchById,
  deleteMatchEventById,
  fetchMatchEvents,
  getMatchLiveClockStatus,
  LIVE_FIELD_SLOT_ORDER,
  replaceMatchLineupAndBench,
  saveMatchEvent,
  saveMatchEvents,
  updateMatchRow,
  type LiveMatchRow,
} from '../../lib/liveMatchService';
import { getMatchSides, shortTeamGoalLabel } from '../../lib/matchSides';
import { LineupFormationPitch } from '../../components/match/LineupFormationPitch';
import { LeibchenJersey } from '../../components/match/LeibchenJersey';
import { MatchPlayerRow } from '../../components/match/MatchPlayerRow';
import {
  isU11FormationId,
  labelForSlotInFormation,
  U11_FORMATION_CHOICES,
  U11_FORMATION_DB_FALLBACK,
  type U11FormationId,
} from '../../lib/matchFormations';
import type { FieldSlotId } from '../../types/match';
import { compareRosterPlayers, playerItemToRoster, type RosterPlayer } from '../../lib/rosterPlayer';
import { getPositionLabel } from '../../lib/positionLabels';
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

const FORMATION_OPTION_LABELS: Record<U11FormationId, string> = {
  '1-2-2-2': 'Kompakt',
  '1-2-3-1': 'Ausgewogen',
  '1-3-2-1': 'Defensiver',
};

/** Kleines Feld-Icon für Formation-Karten im Sheet. */
function MiniPitchIcon({ className }: { className?: string }) {
  return (
    <div
      className={[
        'relative flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-emerald-500/35 bg-gradient-to-b from-emerald-800/45 to-emerald-950/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]',
        className ?? '',
      ].join(' ')}
      aria-hidden
    >
      <div className="absolute inset-[12%] rounded-[3px] border border-white/22" />
      <div className="absolute left-1/2 top-1/2 h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
      <div className="absolute bottom-[14%] left-1/2 h-[22%] w-[55%] -translate-x-1/2 rounded-t-[6px] border border-white/22 border-b-0" />
    </div>
  );
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

/** Kompakte Tabs: weniger Höhe, keine große rote Aktiv-Kapsel. */
const tabNavWrapTrainer =
  'mt-1.5 flex w-full gap-0.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/45 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const trainerTabBtn =
  'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 sm:text-[12px]';
const trainerTabBtnActive = 'bg-white/12 text-white ring-1 ring-white/12';
const trainerTabBtnIdle = 'text-white/45 hover:bg-white/[0.06] hover:text-white/85';

const spectatorTabWrapCompact =
  'mt-2 flex gap-0.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-black/45 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const spectatorTabBtnCompact =
  'flex h-9 min-h-9 shrink-0 flex-1 items-center justify-center rounded-lg border border-transparent px-1.5 text-center text-[11px] font-semibold transition-colors sm:text-[12px]';
const spectatorTabBtnCompactActive = `${trainerTabBtnActive} border-white/10`;
const spectatorTabBtnCompactIdle = 'text-white/45 hover:bg-white/[0.05] hover:text-white/85';

const liveCardShell =
  'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-black shadow-[0_6px_28px_rgba(0,0,0,0.35)]';

/** Trainer-Matchboard: einheitliche Höhe/Rundung für Steuerung + Score-Tap-Zellen. */
const mbBtnH = 'h-10 min-h-10';
const mbRound = 'rounded-xl';
const mbRowBtn = `flex ${mbBtnH} touch-manipulation items-center justify-center gap-1.5 ${mbRound} px-3 text-xs font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40`;

function eventIcon(t: MatchEventType): string {
  if (t === 'goal' || t === 'goal_away') return '⚽';
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
    if (e.type === 'goal') home += 1;
    else if (e.type === 'goal_away') away += 1;
  }
  return { home, away };
}

function findLastGoalEventIdForSide(events: MatchEngineEvent[], side: 'home' | 'away'): string | null {
  const sorted = sortMatchEventsChronologically(events);
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const e = sorted[i];
    if (side === 'home' && e.type === 'goal') return e.id;
    if (side === 'away' && e.type === 'goal_away') return e.id;
  }
  return null;
}

type EventsFilter = 'all' | 'goals' | 'subs';

/** Wechsel-Paare (sub_out + sub_in gleiche Sekunde) in chronologischer Liste zusammenfassen. */
function pairSubstitutionEventsInOrder(asc: MatchEngineEvent[]): { key: string; items: MatchEngineEvent[] }[] {
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

/** Liveticker-Zeilen für Zuschauer: chronologisch, Wechsel-Paar an gleicher Minute zusammen. */
function buildSpectatorTickerRows(events: MatchEngineEvent[]): { key: string; items: MatchEngineEvent[] }[] {
  return pairSubstitutionEventsInOrder(sortMatchEventsChronologically(events));
}

/**
 * Trainer-Liveticker: neueste zuerst, Wechsel-Paare nicht trennen.
 * Filter „Tore“: nur Tor-Events; „Wechsel“: nur Sub-Events mit Paar-Logik; „Alle“: alle Events mit Paar-Logik.
 */
function buildLiveTickerRows(events: MatchEngineEvent[], filter: EventsFilter): { key: string; items: MatchEngineEvent[] }[] {
  if (filter === 'goals') {
    const goals = events.filter((e) => e.type === 'goal' || e.type === 'goal_away');
    const desc = [...goals].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
    return desc.map((e) => ({ key: e.id, items: [e] }));
  }
  if (filter === 'subs') {
    const subs = events.filter((e) => e.type === 'sub_out' || e.type === 'sub_in');
    const paired = pairSubstitutionEventsInOrder(sortMatchEventsChronologically(subs));
    return paired.slice().reverse();
  }
  const paired = pairSubstitutionEventsInOrder(sortMatchEventsChronologically(events));
  return paired.slice().reverse();
}

function sortRosterByNumber(list: RosterPlayer[]): RosterPlayer[] {
  return [...list].sort(compareRosterPlayers);
}

function rosterFamilyName(p: RosterPlayer): string {
  const parts = (p.name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : p.name || '—';
}

function mobileLineupName(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1]! : name || '—';
}

function slotMetaFromSlotMap(
  slots: Record<FieldSlotId, string | null>,
  playerId: string,
  formationId: U11FormationId,
): { label: string; isGk: boolean } {
  const slot = LIVE_FIELD_SLOT_ORDER.find((s) => slots[s] === playerId);
  if (!slot) return { label: '–', isGk: false };
  return { label: getPositionLabel(labelForSlotInFormation(formationId, slot)) || '–', isGk: slot === 'GK' };
}

type PeriodScorePair = { h: number; a: number };
type PeriodScoresState = { p1?: PeriodScorePair; p2?: PeriodScorePair; p3?: PeriodScorePair };

function parsePeriodScorePair(value: unknown): PeriodScorePair | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as { h?: unknown; a?: unknown };
  const h = Number(raw.h);
  const a = Number(raw.a);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return undefined;
  return { h: Math.max(0, Math.trunc(h)), a: Math.max(0, Math.trunc(a)) };
}

function parsePeriodScores(value: unknown): PeriodScoresState {
  if (!value || typeof value !== 'object') return {};
  const raw = value as { p1?: unknown; p2?: unknown; p3?: unknown };
  return {
    p1: parsePeriodScorePair(raw.p1),
    p2: parsePeriodScorePair(raw.p2),
    p3: parsePeriodScorePair(raw.p3),
  };
}

function formatPeriodScoresLine(scores: PeriodScoresState): string {
  const f = (v?: PeriodScorePair) => (v ? `${v.h}:${v.a}` : '-:-');
  return `(${f(scores.p1)} | ${f(scores.p2)} | ${f(scores.p3)})`;
}

function computeUpdatedPeriodScores(
  current: PeriodScoresState,
  section: 1 | 2 | 3,
  total: { home: number; away: number },
): PeriodScoresState {
  const safeCurrent = parsePeriodScores(current);
  const p1 = safeCurrent.p1;
  const p2 = safeCurrent.p2;
  if (section === 1) {
    return { ...safeCurrent, p1: { h: total.home, a: total.away } };
  }
  if (section === 2) {
    const baseH = p1?.h ?? 0;
    const baseA = p1?.a ?? 0;
    return {
      ...safeCurrent,
      p2: { h: Math.max(0, total.home - baseH), a: Math.max(0, total.away - baseA) },
    };
  }
  const baseH = (p1?.h ?? 0) + (p2?.h ?? 0);
  const baseA = (p1?.a ?? 0) + (p2?.a ?? 0);
  return {
    ...safeCurrent,
    p3: { h: Math.max(0, total.home - baseH), a: Math.max(0, total.away - baseA) },
  };
}

function nextMissingPeriodKey(scores: PeriodScoresState): 1 | 2 | 3 | null {
  if (!scores.p1) return 1;
  if (!scores.p2) return 2;
  if (!scores.p3) return 3;
  return null;
}

function resolveSectionForPause(scores: PeriodScoresState): 1 | 2 | 3 {
  return nextMissingPeriodKey(scores) ?? 3;
}

function resolveSectionForEnd(scores: PeriodScoresState): 1 | 2 | 3 {
  if (scores.p1 && scores.p2 && !scores.p3) return 3;
  if (scores.p1 && !scores.p2) return 2;
  if (!scores.p1) return 1;
  return 3;
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
  const [initialStartingPlayerIds, setInitialStartingPlayerIds] = useState<string[]>([]);
  const [events, setEvents] = useState<MatchEngineEvent[]>([]);
  const [opponentLabel, setOpponentLabel] = useState('Gegner');
  const [eventIsHome, setEventIsHome] = useState<boolean | null>(null);
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
          setEventIsHome(null);
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
        setEventIsHome(null);
        setPageLoading(false);
        return;
      }

      const [mRes, lineRes, evRes, isHomeRes] = await Promise.all([
        fetchMatchById(resolvedId),
        fetchLineupForLiveMatch(resolvedId),
        fetchMatchEvents(resolvedId),
        fetchEventIsHomeByMatchId(resolvedId),
      ]);
      if (cancelled) return;
      if (mRes.error || !mRes.data) {
        setPageError(mRes.error ?? 'Spiel nicht gefunden.');
        setEffectiveMatchId(null);
        setMatchRow(null);
        setLineupData(null);
        setEvents([]);
        setEventIsHome(null);
        setPageLoading(false);
        return;
      }
      setEffectiveMatchId(resolvedId);
      setMatchRow(mRes.data);
      setEventIsHome(isHomeRes.isHome);
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
  const safePlayers = Array.isArray(players) ? players : [];

  const roster = useMemo(() => sortRosterByNumber(safePlayers.map(playerItemToRoster)), [safePlayers]);
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
    setInitialStartingPlayerIds([]);
  }, [effectiveMatchId]);

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
    setInitialStartingPlayerIds((prev) =>
      prev.length > 0 ? prev : [...lineupData.startingPlayerIds].slice(0, 7),
    );
  }, [matchRow, lineupData]);

  const reloadMatchSetupFromDb = useCallback(async () => {
    if (!effectiveMatchId) return;
    if (lineupReloadInFlightRef.current) {
      lineupReloadPendingRef.current = true;
      return;
    }
    lineupReloadInFlightRef.current = true;
    const lineRes = await fetchLineupForLiveMatch(effectiveMatchId);
    lineupReloadInFlightRef.current = false;
    setLineupData(lineRes.error ? { startingPlayerIds: [], squadPlayerIds: [] } : lineRes.data);
    if (lineRes.error) setSaveError(lineRes.error);
    if (lineupReloadPendingRef.current) {
      lineupReloadPendingRef.current = false;
      void reloadMatchSetupFromDb();
    }
  }, [effectiveMatchId]);

  const reloadLiveMatchState = useCallback(async () => {
    if (!effectiveMatchId || realtimeReloadInFlightRef.current) return;
    realtimeReloadInFlightRef.current = true;
    const [mRes, evRes] = await Promise.all([
      fetchMatchById(effectiveMatchId),
      fetchMatchEvents(effectiveMatchId),
    ]);
    realtimeReloadInFlightRef.current = false;
    if (mRes.error) setSaveError(mRes.error);
    if (mRes.data) setMatchRow(mRes.data);
    void reloadMatchSetupFromDb();
    if (evRes.error) setSaveError(evRes.error);
    const sorted = sortMatchEventsChronologically(evRes.data);
    setEvents([...sorted].reverse());
  }, [effectiveMatchId, reloadMatchSetupFromDb]);

  const queueRealtimeReload = useCallback(() => {
    if (realtimeReloadTimerRef.current != null) {
      window.clearTimeout(realtimeReloadTimerRef.current);
    }
    realtimeReloadTimerRef.current = window.setTimeout(() => {
      realtimeReloadTimerRef.current = null;
      void reloadLiveMatchState();
    }, 220);
  }, [reloadLiveMatchState]);

  /** Gleiche Reload-Kette für alle Rollen: Match-Zeile, Events, Lineup + Bank aus der DB. */
  const queueLiveMatchRealtimeUpdate = useCallback(
    (payload: { eventType?: string }) => {
      if (import.meta.env.DEV) {
        console.log('live lineup realtime update', payload.eventType);
      }
      queueRealtimeReload();
    },
    [queueRealtimeReload],
  );

  useEffect(() => {
    if (!effectiveMatchId) return;
    const channel = supabase
      .channel(`live-match-screen-${effectiveMatchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${effectiveMatchId}`,
        },
        queueLiveMatchRealtimeUpdate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${effectiveMatchId}`,
        },
        queueLiveMatchRealtimeUpdate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_lineup',
          filter: `match_id=eq.${effectiveMatchId}`,
        },
        queueLiveMatchRealtimeUpdate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_bench',
          filter: `match_id=eq.${effectiveMatchId}`,
        },
        queueLiveMatchRealtimeUpdate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_lineup_slots',
          filter: `match_id=eq.${effectiveMatchId}`,
        },
        queueLiveMatchRealtimeUpdate,
      )
      .subscribe();
    // Realtime + RLS (SELECT) für diese Tabellen; `match_lineup_slots` nur, falls die Tabelle in der DB existiert und publiziert ist.
    return () => {
      if (realtimeReloadTimerRef.current != null) {
        window.clearTimeout(realtimeReloadTimerRef.current);
        realtimeReloadTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [effectiveMatchId, queueLiveMatchRealtimeUpdate]);

  const homeNameRaw = selectedTeamSeason?.team?.name ?? HOME_FALLBACK;
  const headerOpponent = opponentLabel;
  const sides = useMemo(
    () =>
      getMatchSides({
        isHome: eventIsHome,
        ownTeamName: homeNameRaw,
        opponentName: headerOpponent,
      }),
    [eventIsHome, homeNameRaw, headerOpponent],
  );
  const stadiumHomeDisplay = cleanTeamDisplayName(sides.homeTeamName);
  const stadiumAwayDisplay = cleanTeamDisplayName(sides.awayTeamName);
  const homeNameParts = matchboardAbbrevAndClub(stadiumHomeDisplay);
  const awayNameParts = matchboardAbbrevAndClub(stadiumAwayDisplay);
  const goalTapHomeLabel = shortTeamGoalLabel(stadiumHomeDisplay);
  const goalTapAwayLabel = shortTeamGoalLabel(stadiumAwayDisplay);
  const opponentDisplayName = cleanTeamDisplayName(headerOpponent);
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
  const [subSheetView, setSubSheetView] = useState<'list' | 'pitch'>('list');
  const [subOutPlayerId, setSubOutPlayerId] = useState<string | null>(null);
  const [subInPlayerId, setSubInPlayerId] = useState<string | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const closeWechselSheet = useCallback(() => {
    setWechselSheetOpen(false);
    setSubSheetView('list');
    setSubOutPlayerId(null);
    setSubInPlayerId(null);
    setSubSaving(false);
  }, []);
  const openWechselSheet = useCallback(() => {
    setSubOutPlayerId(null);
    setSubInPlayerId(null);
    setSubSaving(false);
    setSubSheetView('list');
    setWechselSheetOpen(true);
  }, []);
  useEffect(() => {
    if (wechselSheetOpen && mainTab !== 'overview') closeWechselSheet();
  }, [wechselSheetOpen, mainTab, closeWechselSheet]);

  const [formationSheetOpen, setFormationSheetOpen] = useState(false);
  const [formationSaving, setFormationSaving] = useState(false);
  const closeFormationSheet = useCallback(() => {
    setFormationSheetOpen(false);
    setFormationSaving(false);
  }, []);
  useEffect(() => {
    if (formationSheetOpen && mainTab !== 'lineup') closeFormationSheet();
  }, [formationSheetOpen, mainTab, closeFormationSheet]);

  const [formationChangeToast, setFormationChangeToast] = useState(false);
  useEffect(() => {
    if (!formationChangeToast) return;
    const t = window.setTimeout(() => setFormationChangeToast(false), 2000);
    return () => window.clearTimeout(t);
  }, [formationChangeToast]);

  const [homeGoalModalOpen, setHomeGoalModalOpen] = useState(false);
  const [homeGoalPickId, setHomeGoalPickId] = useState<string>('');
  const [awayGoalModalOpen, setAwayGoalModalOpen] = useState(false);
  const [awayGoalPickId, setAwayGoalPickId] = useState<string>('');
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
  const substitutionToastTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const substitutionAnimTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const substitutionHighlightTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const realtimeReloadTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const realtimeReloadInFlightRef = useRef(false);
  const lineupReloadInFlightRef = useRef(false);
  const lineupReloadPendingRef = useRef(false);
  const prevLineupSlotsRef = useRef<Partial<Record<FieldSlotId, string | null>> | null>(null);
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
      if (substitutionToastTimerRef.current != null) window.clearTimeout(substitutionToastTimerRef.current);
      if (substitutionAnimTimerRef.current != null) window.clearTimeout(substitutionAnimTimerRef.current);
      if (substitutionHighlightTimerRef.current != null) window.clearTimeout(substitutionHighlightTimerRef.current);
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
    setMatchRow((prev) =>
      prev
        ? {
            ...prev,
            score_home: prevHome,
            score_away: prevAway,
          }
        : prev,
    );
    const { error: rowErr } = await updateMatchRow(effectiveMatchId, {
      score_home: prevHome,
      score_away: prevAway,
    });
    if (rowErr) setSaveError(rowErr);
    queueRealtimeReload();
  }, [effectiveMatchId, clearGoalUndoTimer, queueRealtimeReload]);

  const onFieldIds = useMemo(
    () => getCurrentOnFieldPlayers(startingPlayerIds, events, currentMatchSeconds),
    [startingPlayerIds, events, currentMatchSeconds],
  );

  const onFieldBySlot = useMemo(
    () => getCurrentOnFieldBySlot(startingPlayerIds, events, currentMatchSeconds),
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
  const safeSlotOrder = Array.isArray(LIVE_FIELD_SLOT_ORDER) ? LIVE_FIELD_SLOT_ORDER : [];
  const lineupSlotsForDisplay = useMemo(() => {
    const base = onFieldBySlot && typeof onFieldBySlot === 'object' ? onFieldBySlot : ({} as Record<FieldSlotId, string | null>);
    const out = { ...base };
    const seen = new Set<string>();
    for (const slot of safeSlotOrder) {
      const pid = out[slot];
      if (!pid) continue;
      if (seen.has(pid)) {
        out[slot] = null;
        continue;
      }
      seen.add(pid);
    }
    return out;
  }, [onFieldBySlot, safeSlotOrder]);

  /** Single Source of Truth: `matches.u11_formation_id` (Realtime), kein localStorage. */
  const safeFormationId = useMemo((): U11FormationId => {
    const raw = matchRow?.u11_formation_id;
    return isU11FormationId(raw) ? raw : U11_FORMATION_DB_FALLBACK;
  }, [matchRow]);

  const applyLiveFormation = useCallback(
    async (id: U11FormationId) => {
      if (!effectiveMatchId || !canControlLiveMatch || formationSaving) return;
      if (id === safeFormationId) {
        closeFormationSheet();
        return;
      }
      setFormationSaving(true);
      setSaveError(null);
      const { error } = await updateMatchRow(effectiveMatchId, { u11_formation_id: id });
      setFormationSaving(false);
      if (error) {
        setSaveError(error);
        return;
      }
      void queueRealtimeReload();
      closeFormationSheet();
      setFormationChangeToast(true);
    },
    [
      effectiveMatchId,
      canControlLiveMatch,
      formationSaving,
      safeFormationId,
      closeFormationSheet,
      queueRealtimeReload,
    ],
  );

  const safeLineupRows = useMemo(
    () =>
      safeSlotOrder.map((slot) => {
        const playerId = onFieldBySlot?.[slot] ?? null;
        const player = playerId ? rosterById.get(playerId) ?? null : null;
        return {
          id: player?.id ?? slot,
          slot,
          rightLabel: getPositionLabel(labelForSlotInFormation(safeFormationId, slot)) || '–',
          display_name: player?.name ?? 'Spieler',
          position: player?.position ?? null,
          jersey_number: player?.number ?? null,
          avatar_url: player?.avatarUrl ?? null,
        };
      }),
    [safeSlotOrder, onFieldBySlot, rosterById, safeFormationId],
  );
  const safeBenchRows = useMemo(
    () =>
      (Array.isArray(benchPlayers) ? benchPlayers : []).map((player) => ({
        id: player?.id ?? '',
        display_name: player?.name ?? 'Spieler',
        position: player?.position ?? null,
        jersey_number: player?.number ?? null,
        avatar_url: player?.avatarUrl ?? null,
      })),
    [benchPlayers],
  );

  const substitutionFieldRows = useMemo(() => {
    if (!Array.isArray(safeLineupRows)) return [];
    return safeLineupRows.filter((row) => {
      const slot = row?.slot;
      if (!slot) return false;
      const pid = onFieldBySlot?.[slot];
      return typeof pid === 'string' && pid.length > 0;
    });
  }, [safeLineupRows, onFieldBySlot]);

  const substitutionBenchRows = useMemo(() => {
    if (!Array.isArray(safeBenchRows)) return [];
    return safeBenchRows.filter((r) => typeof r?.id === 'string' && r.id.length > 0);
  }, [safeBenchRows]);

  const wechselSheetPickLabels = useMemo(() => {
    const outPid = String(subOutPlayerId ?? '').trim();
    const inPid = String(subInPlayerId ?? '').trim();
    const outP = outPid ? rosterById.get(outPid) ?? null : null;
    const inP = inPid ? rosterById.get(inPid) ?? null : null;
    const outLabel = outPid
      ? mobileLineupName(
          String(
            outP?.name ??
              (substitutionFieldRows.find((r) => {
                const sl = r?.slot;
                const id =
                  sl && onFieldBySlot && typeof onFieldBySlot === 'object'
                    ? String(onFieldBySlot[sl] ?? '').trim()
                    : '';
                return id === outPid;
              })?.display_name ?? 'Spieler'),
          ),
        )
      : '';
    const inLabel = inPid
      ? mobileLineupName(
          String(
            inP?.name ??
              (Array.isArray(substitutionBenchRows)
                ? substitutionBenchRows.find((r) => String(r?.id ?? '').trim() === inPid)?.display_name
                : null) ??
              'Spieler',
          ),
        )
      : '';
    return { outLabel, inLabel };
  }, [subOutPlayerId, subInPlayerId, rosterById, substitutionFieldRows, substitutionBenchRows, onFieldBySlot]);

  const safeLineupSlots = useMemo(
    () => (lineupSlotsForDisplay && typeof lineupSlotsForDisplay === 'object' ? lineupSlotsForDisplay : {}),
    [lineupSlotsForDisplay],
  );

  /** Roter Slot-Ring im Wechsel-Spielfeld-Modus für den als „raus“ gewählten Spieler. */
  const subPitchSlotHighlight = useMemo((): Partial<Record<FieldSlotId, 'in' | 'out'>> => {
    const out = String(subOutPlayerId ?? '').trim();
    if (!out) return {};
    const slots =
      safeLineupSlots && typeof safeLineupSlots === 'object'
        ? (safeLineupSlots as Record<FieldSlotId, string | null>)
        : ({} as Record<FieldSlotId, string | null>);
    for (const slot of safeSlotOrder) {
      const pid = String(slots[slot] ?? '').trim();
      if (pid === out) return { [slot]: 'out' };
    }
    return {};
  }, [subOutPlayerId, safeLineupSlots, safeSlotOrder]);

  const [substitutionTransitionBySlot, setSubstitutionTransitionBySlot] = useState<
    Partial<Record<FieldSlotId, { outgoingPlayerId: string | null; incomingPlayerId: string | null }>>
  >({});
  const [slotHighlightBySlot, setSlotHighlightBySlot] = useState<Partial<Record<FieldSlotId, 'in' | 'out'>>>({});
  const [substitutionToastText, setSubstitutionToastText] = useState<string | null>(null);
  const canRenderLivePitch = safeSlotOrder.length > 0 && safeFormationId != null;
  const safeLineupRowsCount = Array.isArray(safeLineupRows) ? safeLineupRows.length : 0;
  const safeBenchRowsCount = Array.isArray(safeBenchRows) ? safeBenchRows.length : 0;

  useEffect(() => {
    const prev = prevLineupSlotsRef.current;
    const current = safeLineupSlots as Partial<Record<FieldSlotId, string | null>>;
    if (!prev) {
      prevLineupSlotsRef.current = { ...current };
      return;
    }
    const changedSlots = safeSlotOrder.filter((slot) => {
      const before = String(prev[slot] ?? '').trim() || null;
      const after = String(current[slot] ?? '').trim() || null;
      return before !== after;
    });
    if (changedSlots.length === 0) {
      prevLineupSlotsRef.current = { ...current };
      return;
    }

    const nextTransition: Partial<Record<FieldSlotId, { outgoingPlayerId: string | null; incomingPlayerId: string | null }>> = {};
    const nextHighlight: Partial<Record<FieldSlotId, 'in' | 'out'>> = {};
    for (const slot of changedSlots) {
      const outgoing = String(prev[slot] ?? '').trim() || null;
      const incoming = String(current[slot] ?? '').trim() || null;
      nextTransition[slot] = { outgoingPlayerId: outgoing, incomingPlayerId: incoming };
      nextHighlight[slot] = incoming ? 'in' : 'out';
    }
    setSubstitutionTransitionBySlot(nextTransition);
    setSlotHighlightBySlot(nextHighlight);

    const firstSwapSlot = changedSlots.find((slot) => {
      const outgoing = String(prev[slot] ?? '').trim();
      const incoming = String(current[slot] ?? '').trim();
      return Boolean(outgoing && incoming && outgoing !== incoming);
    });
    if (firstSwapSlot) {
      const outId = String(prev[firstSwapSlot] ?? '').trim();
      const inId = String(current[firstSwapSlot] ?? '').trim();
      const outName = mobileLineupName((rosterById.get(outId)?.name ?? 'Spieler').trim() || 'Spieler');
      const inName = mobileLineupName((rosterById.get(inId)?.name ?? 'Spieler').trim() || 'Spieler');
      setSubstitutionToastText(`🔁 ${outName} raus – ${inName} rein`);
      if (substitutionToastTimerRef.current != null) window.clearTimeout(substitutionToastTimerRef.current);
      substitutionToastTimerRef.current = window.setTimeout(() => {
        setSubstitutionToastText(null);
        substitutionToastTimerRef.current = null;
      }, 2000);
    }

    if (substitutionAnimTimerRef.current != null) window.clearTimeout(substitutionAnimTimerRef.current);
    substitutionAnimTimerRef.current = window.setTimeout(() => {
      setSubstitutionTransitionBySlot({});
      substitutionAnimTimerRef.current = null;
    }, 360);

    if (substitutionHighlightTimerRef.current != null) window.clearTimeout(substitutionHighlightTimerRef.current);
    substitutionHighlightTimerRef.current = window.setTimeout(() => {
      setSlotHighlightBySlot({});
      substitutionHighlightTimerRef.current = null;
    }, 1500);

    prevLineupSlotsRef.current = { ...current };
  }, [safeLineupSlots, safeSlotOrder, rosterById]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const slotKeys = safeSlotOrder.filter((s) => Boolean(lineupSlotsForDisplay[s]));
    const lineupCount = slotKeys.length;
    console.log('live lineup props', {
      role: canControlLiveMatch ? 'trainer_staff' : String(backendRole ?? 'spectator'),
      safeFormationId,
      slotKeys,
      lineupCount,
      benchCount: safeBenchRowsCount,
    });
  }, [
    backendRole,
    canControlLiveMatch,
    lineupSlotsForDisplay,
    safeBenchRowsCount,
    safeFormationId,
    safeSlotOrder,
  ]);

  const playtimes = useMemo(
    () => calculatePlayerPlaytimes(startingPlayerIds, squadPlayerIds, events, currentMatchSeconds),
    [startingPlayerIds, squadPlayerIds, events, currentMatchSeconds],
  );
  const periodScores = useMemo(() => parsePeriodScores(matchRow?.period_scores), [matchRow?.period_scores]);

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
        if (partial.type === 'goal' || partial.type === 'goal_away') {
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
    const section = resolveSectionForPause(periodScores);
    const totals = recomputeScoresFromEvents(events);
    const nextPeriodScores = computeUpdatedPeriodScores(periodScores, section, totals);
    const { error } = await updateMatchRow(effectiveMatchId, {
      live_elapsed_seconds: frozen,
      live_is_running: false,
      period_scores: nextPeriodScores,
    });
    if (error) setSaveError(error);
    else
      setMatchRow((prev) =>
        prev ? { ...prev, live_elapsed_seconds: frozen, live_is_running: false, period_scores: nextPeriodScores } : null,
      );
  };

  /** Ende: Uhr stoppen, Match in DB beenden, Endstand aus Toren — ohne Kalender-Termin (kommt bei „Spiel abschließen“). */
  const persistMatchEndWithoutCalendar = async () => {
    if (!canControlLiveMatch || matchIsFinished || !effectiveMatchId) return;
    const frozen = currentMatchSeconds;
    const { home: fh, away: fa } = recomputeScoresFromEvents(events);
    const { ok } = await persistSingle({ type: 'end', timestamp: frozen });
    if (!ok) return;
    const sectionForEnd = resolveSectionForEnd(periodScores);
    const nextPeriodScores = computeUpdatedPeriodScores(periodScores, sectionForEnd, { home: fh, away: fa });
    const { error } = await updateMatchRow(effectiveMatchId, {
      status: 'finished',
      live_is_running: false,
      live_elapsed_seconds: frozen,
      live_period: half,
      score_home: fh,
      score_away: fa,
      period_scores: nextPeriodScores,
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
              period_scores: nextPeriodScores,
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
      if (!check.ok) {
        setSaveError(check.reason ?? 'Wechsel nicht möglich.');
        return false;
      }

      setSaveError(null);
      const nextStarting = startingPlayerIds.map((id) => (id === outgoingPlayerId ? incomingPlayerId : id)).slice(0, 7);
      const nextSquad = [...new Set([...squadPlayerIds, outgoingPlayerId, incomingPlayerId])];
      const { error: swapErr } = await replaceMatchLineupAndBench(effectiveMatchId, nextStarting, nextSquad);
      if (swapErr) {
        setSaveError(swapErr);
        return false;
      }
      setStartingPlayerIds(nextStarting);
      setSquadPlayerIds(nextSquad);

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
        setSaveError(error ?? 'Wechsel durchgeführt, aber Wechsel-Event konnte nicht gespeichert werden.');
        setEvents((prev) => prev.filter((e) => e.id !== tempOut && e.id !== tempIn));
        return true;
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
    [
      canControlLiveMatch,
      matchIsFinished,
      effectiveMatchId,
      currentMatchSeconds,
      events,
      onFieldIds,
      half,
      startingPlayerIds,
      squadPlayerIds,
    ],
  );

  const confirmSubstitution = useCallback(async () => {
    const outId = String(subOutPlayerId ?? '').trim();
    const inId = String(subInPlayerId ?? '').trim();
    if (!outId || !inId || outId === inId) return;
    setSubSaving(true);
    try {
      const ok = await persistSubstitution(outId, inId);
      if (ok) {
        void queueRealtimeReload();
        closeWechselSheet();
      }
    } catch (e) {
      console.error('[LiveMatch] confirmSubstitution', e);
      setSaveError('Wechsel konnte nicht abgeschlossen werden.');
    } finally {
      setSubSaving(false);
    }
  }, [subOutPlayerId, subInPlayerId, persistSubstitution, queueRealtimeReload, closeWechselSheet]);

  const trainerTickerRows = useMemo(() => buildLiveTickerRows(events, eventsFilter), [events, eventsFilter]);

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
        h += 1;
        map.set(ev.id, `${h}:${a}`);
      } else if (ev.type === 'goal_away') {
        a += 1;
        map.set(ev.id, `${h}:${a}`);
      }
    }
    return map;
  }, [events]);

  const periodScoreLine = useMemo(() => formatPeriodScoresLine(periodScores), [periodScores]);

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
        return name ? `⚽ TOR ${stadiumHomeDisplay}: ${name}` : `⚽ TOR ${stadiumHomeDisplay}`;
      case 'goal_away':
        return name ? `⚽ TOR ${stadiumAwayDisplay}: ${name}` : `⚽ TOR ${stadiumAwayDisplay}`;
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
        return name ? `${name} trifft für ${stadiumHomeDisplay}` : `Tor für ${stadiumHomeDisplay}`;
      case 'goal_away':
        return name ? `${name} trifft für ${stadiumAwayDisplay}` : `Tor für ${stadiumAwayDisplay}`;
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
    const isHomeGoal = ev.type === 'goal';
    const isAwayGoal = ev.type === 'goal_away';
    const isGoal = isHomeGoal || isAwayGoal;
    const isSub = ev.type === 'sub_out' || ev.type === 'sub_in';
    const pl = ev.playerId ? rosterById.get(ev.playerId) : undefined;
    const scoreStr =
      showGoalScoreBadge && isGoal ? (goalScoreBadgeByEventId.get(ev.id) ?? null) : null;
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
                    ⚽ TOR {stadiumHomeDisplay}
                  </span>
                  {pl ? (
                    <p className="mt-1 truncate text-sm font-semibold leading-snug text-white">
                      {pl.name}
                      {pl.number != null && String(pl.number).trim() !== '' ? (
                        <span className="text-gray-300"> ({pl.number})</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-gray-400">Ohne Torschütze</p>
                  )}
                </>
              ) : isAwayGoal ? (
                <>
                  <span className="inline-flex rounded-full border border-red-600 bg-red-950/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-100">
                    ⚽ TOR {stadiumAwayDisplay}
                  </span>
                  {pl ? (
                    <p className="mt-1 truncate text-sm font-semibold leading-snug text-white">
                      {pl.name}
                      {pl.number != null && String(pl.number).trim() !== '' ? (
                        <span className="text-gray-300"> ({pl.number})</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-gray-400">Ohne Torschütze</p>
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
      const outP = rosterById.get(row.items[0].playerId ?? '')?.name ?? '—';
      const inP = rosterById.get(row.items[1].playerId ?? '')?.name ?? '—';
      body = (
        <>
          <p className="text-[10px] font-black uppercase tracking-wide text-sky-300">🔁 Wechsel</p>
          <div className="mt-1.5 space-y-0.5">
            <p className="text-[12px] font-semibold leading-snug text-red-200/95">Raus · {outP}</p>
            <p className="py-0.5 text-center text-[11px] text-white/40">↓</p>
            <p className="text-[12px] font-semibold leading-snug text-emerald-300/95">Rein · {inP}</p>
          </div>
        </>
      );
    } else if (ev.type === 'goal' || ev.type === 'goal_away') {
      const pl = ev.playerId ? rosterById.get(ev.playerId) : undefined;
      const teamLine = ev.type === 'goal' ? stadiumHomeDisplay : stadiumAwayDisplay;
      const homeSide = ev.type === 'goal';
      const badge = goalScoreBadgeByEventId.get(ev.id);
      body = (
        <>
          <p
            className={`text-[10px] font-black uppercase tracking-wide ${homeSide ? 'text-emerald-400' : 'text-red-400'}`}
          >
            ⚽ TOR {teamLine}
          </p>
          {pl ? <p className="mt-1 truncate text-sm font-bold text-white">{pl.name}</p> : null}
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
        <div
          className={`min-w-0 flex-1 px-3 py-2 ${liveCardShell} ${
            ev.type === 'goal'
              ? 'border-l-[3px] border-l-emerald-500/75'
              : ev.type === 'goal_away'
                ? 'border-r-[3px] border-r-red-500/75'
                : ''
          }`}
        >
          {body}
        </div>
      </li>
    );
  };

  const renderTrainerTickerRow = (
    row: { key: string; items: MatchEngineEvent[] },
    index: number,
    listLength: number,
  ) => {
    const ev = row.items[0];
    const isPair =
      row.items.length === 2 &&
      row.items[0].type === 'sub_out' &&
      row.items[1].type === 'sub_in' &&
      row.items[1].timestamp === row.items[0].timestamp;

    if (isPair) {
      const outEv = row.items[0];
      const inEv = row.items[1];
      const outName = rosterById.get(outEv.playerId ?? '')?.name ?? '—';
      const inName = rosterById.get(inEv.playerId ?? '')?.name ?? '—';
      const t = outEv.timestamp;
      const lineConnector =
        index < listLength - 1 ? (
          <div
            className="absolute top-2.5 bottom-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-red-600/35"
            aria-hidden
          />
        ) : null;
      return (
        <li key={row.key} className="relative flex gap-0 pb-2.5 last:pb-0 md:pb-3">
          <div className="flex w-11 shrink-0 flex-col items-end pr-1 pt-0.5 md:w-14 md:pr-1.5">
            <span className="text-sm font-bold tabular-nums leading-none text-white md:text-base">{formatMinute(t)}</span>
          </div>
          <div className="relative flex w-3 shrink-0 flex-col items-center pt-1 md:w-4">
            {lineConnector}
            <div className="relative z-10 h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-h-0 items-stretch gap-2 rounded-lg border border-white/10 bg-zinc-950 px-2 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.35)] md:gap-2 md:px-2.5 md:py-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-950/80 text-sm text-sky-200 ring-1 ring-sky-500/30 md:h-9 md:w-9 md:text-base"
                aria-hidden
              >
                ⇄
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <p className="text-[10px] font-black uppercase tracking-wide text-sky-300">🔁 Wechsel</p>
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-[12px] font-semibold leading-snug text-red-200/95">Raus · {outName}</p>
                  <p className="py-0.5 text-center text-[11px] text-white/40">↓</p>
                  <p className="text-[12px] font-semibold leading-snug text-emerald-300/95">Rein · {inName}</p>
                </div>
              </div>
            </div>
          </div>
        </li>
      );
    }

    return renderTimelineRow(ev, index, listLength, true, true);
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

  const ownLogoName =
    selectedTeamSeason?.team?.name?.trim() && selectedTeamSeason.team.name.trim() !== HOME_FALLBACK
      ? selectedTeamSeason.team.name.trim()
      : getOurTeamDisplayName();
  const homeLogoSrc = getClubLogo(sides.isOwnTeamHome ? ownLogoName : headerOpponent);
  const awayLogoSrc = getClubLogo(sides.isOwnTeamHome ? headerOpponent : ownLogoName);
  const kickoffRaw = matchRow?.match_date ? new Date(matchRow.match_date) : null;
  const kickoffDateTime =
    kickoffRaw && !Number.isNaN(kickoffRaw.getTime())
      ? {
          date: kickoffRaw.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          time: kickoffRaw.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }),
        }
      : { date: 'Noch offen', time: 'Noch offen' };
  const meetingAtRaw =
    typeof (matchRow as (LiveMatchRow & { meeting_at?: string | null }) | null)?.meeting_at === 'string'
      ? ((matchRow as LiveMatchRow & { meeting_at?: string | null }).meeting_at ?? '')
      : '';
  const meetingAtDate = meetingAtRaw ? new Date(meetingAtRaw) : null;
  const meetingAtDisplay = !meetingAtRaw
    ? ''
    : meetingAtDate && !Number.isNaN(meetingAtDate.getTime())
      ? meetingAtDate.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
      : meetingAtRaw;

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
                {ev.type === 'goal' ? (
                  <>
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-400">
                      ⚽ TOR {stadiumHomeDisplay}
                    </p>
                    {ev.playerId ? (
                      <p className="truncate text-sm font-bold text-white">
                        {rosterById.get(ev.playerId)?.name ?? '?'}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-500">Ohne Torschütze</p>
                    )}
                  </>
                ) : ev.type === 'goal_away' ? (
                  <>
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-red-400">
                      ⚽ TOR {stadiumAwayDisplay}
                    </p>
                    {ev.playerId ? (
                      <p className="truncate text-sm font-bold text-white">
                        {rosterById.get(ev.playerId)?.name ?? '?'}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-500">Ohne Torschütze</p>
                    )}
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
              {(ev.type === 'goal' || ev.type === 'goal_away') && goalScoreBadgeByEventId.get(ev.id) ? (
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
      <style>{`@keyframes liveSubIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes liveSubOut{from{opacity:.92;transform:translateY(0)}to{opacity:0;transform:translateY(10px)}}`}</style>
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
              } ${mainTab === 'lineup' ? 'origin-top scale-[0.9] sm:scale-100' : ''}`}
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
                            aria-label={`Tor ${stadiumHomeDisplay} erfassen. Lange drücken für Rückgängig.`}
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
                              if (sides.isOwnTeamHome) {
                                setHomeGoalPickId('');
                                setHomeGoalModalOpen(true);
                                return;
                              }
                              void (async () => {
                                const before = recomputeScoresFromEvents(events);
                                const res = await persistSingle({
                                  type: 'goal',
                                  timestamp: currentMatchSeconds,
                                });
                                if (!res.ok || !res.savedId) return;
                                offerGoalUndo({
                                  eventId: res.savedId,
                                  side: 'home',
                                  prevHome: before.home,
                                  prevAway: before.away,
                                });
                              })();
                            }}
                          >
                            <span className="text-4xl font-bold tabular-nums leading-none sm:text-5xl">
                              {displayScoreHome}
                            </span>
                          </button>
                          <span className="max-w-[5.5rem] truncate text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400/95 sm:max-w-[6.5rem] sm:text-[11px]">
                            {goalTapHomeLabel}
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
                            aria-label={`Tor ${stadiumAwayDisplay} erfassen. Lange drücken für Rückgängig.`}
                            className={scoreTapAway}
                            onContextMenu={(e) => e.preventDefault()}
                            onPointerDown={onAwayGoalScorePointerDown}
                            onPointerUp={clearAwayGoalLongPress}
                            onPointerLeave={clearAwayGoalLongPress}
                            onPointerCancel={clearAwayGoalLongPress}
                            onClick={() => {
                              if (awayGoalSuppressClickRef.current) {
                                awayGoalSuppressClickRef.current = false;
                                return;
                              }
                              if (sides.isOwnTeamHome) {
                                void (async () => {
                                  const before = recomputeScoresFromEvents(events);
                                  const res = await persistSingle({
                                    type: 'goal_away',
                                    timestamp: currentMatchSeconds,
                                  });
                                  if (!res.ok || !res.savedId) return;
                                  offerGoalUndo({
                                    eventId: res.savedId,
                                    side: 'away',
                                    prevHome: before.home,
                                    prevAway: before.away,
                                  });
                                })();
                                return;
                              }
                              setAwayGoalPickId('');
                              setAwayGoalModalOpen(true);
                            }}
                          >
                            <span className="text-4xl font-bold tabular-nums leading-none sm:text-5xl">
                              {displayScoreAway}
                            </span>
                          </button>
                          <span className="max-w-[5.5rem] truncate text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-red-400/90 sm:max-w-[6.5rem] sm:text-[11px]">
                            {goalTapAwayLabel}
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
            <nav className={spectatorTabWrapCompact} aria-label="Live-Ansicht">
              <button
                type="button"
                className={`${spectatorTabBtnCompact} ${mainTab === 'overview' ? spectatorTabBtnCompactActive : spectatorTabBtnCompactIdle}`}
                onClick={() => setMainTab('overview')}
              >
                Übersicht
              </button>
              <button
                type="button"
                className={`${spectatorTabBtnCompact} ${mainTab === 'lineup' ? spectatorTabBtnCompactActive : spectatorTabBtnCompactIdle}`}
                onClick={() => setMainTab('lineup')}
              >
                Aufstellung
              </button>
              <button
                type="button"
                className={`${spectatorTabBtnCompact} ${mainTab === 'events' ? spectatorTabBtnCompactActive : spectatorTabBtnCompactIdle}`}
                onClick={() => setMainTab('events')}
              >
                Liveticker
              </button>
            </nav>
          ) : canControlLiveMatch && mainTab === 'lineup' ? (
            <div
              className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-white/[0.06] px-2 pb-2 pt-0.5"
              aria-label="Navigation Aufstellung"
            >
              <button
                type="button"
                onClick={() => setMainTab('events')}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-3 py-1 text-[12px] font-semibold text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-950/45"
              >
                ← Liveticker
              </button>
              <span className="hidden text-[10px] text-white/25 sm:inline" aria-hidden>
                |
              </span>
              <button
                type="button"
                onClick={() => setMainTab('overview')}
                className="min-h-[36px] rounded-lg px-2 py-1 text-[11px] font-medium text-white/50 hover:bg-white/[0.05] hover:text-white/85"
              >
                Übersicht
              </button>
              <button
                type="button"
                onClick={() => setMainTab('time')}
                className="min-h-[36px] rounded-lg px-2 py-1 text-[11px] font-medium text-white/50 hover:bg-white/[0.05] hover:text-white/85"
              >
                Statistik
              </button>
            </div>
          ) : (
            <nav className={tabNavWrapTrainer} aria-label="Live-Ansicht">
              <button
                type="button"
                className={`${trainerTabBtn} ${mainTab === 'overview' ? trainerTabBtnActive : trainerTabBtnIdle}`}
                onClick={() => setMainTab('overview')}
              >
                Übersicht
              </button>
              <button
                type="button"
                className={`${trainerTabBtn} ${mainTab === 'lineup' ? trainerTabBtnActive : trainerTabBtnIdle}`}
                onClick={() => setMainTab('lineup')}
              >
                Aufstellung
              </button>
              <button
                type="button"
                className={`${trainerTabBtn} ${mainTab === 'events' ? trainerTabBtnActive : trainerTabBtnIdle}`}
                onClick={() => setMainTab('events')}
              >
                Ticker
              </button>
              <button
                type="button"
                className={`${trainerTabBtn} ${mainTab === 'time' ? trainerTabBtnActive : trainerTabBtnIdle}`}
                onClick={() => setMainTab('time')}
              >
                Statistik
              </button>
            </nav>
          )}
        </div>
      </header>

      <div
        className={`relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${layoutShell} pb-40 pt-1 md:px-4 lg:px-5 md:py-4 ${
          mainTab === 'lineup' ? 'px-0 py-1 sm:px-2 sm:py-2' : 'px-2 py-2'
        }`}
      >
        {mainTab === 'overview' && (
          <div className={canControlLiveMatch ? 'space-y-2' : 'space-y-3'}>
            {canControlLiveMatch ? (
              <>
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
                <section>
                  <h2 className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    Spielinfo
                  </h2>
                  <div className={`space-y-1.5 px-3 py-2 ${liveCardShell} border-red-500/15`}>
                    <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Datum
                      </span>
                      <span className="max-w-[65%] text-right text-xs font-medium text-white">{kickoffDateTime.date}</span>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        Spielbeginn
                      </span>
                      <span className="max-w-[65%] text-right text-xs font-medium text-gray-200">{kickoffDateTime.time}</span>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Spielort</span>
                      <span className="max-w-[65%] text-right text-xs font-medium text-gray-200">
                        {matchRow?.location?.trim() || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Gegner</span>
                      <span className="max-w-[65%] text-right text-xs font-medium text-white">
                        {opponentDisplayName || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Wettbewerb</span>
                      <span className="max-w-[65%] text-right text-xs font-medium text-white">{matchTypeDisplay}</span>
                    </div>
                    {meetingAtDisplay ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Treffpunkt</span>
                        <span className="max-w-[65%] text-right text-xs font-medium text-white">{meetingAtDisplay}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Laufzeit</span>
                        <span className="font-mono text-xs font-bold tabular-nums text-[#ef4444]">
                          {formatClock(currentMatchSeconds)}
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {mainTab === 'lineup' && (
          <div
            className="space-y-2 px-0 pt-2 sm:space-y-3 sm:px-2"
            style={{ paddingBottom: 'calc(160px + env(safe-area-inset-bottom, 0px))' }}
          >
            <section className="space-y-1.5 rounded-2xl border border-white/[0.08] bg-black/40 p-1.5 sm:space-y-2 sm:p-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5 px-0.5 sm:px-1">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 sm:text-[11px]">
                  Live-Aufstellung
                </h3>
                {canControlLiveMatch ? (
                  <button
                    type="button"
                    onClick={() => setFormationSheetOpen(true)}
                    className="inline-flex min-h-[32px] shrink-0 items-center rounded-lg border border-red-500/35 bg-red-950/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-red-100/95 transition-colors active:scale-[0.98] hover:border-red-400/45 hover:bg-red-950/55 sm:text-[10px]"
                  >
                    Formation
                  </button>
                ) : null}
              </div>
              {canRenderLivePitch ? (
                <LineupFormationPitch
                  formationId={safeFormationId}
                  slots={safeLineupSlots as Record<FieldSlotId, string | null>}
                  emphasizedPlayerId={null}
                  slotHighlightBySlot={slotHighlightBySlot}
                  className="max-h-[min(58dvh,34rem)] sm:max-h-[min(62dvh,38rem)]"
                  renderSlotContent={({ slot, label, playerId, isGk }) => {
                    if (!playerId) return null;
                    const player = rosterById.get(playerId) ?? null;
                    const posLabel = getPositionLabel(label) || '–';
                    const rawName = (player?.displayName ?? player?.name ?? '').trim() || 'Spieler';
                    const shortName = (() => {
                      const s = mobileLineupName(rawName);
                      return s === '—' || !s ? 'Spieler' : s;
                    })();
                    return (
                      <div className="pointer-events-none relative flex w-full max-w-[min(22vw,5.25rem)] flex-col items-center">
                        {(() => {
                          const t = substitutionTransitionBySlot[slot];
                          const outgoingId = t?.outgoingPlayerId ?? null;
                          const incomingId = t?.incomingPlayerId ?? null;
                          const isIncoming = Boolean(incomingId && incomingId === playerId);
                          if (!outgoingId || !isIncoming || outgoingId === playerId) return null;
                          const outgoing = rosterById.get(outgoingId) ?? null;
                          const outName = mobileLineupName((outgoing?.name ?? 'Spieler').trim() || 'Spieler');
                          return (
                            <div className="absolute left-1/2 top-0 z-[2] -translate-x-1/2 animate-[liveSubOut_300ms_ease-out]">
                              <LeibchenJersey
                                lastName={outName}
                                number={outgoing?.number ?? '–'}
                                position={posLabel}
                                variant={isGk ? 'goalkeeper' : 'field'}
                                size="compact"
                                pitchStyleBack
                                className="!opacity-70"
                              />
                            </div>
                          );
                        })()}
                        <div
                          className={[
                            'transition-all duration-300 ease-out',
                            substitutionTransitionBySlot[slot]?.incomingPlayerId === playerId
                              ? 'animate-[liveSubIn_300ms_ease-out]'
                              : 'translate-y-0 opacity-100',
                          ].join(' ')}
                        >
                          <LeibchenJersey
                            lastName={shortName}
                            number={player?.number ?? '–'}
                            position={posLabel}
                            variant={isGk ? 'goalkeeper' : 'field'}
                            size="compact"
                            pitchStyleBack
                          />
                        </div>
                        <span
                          className="mt-0.5 w-full min-w-0 truncate rounded-md bg-black/85 px-1 py-0.5 text-center text-[9px] font-semibold leading-tight text-white shadow-sm ring-1 ring-white/15 transition-all duration-300 ease-out sm:text-[10px]"
                          title={rawName}
                        >
                          {shortName}
                        </span>
                      </div>
                    );
                  }}
                />
              ) : (
                <p className="rounded-xl border border-white/10 bg-black/25 px-3 py-4 text-sm text-white/55">
                  Live-Aufstellung wird geladen
                </p>
              )}

              <div className="rounded-lg border border-white/10 bg-black/30 p-1.5 sm:p-2">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/55">Bank</p>
                {safeBenchRowsCount === 0 ? (
                  <p className="text-[11px] text-white/45">Keine Bankspieler</p>
                ) : (
                  <div className="overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                    <div className="flex min-w-min flex-nowrap items-start gap-1.5 sm:gap-2">
                      {(Array.isArray(safeBenchRows) ? safeBenchRows : []).map((row, idx) => {
                        const posLabel = getPositionLabel(row.position) || '–';
                        return (
                          <div
                            key={`live-bench-tile-${row.id || idx}`}
                            className="flex w-[4.75rem] min-w-0 shrink-0 flex-col items-center rounded-lg border border-white/12 bg-black/35 px-1 py-1 sm:w-[5.25rem]"
                          >
                            <LeibchenJersey
                              lastName={mobileLineupName(row.display_name || row.name || 'Spieler')}
                              number={row.jersey_number ?? row.number ?? '–'}
                              position={posLabel}
                              variant={posLabel === 'TW' ? 'goalkeeper' : 'field'}
                              size="compact"
                              pitchStyleBack
                              className="!h-[3.1rem] !w-[2.45rem] sm:!h-[3.6rem] sm:!w-[2.85rem]"
                            />
                            <span
                              className="mt-0.5 block w-full min-w-0 truncate text-center text-[10px] font-bold leading-tight text-white sm:text-xs"
                              title={String(row.display_name || row.name || 'Spieler')}
                            >
                              {mobileLineupName(row.display_name || row.name || 'Spieler')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-2 rounded-2xl border border-white/[0.06] bg-black/25 p-3 opacity-95">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white/70">STARTAUFSTELLUNG</h3>
              {safeLineupRowsCount === 0 ? (
                <p className="text-sm text-white/55">Keine Startaufstellung</p>
              ) : (
                <div className="space-y-1.5">
                  {(Array.isArray(safeLineupRows) ? safeLineupRows : []).map((row) => (
                    <MatchPlayerRow
                      key={`lineup-row-${row.slot}`}
                      player={row}
                      rightLabel={row.rightLabel}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2 rounded-2xl border border-white/[0.06] bg-black/25 p-3 opacity-95">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white/70">BANK</h3>
              {safeBenchRowsCount === 0 ? (
                <p className="text-sm text-white/55">Keine Bankspieler</p>
              ) : (
                <div className="space-y-1.5">
                  {(Array.isArray(safeBenchRows) ? safeBenchRows : []).map((row, idx) => (
                    <MatchPlayerRow
                      key={`bench-row-${row.id || idx}`}
                      player={row}
                      rightLabel="Bank"
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {mainTab === 'events' && (
          <div className="space-y-2">
            <div className="flex gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5 sm:gap-1.5">
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
                  className={`min-h-[32px] flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors sm:min-h-[34px] sm:text-xs ${
                    eventsFilter === key ? trainerTabBtnActive : 'text-white/45 hover:text-white/75'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {trainerTickerRows.length === 0 ? (
              <p className={`px-4 py-8 text-center text-sm text-gray-400 ${liveCardShell} border-red-500/20`}>
                Keine Einträge für diesen Filter.
              </p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto rounded-xl border border-red-500/30 bg-black px-1 py-2 sm:px-2 sm:py-3">
                {trainerTickerRows.map((row, i, arr) => renderTrainerTickerRow(row, i, arr.length))}
              </ul>
            )}
          </div>
        )}

        {mainTab === 'time' && (
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
      </div>

      {canControlLiveMatch && formationSheetOpen ? (
        <div className="fixed inset-0 z-[9998] flex h-[100dvh] flex-col bg-black/75 backdrop-blur-sm">
          <button
            type="button"
            className="h-[34dvh] max-h-[36dvh] min-h-[32dvh] w-full flex-shrink-0 cursor-default border-0 bg-transparent p-0"
            onClick={closeFormationSheet}
            aria-label="Schließen"
          />
          <div
            className="flex min-h-0 flex-1 flex-col justify-end"
            role="presentation"
            onClick={closeFormationSheet}
          >
            <div
              className="flex max-h-[78dvh] min-h-0 w-full flex-col overflow-hidden rounded-t-3xl border border-red-500/20 bg-gradient-to-b from-red-950/35 via-black to-black text-white shadow-[0_-12px_48px_rgba(0,0,0,0.65),0_0_28px_rgba(239,68,68,0.1)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="formation-sheet-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-red-400/35" />
              <div className="shrink-0 px-3 pb-3 pt-2 text-center">
                <h3 id="formation-sheet-title" className="text-base font-black tracking-tight text-white">
                  Formation ändern
                </h3>
                <p className="mt-0.5 text-[11px] leading-snug text-white/45">
                  Nur Darstellung — Spieler bleiben auf den Slots
                </p>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-3 [-webkit-overflow-scrolling:touch] pb-2">
                {U11_FORMATION_CHOICES.map((id) => {
                  const active = id === safeFormationId;
                  return (
                    <button
                      key={`formation-pick-${id}`}
                      type="button"
                      disabled={formationSaving}
                      onClick={() => void applyLiveFormation(id)}
                      className={[
                        'flex w-full items-stretch gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.99] disabled:opacity-45',
                        active
                          ? 'border-emerald-500/65 bg-emerald-950/35 shadow-[0_0_20px_rgba(16,185,129,0.18)] ring-1 ring-emerald-500/45'
                          : 'border-white/[0.1] bg-black/45 hover:border-red-500/28 hover:bg-black/55',
                      ].join(' ')}
                    >
                      <MiniPitchIcon
                        className={
                          active ? 'border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]' : 'opacity-90'
                        }
                      />
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xl font-black tabular-nums tracking-tight text-white sm:text-2xl">
                            {id}
                          </span>
                          {active ? (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-950 shadow-sm">
                              Aktuell
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[12px] font-medium leading-snug text-white/50">
                          {FORMATION_OPTION_LABELS[id]}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <footer
                className="shrink-0 border-t border-red-500/15 bg-black/80 px-3 pt-2 backdrop-blur-md"
                style={{
                  paddingBottom: 'calc(110px + env(safe-area-inset-bottom, 0px))',
                }}
              >
                <button
                  type="button"
                  disabled={formationSaving}
                  onClick={closeFormationSheet}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/12 bg-zinc-900/95 text-sm font-bold text-white/85 hover:bg-zinc-800 disabled:opacity-45"
                >
                  Schließen
                </button>
              </footer>
            </div>
          </div>
        </div>
      ) : null}

      {canControlLiveMatch && wechselSheetOpen && !matchIsFinished ? (
        <div
          className="fixed inset-0 z-[9999] flex flex-col justify-end bg-black/75 backdrop-blur-sm"
          role="presentation"
          onClick={closeWechselSheet}
        >
          <div
            className="flex min-h-0 max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-red-500/20 bg-gradient-to-b from-red-950/35 via-black to-black text-white shadow-[0_-12px_48px_rgba(0,0,0,0.65),0_0_28px_rgba(239,68,68,0.1)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wechsel-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-1.5 h-0.5 w-7 shrink-0 rounded-full bg-red-400/35" />
            <div className="shrink-0 px-2 pb-0 pt-1.5 text-center">
              <h3 id="wechsel-sheet-title" className="text-sm font-black tracking-tight text-white">
                Wechsel
              </h3>
              {wechselSheetPickLabels.outLabel || wechselSheetPickLabels.inLabel ? (
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  {wechselSheetPickLabels.outLabel ? (
                    <span className="max-w-[48%] truncate rounded-full border border-red-500/40 bg-red-950/55 px-2 py-0.5 text-[9px] font-bold text-red-100 sm:max-w-[12rem] sm:text-[10px]">
                      Raus: {wechselSheetPickLabels.outLabel}
                    </span>
                  ) : null}
                  {wechselSheetPickLabels.inLabel ? (
                    <span className="max-w-[48%] truncate rounded-full border border-emerald-500/40 bg-emerald-950/45 px-2 py-0.5 text-[9px] font-bold text-emerald-100 sm:max-w-[12rem] sm:text-[10px]">
                      Rein: {wechselSheetPickLabels.inLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-2 pb-0.5 pt-0.5">
              <div className="flex w-full shrink-0 justify-center px-0.5">
                <div className="inline-flex w-full max-w-[17rem] rounded-lg border border-white/10 bg-black/55 p-px shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <button
                    type="button"
                    onClick={() => setSubSheetView('list')}
                    className={[
                      'min-h-[30px] flex-1 rounded-md py-1 text-center text-[10px] font-bold leading-none transition-colors',
                      subSheetView === 'list'
                        ? 'bg-red-600/95 text-white shadow-[0_0_10px_rgba(239,68,68,0.22)]'
                        : 'text-white/50 hover:text-white/85',
                    ].join(' ')}
                  >
                    Liste
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubSheetView('pitch')}
                    className={[
                      'min-h-[30px] flex-1 rounded-md py-1 text-center text-[10px] font-bold leading-none transition-colors',
                      subSheetView === 'pitch'
                        ? 'bg-red-600/95 text-white shadow-[0_0_10px_rgba(239,68,68,0.22)]'
                        : 'text-white/50 hover:text-white/85',
                    ].join(' ')}
                  >
                    Spielfeld
                  </button>
                </div>
              </div>

              {subSheetView === 'list' ? (
                <div
                  className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden sm:gap-2.5"
                  style={{ minHeight: 'min(44dvh, 15.5rem)' }}
                >
                  <div className="flex min-h-0 flex-1 flex-col gap-0.5">
                    <p className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-red-300/95">Raus · Feld</p>
                    {substitutionFieldRows.length === 0 ? (
                      <p className="shrink-0 rounded-md border border-red-500/15 bg-black/50 px-1.5 py-1 text-[10px] text-white/45">
                        Keine Feldspieler.
                      </p>
                    ) : (
                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pr-0.5">
                        <div className="flex flex-col gap-1.5">
                          {substitutionFieldRows.map((row) => {
                            const slot = row?.slot;
                            const pid =
                              slot && onFieldBySlot && typeof onFieldBySlot === 'object'
                                ? String(onFieldBySlot[slot] ?? '').trim()
                                : '';
                            if (!pid) return null;
                            const rosterP = rosterById.get(pid) ?? null;
                            const name = String(row?.display_name ?? rosterP?.name ?? 'Spieler').trim() || 'Spieler';
                            const shortName = mobileLineupName(name);
                            const slotBadge = String(row?.rightLabel ?? '–').trim() || '—';
                            const posLabel = getPositionLabel(row.position) || slotBadge;
                            const num = rosterP?.number ?? row?.jersey_number ?? null;
                            const selected = subOutPlayerId === pid;
                            const isGk = posLabel === 'TW' || slotBadge === 'TW';
                            return (
                              <button
                                key={`sub-out-${slot}-${pid}`}
                                type="button"
                                onClick={() => setSubOutPlayerId(pid)}
                                className={[
                                  'flex h-[80px] min-h-[72px] max-h-[84px] shrink-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition-all active:scale-[0.99]',
                                  'bg-gradient-to-br from-red-950/40 via-black/75 to-black/92',
                                  selected
                                    ? 'border-red-500 shadow-[0_0_18px_rgba(239,68,68,0.38)] ring-2 ring-red-500/50'
                                    : 'border-white/[0.1] hover:border-red-500/35',
                                ].join(' ')}
                              >
                                <div className="pointer-events-none shrink-0">
                                  <LeibchenJersey
                                    lastName={shortName}
                                    number={num ?? '–'}
                                    position={posLabel}
                                    variant={isGk ? 'goalkeeper' : 'field'}
                                    size="compact"
                                    pitchStyleBack
                                    className="!h-[3.45rem] !w-[2.72rem] sm:!h-[3.85rem] sm:!w-[3.05rem]"
                                  />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                                  <p className="truncate text-[14px] font-bold leading-snug text-white sm:text-[15px]">
                                    <span className="tabular-nums text-red-200">{num != null ? `${num} · ` : ''}</span>
                                    {shortName}
                                  </p>
                                  <span className="inline-flex w-fit rounded-md border border-red-500/35 bg-red-950/50 px-1.5 py-px text-[7px] font-bold uppercase tracking-wide text-red-100/95">
                                    {slotBadge}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-0.5">
                    <p className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300/95">Rein · Bank</p>
                    {substitutionBenchRows.length === 0 ? (
                      <p className="shrink-0 rounded-md border border-emerald-500/15 bg-black/50 px-1.5 py-1 text-[10px] text-white/45">
                        Keine Bankspieler.
                      </p>
                    ) : (
                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pr-0.5">
                        <div className="flex flex-col gap-1.5">
                          {substitutionBenchRows.map((row) => {
                            const pid = String(row?.id ?? '').trim();
                            if (!pid) return null;
                            const rosterP = rosterById.get(pid) ?? null;
                            const name = String(row?.display_name ?? rosterP?.name ?? 'Spieler').trim() || 'Spieler';
                            const shortName = mobileLineupName(name);
                            const posLabel = getPositionLabel(row.position) || '–';
                            const num = rosterP?.number ?? row?.jersey_number ?? null;
                            const selected = subInPlayerId === pid;
                            const isGk = posLabel === 'TW';
                            return (
                              <button
                                key={`sub-in-${pid}`}
                                type="button"
                                onClick={() => setSubInPlayerId(pid)}
                                className={[
                                  'flex h-[80px] min-h-[72px] max-h-[84px] shrink-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition-all active:scale-[0.99]',
                                  'bg-gradient-to-br from-emerald-950/25 via-black/75 to-black/92',
                                  selected
                                    ? 'border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.38)] ring-2 ring-emerald-400/55'
                                    : 'border-white/[0.1] hover:border-emerald-500/32',
                                ].join(' ')}
                              >
                                <div className="pointer-events-none shrink-0">
                                  <LeibchenJersey
                                    lastName={shortName}
                                    number={num ?? '–'}
                                    position={posLabel}
                                    variant={isGk ? 'goalkeeper' : 'field'}
                                    size="compact"
                                    pitchStyleBack
                                    className="!h-[3.45rem] !w-[2.72rem] sm:!h-[3.85rem] sm:!w-[3.05rem]"
                                  />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                                  <p className="truncate text-[14px] font-bold leading-snug text-white sm:text-[15px]">
                                    <span className="tabular-nums text-emerald-200">{num != null ? `${num} · ` : ''}</span>
                                    {shortName}
                                  </p>
                                  <span className="inline-flex w-fit rounded-md border border-amber-500/35 bg-amber-950/45 px-1.5 py-px text-[7px] font-bold uppercase tracking-wide text-amber-100/95">
                                    Bank
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pr-0.5">
                  {!canRenderLivePitch ? (
                    <p className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center text-[10px] text-white/50">
                      Aufstellung wird geladen …
                    </p>
                  ) : (
                    <>
                      <div className="mx-auto w-full max-w-md shrink-0 overflow-hidden px-0.5">
                        <LineupFormationPitch
                          formationId={safeFormationId}
                          slots={(safeLineupSlots ?? {}) as Record<FieldSlotId, string | null>}
                          interactive
                          onSlotTap={(slot) => {
                            const raw =
                              safeLineupSlots && typeof safeLineupSlots === 'object'
                                ? (safeLineupSlots as Record<FieldSlotId, string | null>)[slot]
                                : null;
                            const pid = String(raw ?? '').trim();
                            if (pid) setSubOutPlayerId(pid);
                          }}
                          slotHighlightBySlot={subPitchSlotHighlight}
                          emphasizedPlayerId={null}
                          renderSlotContent={({ slot, label, playerId, isGk }) => {
                            if (!playerId) return null;
                            const player = rosterById.get(playerId) ?? null;
                            const posLabel = getPositionLabel(label) || '–';
                            const rawName = (player?.displayName ?? player?.name ?? '').trim() || 'Spieler';
                            const shortName = (() => {
                              const s = mobileLineupName(rawName);
                              return s === '—' || !s ? 'Spieler' : s;
                            })();
                            const isOutPick = String(subOutPlayerId ?? '').trim() === String(playerId).trim();
                            return (
                              <div
                                className={[
                                  'pointer-events-none relative flex w-full max-w-[min(22vw,5.25rem)] flex-col items-center rounded-lg transition-shadow duration-200',
                                  isOutPick
                                    ? 'shadow-[0_0_22px_rgba(239,68,68,0.55),0_0_8px_rgba(239,68,68,0.35)]'
                                    : '',
                                ].join(' ')}
                              >
                                <LeibchenJersey
                                  lastName={shortName}
                                  number={player?.number ?? '–'}
                                  position={posLabel}
                                  variant={isGk ? 'goalkeeper' : 'field'}
                                  size="compact"
                                  pitchStyleBack
                                  className="sm:!h-[4.1rem] sm:!w-[3.25rem]"
                                />
                                <span
                                  className="mt-0.5 w-full min-w-0 truncate rounded-md bg-black/85 px-1 py-0.5 text-center text-[10px] font-semibold leading-tight text-white shadow-sm ring-1 ring-white/15 sm:text-[11px]"
                                  title={rawName}
                                >
                                  {shortName}
                                </span>
                              </div>
                            );
                          }}
                          className="max-h-[min(50dvh,52vh)] sm:max-h-[min(52dvh,34rem)]"
                        />
                      </div>
                      <section className="shrink-0 border-t border-white/[0.08] pt-1.5">
                        <p className="mb-1 px-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300/90">
                          Bank
                        </p>
                        {substitutionBenchRows.length === 0 ? (
                          <p className="rounded-md border border-emerald-500/15 bg-black/50 px-1.5 py-1 text-[10px] text-white/45">
                            Keine Bankspieler.
                          </p>
                        ) : (
                          <div className="-mx-0.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                            <div className="flex min-w-min flex-nowrap items-start gap-2 px-0.5">
                              {substitutionBenchRows.map((row, idx) => {
                                const pid = String(row?.id ?? '').trim();
                                if (!pid) return null;
                                const name = String(row?.display_name ?? 'Spieler').trim() || 'Spieler';
                                const shortName = mobileLineupName(name);
                                const posLabel = getPositionLabel(row.position) || '–';
                                const num = row.jersey_number ?? row.number ?? '–';
                                const selected = subInPlayerId === pid;
                                return (
                                  <button
                                    key={`sub-pitch-bench-${row.id || idx}`}
                                    type="button"
                                    onClick={() => setSubInPlayerId(pid)}
                                    title={name}
                                    className={[
                                      'flex w-[4.65rem] shrink-0 flex-col items-center rounded-xl border bg-black/35 px-1 py-1 transition-all active:scale-[0.98] sm:w-[5.1rem]',
                                      selected
                                        ? 'border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.48)] ring-2 ring-emerald-400/65'
                                        : 'border-white/14 hover:border-emerald-500/38',
                                    ].join(' ')}
                                  >
                                    <LeibchenJersey
                                      lastName={shortName}
                                      number={num}
                                      position={posLabel}
                                      variant={posLabel === 'TW' ? 'goalkeeper' : 'field'}
                                      size="compact"
                                      pitchStyleBack
                                      className="!h-[3.25rem] !w-[2.55rem] sm:!h-[3.55rem] sm:!w-[2.8rem]"
                                    />
                                    <span className="mt-0.5 w-full min-w-0 truncate text-center text-[10px] font-bold leading-tight text-white sm:text-[11px]">
                                      {shortName}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </div>
              )}
            </div>

            <footer
              className="sticky bottom-0 z-[70] shrink-0 border-t border-red-500/15 bg-black/90 px-2 pt-1.5 backdrop-blur-md"
              style={{
                paddingBottom: 'calc(110px + env(safe-area-inset-bottom))',
              }}
            >
              <div className="flex flex-row gap-2">
                <button
                  type="button"
                  disabled={subSaving}
                  onClick={closeWechselSheet}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-white/12 bg-zinc-900/95 text-xs font-bold text-white/85 hover:bg-zinc-800 disabled:opacity-45"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={
                    subSaving ||
                    !String(subOutPlayerId ?? '').trim() ||
                    !String(subInPlayerId ?? '').trim() ||
                    String(subOutPlayerId ?? '').trim() === String(subInPlayerId ?? '').trim()
                  }
                  onClick={() => void confirmSubstitution()}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-emerald-600 px-1 text-xs font-bold text-white shadow-[0_0_14px_rgba(16,185,129,0.32)] disabled:opacity-35"
                >
                  {subSaving
                    ? '…'
                    : wechselSheetPickLabels.outLabel && wechselSheetPickLabels.inLabel
                      ? (() => {
                          const s = `${wechselSheetPickLabels.outLabel} → ${wechselSheetPickLabels.inLabel}`;
                          return s.length <= 30 ? s : 'Wechsel bestätigen';
                        })()
                      : 'Wechsel bestätigen'}
                </button>
              </div>
            </footer>
          </div>
        </div>
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
            <h3 className="text-center text-lg font-bold">Tor {stadiumHomeDisplay}</h3>
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

      {awayGoalModalOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm"
          role="presentation"
          onClick={() => setAwayGoalModalOpen(false)}
        >
          <div
            className="max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141414] px-4 pb-8 pt-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="text-center text-lg font-bold">Tor {stadiumAwayDisplay}</h3>
            <p className="mt-1 text-center text-sm text-white/50">Torschütze wählen, dann bestätigen</p>

            <div className="mt-5">
              <p className="mb-2 text-xs font-bold uppercase text-red-400/90">Am Feld</p>
              <div className="flex flex-wrap gap-2">
                {homeScorerCandidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAwayGoalPickId(p.id)}
                    className={`min-h-[48px] min-w-[100px] flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                      awayGoalPickId === p.id
                        ? 'bg-red-600 text-white'
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
              disabled={!awayGoalPickId}
              onClick={async () => {
                if (!awayGoalPickId || !effectiveMatchId) return;
                const before = recomputeScoresFromEvents(events);
                const res = await persistSingle({
                  type: 'goal_away',
                  timestamp: currentMatchSeconds,
                  playerId: awayGoalPickId,
                });
                if (!res.ok || !res.savedId) return;
                offerGoalUndo({
                  eventId: res.savedId,
                  side: 'away',
                  prevHome: before.home,
                  prevAway: before.away,
                });
                setAwayGoalModalOpen(false);
                setAwayGoalPickId('');
              }}
              className="mt-6 flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-red-600 text-lg font-bold text-white disabled:opacity-35 active:scale-[0.99]"
            >
              Tor bestätigen
            </button>
            <button
              type="button"
              onClick={() => setAwayGoalModalOpen(false)}
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
                Tor für{' '}
                {goalUndoOffer.side === 'home' ? stadiumHomeDisplay || 'Heim' : stadiumAwayDisplay || 'Gast'}
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
      {substitutionToastText ? (
        <div className="pointer-events-none fixed top-[calc(env(safe-area-inset-top,0px)+4.2rem)] left-1/2 z-[80] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2">
          <div className="rounded-xl border border-emerald-400/35 bg-black/85 px-3 py-2 text-center text-xs font-semibold text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-md">
            {substitutionToastText}
          </div>
        </div>
      ) : null}
      {formationChangeToast ? (
        <div className="pointer-events-none fixed bottom-[calc(110px+env(safe-area-inset-bottom,0px))] left-1/2 z-[10001] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2">
          <div className="rounded-xl border border-emerald-400/45 bg-black/90 px-4 py-2.5 text-center text-sm font-semibold text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,0.28)] backdrop-blur-md">
            ✓ Formation geändert
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
};

export default LiveMatchScreen;
