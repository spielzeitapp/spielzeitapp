import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { usePlayers } from '../../hooks/usePlayers';
import { useMatchTimer } from '../../hooks/useMatchTimer';
import {
  applySubstitutionToSlots,
  collectLiveStatPlayerIds,
  deriveLiveMatchReplayState,
  liveStatPlayerSortRank,
  resolvePlaytimeFinalMatchSecond,
  resolveReplayAtMatchSecond,
  clampEffectiveMatchSeconds,
  type PlayerPlaytimeMap,
  displayMatchMinuteFromEffectiveSeconds,
  fieldSlotMapToStartingIds,
  getBenchPlayers,
  getOnFieldIdsInSlotOrder,
  getPlaytimeStatus,
  handleSubstitution,
  replaySubstitutionEventsOnSlots,
  fairPlayRemovedPlayerIdFromEvent,
  sortMatchEventsChronologically,
  startingLineupToSlotMap,
  type MatchEngineEvent,
  type MatchEventType,
} from '../../lib/matchEngine';
import {
  engineEventToInsertPayload,
  fetchEventIsHomeByMatchId,
  fetchFirstLiveMatch,
  fetchKickoffLineupPlayerIds,
  fetchLineupForLiveMatch,
  fetchMatchById,
  deleteMatchEventById,
  fetchMatchEvents,
  getMatchLiveClockStatus,
  LIVE_FIELD_SLOT_ORDER,
  persistExtraPlayerOff,
  persistExtraPlayerOn,
  replaceMatchLineupAndBench,
  repairLiveMatchLineupBenchIfNeeded,
  syncFinalLineupBenchFromEventReplay,
  persistPositionSwap,
  saveMatchEvent,
  updateMatchRow,
  type LiveMatchRow,
} from '../../lib/liveMatchService';
import { getMatchSides } from '../../lib/matchSides';
import { countOccupiedFieldSlots } from '../../lib/liveLineupNormalize';
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
import { ensureResultFeedPostForMatch } from '../../lib/ensureResultFeedPost';

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
  size?: 'md' | 'hero' | 'heroLg' | 'schedule' | 'board' | 'boardSm';
}) {
  const [imgSrc, setImgSrc] = useState(isValidLogoUrl(src) ? src : '/logos/placeholder-shield-a.png');
  useEffect(() => {
    setImgSrc(isValidLogoUrl(src) ? src : '/logos/placeholder-shield-a.png');
  }, [src]);
  const glow = liveGlow ? 'shadow-[0_0_12px_rgba(255,0,0,0.3)]' : '';
  const box =
    size === 'boardSm'
      ? 'h-[4.25rem] w-[4.25rem] sm:h-[4.5rem] sm:w-[4.5rem]'
      : size === 'board'
        ? 'h-[5.25rem] w-[5.25rem] sm:h-28 sm:w-28'
        : size === 'schedule'
          ? 'h-12 w-12'
          : size === 'heroLg'
          ? 'h-[6.25rem] w-[6.25rem] sm:h-[6.75rem] sm:w-[6.75rem] md:h-[7.25rem] md:w-[7.25rem]'
            : size === 'hero'
              ? 'h-14 w-14'
              : 'h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem]';
  const imgClass =
    size === 'boardSm'
      ? 'h-full w-full max-h-[3.85rem] max-w-[3.85rem] object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.16)] sm:max-h-[4.1rem] sm:max-w-[4.1rem]'
      : size === 'board'
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
  const m = displayMatchMinuteFromEffectiveSeconds(ts);
  return m <= 0 ? "0'" : `${m}'`;
}

/** Coach-Vorschläge: Liniengruppe vom Slot (Live) — TW separat. */
type CoachLineGroup = 'DEF' | 'MID' | 'OFF';

function coachLineGroupFromSlot(slot: FieldSlotId): CoachLineGroup | 'GK' {
  if (slot === 'GK') return 'GK';
  if (slot === 'LB' || slot === 'RB') return 'DEF';
  if (slot === 'ST') return 'OFF';
  return 'MID';
}

function coachLineGroupFromRosterPosition(pos: string | null | undefined): CoachLineGroup | 'GK' {
  const c = String(pos ?? '').trim().toUpperCase();
  if (!c || c === 'GK') return 'GK';
  if (['LB', 'RB', 'LV', 'RV'].includes(c)) return 'DEF';
  if (['ST', 'LS', 'RS'].includes(c)) return 'OFF';
  return 'MID';
}

function slotForFieldPlayer(
  slots: Record<FieldSlotId, string | null>,
  playerId: string,
): FieldSlotId | null {
  const want = String(playerId ?? '').trim();
  if (!want) return null;
  for (const s of LIVE_FIELD_SLOT_ORDER) {
    if (String(slots[s] ?? '').trim() === want) return s;
  }
  return null;
}

const FORMATION_OPTION_LABELS: Record<U11FormationId, string> = {
  '1-2-2-2': 'Kompakt',
  '1-2-3-1': 'Ausgewogen',
  '1-3-2-1': 'Defensiver',
  '1-3-3': 'Offensiver',
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

/** Live Hub: große Touch-Ziele, kein Mini-Tab-Gefühl. */
const hubNavSpectator = 'mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5';
const hubNavTrainer = 'mt-1.5 grid w-full grid-cols-2 gap-1.5 sm:gap-2';
const hubNavBtn =
  'flex min-h-[46px] w-full touch-manipulation items-center justify-center rounded-2xl border border-white/12 bg-white/[0.07] px-3 py-2.5 text-[14px] font-extrabold tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_22px_rgba(0,0,0,0.38)] backdrop-blur-md transition active:scale-[0.98] sm:min-h-[48px] sm:text-[15px]';
const liveModuleBackBar =
  'sticky top-0 z-40 mt-0 flex min-h-[48px] shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-black/85 px-2 py-2 backdrop-blur-md sm:px-3';

const liveCardShell =
  'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-black shadow-[0_6px_28px_rgba(0,0,0,0.35)]';

const mbBtnH = 'h-10 min-h-10';
const mbRound = 'rounded-xl';
const mbRowBtn = `flex ${mbBtnH} touch-manipulation items-center justify-center gap-1.5 ${mbRound} px-3 text-xs font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40`;

/** BottomNav (~76px) + Safe Area — Live-Sheets/Confirm über Nav & Safari-Bar */
const LIVE_SHEET_BOTTOM_CLEARANCE = 'calc(4.75rem + env(safe-area-inset-bottom, 0px))';
const LIVE_SHEET_FOOTER_SAFE_PB = 'max(0.75rem, env(safe-area-inset-bottom, 0px))';
/** Sheet-CTA: BottomNav + Safari Home-Indicator */
const LIVE_SHEET_FOOTER_CONFIRM_SAFE_PB = 'calc(120px + env(safe-area-inset-bottom, 0px))';
const LIVE_SHEET_MAX_HEIGHT = 'min(80dvh, 40rem)';
const LIVE_SCROLL_BOTTOM_PAD = 'calc(140px + env(safe-area-inset-bottom, 0px))';
/** FairPlay-Sheets über BottomNav (~96px + Safe Area) */
const FAIRPLAY_SHEET_BOTTOM_OFFSET = 'calc(96px + env(safe-area-inset-bottom, 0px))';
const FAIRPLAY_SHEET_MAX_HEIGHT = 'min(70dvh, 34rem)';
const FAIRPLAY_SHEET_LIST_BOTTOM_PAD = 'calc(120px + env(safe-area-inset-bottom, 0px))';
const LIVE_HUB_SCROLL_BOTTOM_PAD = 'calc(170px + env(safe-area-inset-bottom, 0px))';
const FAIRPLAY_SHEET_OVERLAY =
  'fixed inset-0 z-[10000] flex flex-col justify-end bg-black/80 backdrop-blur-sm';
/** Wechsel-Sheet: unter App-Header (~96px) + über BottomNav (~78px) */
const WECHSEL_SHEET_TOP_OFFSET = 'calc(96px + env(safe-area-inset-top, 0px))';
const WECHSEL_SHEET_BOTTOM_OFFSET = 'calc(78px + env(safe-area-inset-bottom, 0px))';
/** Wechsel: eigener Screen unter App-Header, über Hub (opaque, kein Hub-Scroll) */
const WECHSEL_SCREEN_SHELL =
  'fixed inset-x-0 z-[40] flex flex-col overflow-hidden border-t border-red-500/30 bg-black text-white';
/** Footer im Screen — BottomNav-Abstand kommt vom Screen-bottom (78px) */
const WECHSEL_SCREEN_FOOTER_PB = 'max(0.5rem, env(safe-area-inset-bottom, 0px))';
/** iOS: kein Kopieren/Lookup auf Ergebnis & Uhr */
const SCOREBOARD_NO_SELECT =
  'select-none touch-manipulation [-webkit-touch-callout:none] [-webkit-user-select:none] [user-select:none]';
export const LIVE_NAV_RESET_EVENT = 'spielzeit:live-nav-reset';

function eventIcon(t: MatchEventType): string {
  if (t === 'goal' || t === 'goal_away') return '⚽';
  if (t === 'sub_out' || t === 'sub_in' || t === 'substitution') return '⇄';
  if (t === 'position_swap') return '↔';
  if (t === 'extra_player_on') return '🟡';
  if (t === 'extra_player_off') return '🔴';
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

type EventsFilter = 'all' | 'goals' | 'subs' | 'cards';

/**
 * Wechsel in chronologischer Reihenfolge: atomare `substitution`-Events einzeln;
 * Legacy sub_out/sub_in per FIFO paaren (auch wenn dazwischen Tore o. Ä. liegen).
 */
function pairSubstitutionEventsInOrder(asc: MatchEngineEvent[]): { key: string; items: MatchEngineEvent[] }[] {
  const rows: { key: string; items: MatchEngineEvent[] }[] = [];
  const pendingOut: MatchEngineEvent[] = [];

  for (const e of asc) {
    if (e.type === 'substitution') {
      rows.push({ key: e.id, items: [e] });
      continue;
    }
    if (e.type === 'sub_out') {
      pendingOut.push(e);
      continue;
    }
    if (e.type === 'sub_in') {
      const out = pendingOut.shift();
      if (out) rows.push({ key: `subpair_${out.id}_${e.id}`, items: [out, e] });
      else rows.push({ key: e.id, items: [e] });
      continue;
    }
    rows.push({ key: e.id, items: [e] });
  }
  for (const out of pendingOut) {
    rows.push({ key: out.id, items: [out] });
  }
  return rows;
}

function substitutionOutInIds(ev: MatchEngineEvent): { outId: string; inId: string } {
  if (ev.type === 'substitution') {
    return {
      outId: String(ev.playerId ?? '').trim(),
      inId: String(ev.swapWithPlayerId ?? '').trim(),
    };
  }
  return { outId: '', inId: '' };
}

function isSubstitutionTickerPair(row: { items: MatchEngineEvent[] }): boolean {
  if (row.items.length === 1 && row.items[0]?.type === 'substitution') return true;
  return (
    row.items.length === 2 &&
    row.items[0].type === 'sub_out' &&
    row.items[1]?.type === 'sub_in'
  );
}

function formatSubstitutionTickerLine(
  rosterById: Map<string, RosterPlayer>,
  outPlayerId: string,
  inPlayerId: string,
): string {
  const outName = mobileLineupName((rosterById.get(outPlayerId)?.name ?? '').trim() || '—');
  const inName = mobileLineupName((rosterById.get(inPlayerId)?.name ?? '').trim() || '—');
  return `Raus ${outName} → Rein ${inName}`;
}

/**
 * Trainer-Liveticker: neueste zuerst, Wechsel-Paare nicht trennen.
 * Filter „Tore“: nur Tor-Events; „Wechsel“: nur Sub-Events mit Paar-Logik; „Alle“: alle Events mit Paar-Logik.
 */
function buildLiveTickerRows(events: MatchEngineEvent[], filter: EventsFilter): { key: string; items: MatchEngineEvent[] }[] {
  if (filter === 'cards') {
    return [];
  }
  if (filter === 'goals') {
    const goals = events.filter((e) => e.type === 'goal' || e.type === 'goal_away');
    const desc = [...goals].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
    return desc.map((e) => ({ key: e.id, items: [e] }));
  }
  if (filter === 'subs') {
    const subs = events.filter(
      (e) => e.type === 'sub_out' || e.type === 'sub_in' || e.type === 'substitution',
    );
    const paired = pairSubstitutionEventsInOrder(sortMatchEventsChronologically(subs));
    return paired.slice().reverse();
  }
  const paired = pairSubstitutionEventsInOrder(sortMatchEventsChronologically(events));
  return paired.slice().reverse();
}

type TickerSegmentRow = { key: string; items: MatchEngineEvent[] };

/** Sortierung innerhalb gleicher Anzeige-Minute: Tore → Karten → Wechsel → Positionswechsel → übrig. */
function tickerSegmentSortRank(items: MatchEngineEvent[]): number {
  if (isSubstitutionTickerPair({ items })) return 3;
  const t = items[0]?.type;
  if (t === 'goal' || t === 'goal_away') return 0;
  if (t === 'yellow_card' || t === 'red_card' || t === 'second_yellow') return 1;
  if (t === 'sub_out' || t === 'sub_in' || t === 'substitution') return 3;
  if (t === 'position_swap') return 4;
  if (t === 'extra_player_on' || t === 'extra_player_off') return 4.5;
  return 10;
}

/** Nur Anzeige: benachbarte Zeilen gleicher `formatMinute`-Minute zu einem Block zusammenfassen. */
function groupTickerRowsByDisplayMinute(rows: TickerSegmentRow[]): {
  groupKey: string;
  minuteLabel: string;
  segments: TickerSegmentRow[];
}[] {
  const groups: { groupKey: string; minuteLabel: string; segments: TickerSegmentRow[] }[] = [];
  for (const row of rows) {
    const ts = row.items[0]?.timestamp ?? 0;
    const label = formatMinute(ts);
    const last = groups[groups.length - 1];
    if (last && last.minuteLabel === label) {
      last.segments.push(row);
      last.groupKey = `${last.groupKey}__${row.key}`;
    } else {
      groups.push({ groupKey: row.key, minuteLabel: label, segments: [row] });
    }
  }
  for (const g of groups) {
    const withIdx = g.segments.map((s, i) => ({ s, i }));
    withIdx.sort((a, b) => {
      const ra = tickerSegmentSortRank(a.s.items);
      const rb = tickerSegmentSortRank(b.s.items);
      if (ra !== rb) return ra - rb;
      return a.i - b.i;
    });
    g.segments = withIdx.map((x) => x.s);
  }
  return groups;
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
  /** Kickoff-Feld aus `match_lineup_snapshots` — einzige Basis für Live-Wechsel-Replay (nicht mutierendes DB-Lineup). */
  const [kickoffStartingPlayerIds, setKickoffStartingPlayerIds] = useState<string[]>([]);
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

      const [mRes, lineRes, evRes, isHomeRes, kickoffIds] = await Promise.all([
        fetchMatchById(resolvedId),
        fetchLineupForLiveMatch(resolvedId),
        fetchMatchEvents(resolvedId),
        fetchEventIsHomeByMatchId(resolvedId),
        fetchKickoffLineupPlayerIds(resolvedId),
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
      const lineData = lineRes.error ? { startingPlayerIds: [], squadPlayerIds: [] } : lineRes.data;
      setLineupData(lineData);
      const sorted = sortMatchEventsChronologically(evRes.data);
      setEvents([...sorted].reverse());
      const kickFromSnap =
        kickoffIds != null && kickoffIds.some((id) => String(id ?? '').trim().length > 0)
          ? kickoffIds.slice(0, 7)
          : null;
      const kickFinal = kickFromSnap ?? [...lineData.startingPlayerIds].slice(0, 7);
      setKickoffStartingPlayerIds(kickFinal);
      if (!kickFromSnap && mRes.data?.status === 'live' && import.meta.env.DEV) {
        console.warn(
          '[LiveMatch] Kein Kickoff-Snapshot (match_lineup_snapshots); Replay-Basis = aktuelles match_lineup.',
        );
      }
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

  /** Replay-Basis: immer Kickoff-Snapshot wenn vorhanden (auch nach Matchende — sonst Doppel-Replay). */
  const liveLineupBasePlayerIds = useMemo(() => {
    const hasKickoffPlayer = kickoffStartingPlayerIds.some((id) => String(id ?? '').trim().length > 0);
    if (hasKickoffPlayer) return kickoffStartingPlayerIds.slice(0, 7);
    return startingPlayerIds.slice(0, 7);
  }, [kickoffStartingPlayerIds, startingPlayerIds]);

  const { currentMatchSeconds, half } = useMatchTimer({
    elapsedSeconds: matchRow?.live_elapsed_seconds ?? 0,
    isRunning: matchRow?.live_is_running ?? false,
    hasEnded: matchRow?.status === 'finished',
    startedAtISO: matchRow?.live_is_running ? matchRow?.live_started_at ?? null : null,
    clockEvents: events,
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
  /** Tore nur bei laufender Uhr (DB: `live_is_running` + Status live). */
  const isClockRunning = isRunning;
  const goalBlockedMessage = useMemo(() => {
    if (matchIsFinished) return 'Spiel beendet – keine weiteren Tore möglich.';
    if (matchClockStatus === 'not_started') return 'Spiel noch nicht gestartet – Tore erst nach Anpfiff möglich.';
    return 'Spiel ist pausiert – Tore erst nach Weiter möglich.';
  }, [matchIsFinished, matchClockStatus]);

  useEffect(() => {
    if (!matchRow) return;
    const o = matchRow.opponent?.trim();
    setOpponentLabel(o || 'Gegner');
    setScoreHome(Number(matchRow.score_home ?? 0));
    setScoreAway(Number(matchRow.score_away ?? 0));
  }, [matchRow]);

  const prevEffectiveMatchIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevEffectiveMatchIdRef.current;
    prevEffectiveMatchIdRef.current = effectiveMatchId;
    if (!effectiveMatchId) {
      setInitialStartingPlayerIds([]);
      setKickoffStartingPlayerIds([]);
      return;
    }
    if (prev != null && prev !== effectiveMatchId) {
      setInitialStartingPlayerIds([]);
      setKickoffStartingPlayerIds([]);
    }
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

  /** Trainer: beschädigte DB-Zeilen für Lineup/Bank einmal bereinigen (nur bei Abweichung). */
  useEffect(() => {
    if (!effectiveMatchId || !canControlLiveMatch || matchIsFinished) return;
    if (matchRow?.status !== 'live') return;
    let cancelled = false;
    (async () => {
      try {
        const { repaired, error } = await repairLiveMatchLineupBenchIfNeeded(effectiveMatchId);
        if (error) setSaveError(error);
        if (!repaired || cancelled) return;
        const lineRes = await fetchLineupForLiveMatch(effectiveMatchId);
        if (cancelled || lineRes.error) return;
        setLineupData(lineRes.data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveMatchId, canControlLiveMatch, matchIsFinished, matchRow?.status]);

  const reloadMatchSetupFromDb = useCallback(async () => {
    if (!effectiveMatchId) return;
    if (lineupReloadInFlightRef.current) {
      lineupReloadPendingRef.current = true;
      return;
    }
    lineupReloadInFlightRef.current = true;
    try {
      if (
        canControlLiveMatch &&
        (matchRow?.status === 'live' || matchRow?.status === 'finished')
      ) {
        const { repaired, error } = await repairLiveMatchLineupBenchIfNeeded(effectiveMatchId);
        if (error) setSaveError(error);
        if (import.meta.env.DEV && repaired) {
          console.debug('[LiveMatch] lineup/bench repaired from DB');
        }
      }
      const lineRes = await fetchLineupForLiveMatch(effectiveMatchId);
      setLineupData(lineRes.error ? { startingPlayerIds: [], squadPlayerIds: [] } : lineRes.data);
      if (lineRes.error) setSaveError(lineRes.error);
    } finally {
      lineupReloadInFlightRef.current = false;
    }
    if (lineupReloadPendingRef.current) {
      lineupReloadPendingRef.current = false;
      void reloadMatchSetupFromDb();
    }
  }, [effectiveMatchId, canControlLiveMatch, matchRow?.status]);

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
  const opponentDisplayName = cleanTeamDisplayName(headerOpponent);
  /** Ohne API-Erweiterung: neutraler Anzeige-Spieltyp (Zielbild). */
  const matchTypeDisplay = 'Freundschaftsspiel';
  const [mainTab, setMainTab] = useState<'hub' | 'overview' | 'lineup' | 'events' | 'time'>('hub');
  const [eventsFilter, setEventsFilter] = useState<EventsFilter>('all');
  useEffect(() => {
    if (!canControlLiveMatch && mainTab === 'time') {
      setMainTab('hub');
    }
  }, [canControlLiveMatch, mainTab]);

  const [wechselSheetOpen, setWechselSheetOpen] = useState(false);
  const [subSheetView, setSubSheetView] = useState<'list' | 'pitch'>('list');
  const [subOutPlayerId, setSubOutPlayerId] = useState<string | null>(null);
  const [subInPlayerId, setSubInPlayerId] = useState<string | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const [subSuggestionsExpanded, setSubSuggestionsExpanded] = useState(false);
  const [subRecommendedOutId, setSubRecommendedOutId] = useState<string | null>(null);
  const [subRecommendedInId, setSubRecommendedInId] = useState<string | null>(null);
  /** Aufstellung-Tab: Positionswechsel direkt auf dem Spielfeld (nur Feldspieler). */
  const [lineupPositionMode, setLineupPositionMode] = useState(false);
  const [kickoffAccordionOpen, setKickoffAccordionOpen] = useState(false);
  const [posSwapSlotA, setPosSwapSlotA] = useState<FieldSlotId | null>(null);
  const [posSwapSlotB, setPosSwapSlotB] = useState<FieldSlotId | null>(null);
  const [posSwapConfirmOpen, setPosSwapConfirmOpen] = useState(false);
  const [posSwapSaving, setPosSwapSaving] = useState(false);
  const [fairPlayExtraSheetOpen, setFairPlayExtraSheetOpen] = useState(false);
  const [fairPlayExtraPickId, setFairPlayExtraPickId] = useState<string | null>(null);
  const [fairPlayExtraSaving, setFairPlayExtraSaving] = useState(false);
  const [fairPlayRemoveSheetOpen, setFairPlayRemoveSheetOpen] = useState(false);
  const [fairPlayRemovePickId, setFairPlayRemovePickId] = useState<string | null>(null);
  const [fairPlayRemoveSaving, setFairPlayRemoveSaving] = useState(false);
  const closeWechselSheet = useCallback(() => {
    setWechselSheetOpen(false);
    setSubSheetView('list');
    setSubOutPlayerId(null);
    setSubInPlayerId(null);
    setSubSaving(false);
    setSubRecommendedOutId(null);
    setSubRecommendedInId(null);
    setLineupPositionMode(false);
    setPosSwapSlotA(null);
    setPosSwapSlotB(null);
    setPosSwapConfirmOpen(false);
    setPosSwapSaving(false);
  }, []);
  const openWechselSheet = useCallback(() => {
    setSubOutPlayerId(null);
    setSubInPlayerId(null);
    setSubSaving(false);
    setSubSheetView('list');
    setSubRecommendedOutId(null);
    setSubRecommendedInId(null);
    setLineupPositionMode(false);
    setPosSwapSlotA(null);
    setPosSwapSlotB(null);
    setPosSwapConfirmOpen(false);
    setPosSwapSaving(false);
    setWechselSheetOpen(true);
  }, []);
  /** Wechsel-Sheet mit Vorauswahl — Bestätigung bleibt „Wechsel bestätigen“. */
  const openWechselSheetWithPreset = useCallback((outgoingPlayerId: string, incomingPlayerId: string) => {
    const outId = String(outgoingPlayerId ?? '').trim();
    const inId = String(incomingPlayerId ?? '').trim();
    if (!outId || !inId || outId === inId) return;
    setMainTab('hub');
    setSubOutPlayerId(outId);
    setSubInPlayerId(inId);
    setSubSaving(false);
    setSubSheetView('pitch');
    setSubRecommendedOutId(outId);
    setSubRecommendedInId(inId);
    setLineupPositionMode(false);
    setWechselSheetOpen(true);
  }, []);
  useEffect(() => {
    if (wechselSheetOpen && mainTab !== 'overview' && mainTab !== 'hub') closeWechselSheet();
  }, [wechselSheetOpen, mainTab, closeWechselSheet]);

  const [formationSheetOpen, setFormationSheetOpen] = useState(false);
  const [formationSaving, setFormationSaving] = useState(false);
  const [formationPendingId, setFormationPendingId] = useState<U11FormationId | null>(null);
  const closeFormationSheet = useCallback(() => {
    setFormationSheetOpen(false);
    setFormationSaving(false);
    setFormationPendingId(null);
    setLineupPositionMode(false);
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
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [pauseConfirmSaving, setPauseConfirmSaving] = useState(false);
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
  const liveScrollRef = useRef<HTMLDivElement>(null);
  const liveHubScrollRef = useRef<HTMLElement>(null);

  const releaseLiveBodyScrollLock = useCallback(() => {
    document.body.style.overflow = '';
  }, []);

  const stabilizeLiveHubAfterFairPlay = useCallback(() => {
    releaseLiveBodyScrollLock();
    window.setTimeout(() => {
      liveHubScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      liveScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }, [releaseLiveBodyScrollLock]);
  const substitutionToastTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const subSaveInFlightRef = useRef(false);
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

  const safeSlotOrder = Array.isArray(LIVE_FIELD_SLOT_ORDER) ? LIVE_FIELD_SLOT_ORDER : [];
  const eventsSortedAsc = useMemo(() => sortMatchEventsChronologically(events), [events]);

  const playtimeFinalSecond = useMemo(
    () =>
      resolvePlaytimeFinalMatchSecond({
        events: eventsSortedAsc,
        currentMatchSeconds,
        liveElapsedSeconds: matchRow?.live_elapsed_seconds,
        isFinished: matchIsFinished,
      }),
    [eventsSortedAsc, matchRow?.live_elapsed_seconds, currentMatchSeconds, matchIsFinished],
  );

  const prevPlaytimesRef = useRef<PlayerPlaytimeMap>({});

  const liveReplayState = useMemo(() => {
    const state = deriveLiveMatchReplayState({
      kickoffLineup: liveLineupBasePlayerIds,
      kickoffLineupForPlaytime: kickoffStartingPlayerIds.slice(0, 7),
      squadPlayerIds,
      events: eventsSortedAsc,
      finalSecond: playtimeFinalSecond,
      fallbackStartingPlayerIds: startingPlayerIds.slice(0, 7),
      previousPlaytimesByPlayerId: prevPlaytimesRef.current,
      isLiveMatchRunning: matchRow?.status === 'live' && isRunning && !matchIsFinished,
    });
    prevPlaytimesRef.current = state.playtimeSecondsByPlayerId;
    if (import.meta.env.DEV && matchRow?.status === 'live') {
      const n = countOccupiedFieldSlots(state.slotsBySlot);
      if (n < 7 && !state.fairPlayExtraPlayerId) {
        console.warn('[LiveMatch] Replay: weniger als 7 Feldspieler in Slots', {
          slotCount: n,
          warnings: state.diagnostics.warnings,
        });
      }
    }
    return state;
  }, [
    liveLineupBasePlayerIds,
    kickoffStartingPlayerIds,
    squadPlayerIds,
    eventsSortedAsc,
    playtimeFinalSecond,
    startingPlayerIds,
    matchRow?.status,
    isRunning,
    matchIsFinished,
  ]);

  const lineupSlotsForDisplay = liveReplayState.slotsBySlot;
  const onFieldIds = liveReplayState.onFieldPlayerIds;
  const activePlayerIds = liveReplayState.activePlayerIds;
  const fairPlayExtraPlayerId = liveReplayState.fairPlayExtraPlayerId;
  const playtimes = liveReplayState.playtimeSecondsByPlayerId;
  const fairPlayGoalDiffOwnMinusOpp = useMemo(() => {
    const own = sides.isOwnTeamHome ? displayScoreHome : displayScoreAway;
    const opp = sides.isOwnTeamHome ? displayScoreAway : displayScoreHome;
    return own - opp;
  }, [sides.isOwnTeamHome, displayScoreHome, displayScoreAway]);
  const fairPlayRuleActivatable = fairPlayGoalDiffOwnMinusOpp <= -4;
  const fairPlayMustRemoveExtra = Boolean(fairPlayExtraPlayerId) && fairPlayGoalDiffOwnMinusOpp > -4;
  const fairPlayExtraDisplayName = useMemo(() => {
    const id = fairPlayExtraPlayerId?.trim();
    if (!id) return '';
    const raw = rosterById.get(id)?.name?.trim();
    return raw && raw.length > 0 ? raw : 'Spieler';
  }, [fairPlayExtraPlayerId, rosterById]);

  const fieldPlayers = useMemo(() => {
    const set = new Set(onFieldIds);
    return sortRosterByNumber(roster.filter((p) => set.has(p.id)));
  }, [onFieldIds, roster]);

  const benchPlayers = useMemo(() => {
    const list = liveReplayState.benchPlayerIds.map(
      (id) => rosterById.get(id) ?? { id, name: '—', number: 0 },
    );
    return sortRosterByNumber(list);
  }, [liveReplayState.benchPlayerIds, rosterById]);

  const fairPlayRemoveFieldRows = useMemo(() => {
    const ids = [...new Set(activePlayerIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
    const list = ids.map((id) => rosterById.get(id)).filter((p): p is RosterPlayer => Boolean(p));
    return sortRosterByNumber(list);
  }, [activePlayerIds, rosterById]);
  const homeScorerCandidates = useMemo(() => sortRosterByNumber(fieldPlayers), [fieldPlayers]);

  /** Single Source of Truth: `matches.u11_formation_id` (Realtime), kein localStorage. */
  const safeFormationId = useMemo((): U11FormationId => {
    const raw = matchRow?.u11_formation_id;
    return isU11FormationId(raw) ? raw : U11_FORMATION_DB_FALLBACK;
  }, [matchRow]);

  const requestFormationChange = useCallback(
    (id: U11FormationId) => {
      if (!effectiveMatchId || !canControlLiveMatch || formationSaving) return;
      if (id === safeFormationId) {
        closeFormationSheet();
        return;
      }
      setFormationPendingId(id);
    },
    [effectiveMatchId, canControlLiveMatch, formationSaving, safeFormationId, closeFormationSheet],
  );

  const confirmFormationChange = useCallback(async () => {
    const id = formationPendingId;
    if (!id || !effectiveMatchId || !canControlLiveMatch || formationSaving) return;
    setFormationSaving(true);
    setSaveError(null);
    try {
      const ordered = fieldSlotMapToStartingIds(liveReplayState.slotsBySlot);
      const active = ordered.filter((x) => String(x ?? '').trim().length > 0);
      if (import.meta.env.DEV && active.length < 7) {
        console.warn('[LiveMatch] Live formation remap lost active player', {
          activeCount: active.length,
          ordered,
        });
      }
      const { error: rowErr } = await updateMatchRow(effectiveMatchId, { u11_formation_id: id });
      if (rowErr) {
        setSaveError(rowErr);
        return;
      }
      const { error: lineErr } = await replaceMatchLineupAndBench(effectiveMatchId, ordered, squadPlayerIds);
      if (lineErr) {
        setSaveError(lineErr);
        return;
      }
      setStartingPlayerIds(ordered);
      setFormationPendingId(null);
      closeFormationSheet();
      setFormationChangeToast(true);
      void queueRealtimeReload();
    } finally {
      setFormationSaving(false);
    }
  }, [
    formationPendingId,
    effectiveMatchId,
    canControlLiveMatch,
    formationSaving,
    liveReplayState.slotsBySlot,
    squadPlayerIds,
    closeFormationSheet,
    queueRealtimeReload,
  ]);

  const safeLineupRows = useMemo(
    () =>
      safeSlotOrder.map((slot) => {
        const playerId = lineupSlotsForDisplay?.[slot] ?? null;
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
    [safeSlotOrder, lineupSlotsForDisplay, rosterById, safeFormationId],
  );

  /** Readonly: Kickoff-Startelf (Snapshot), unabhängig von Live-Wechseln. */
  const kickoffSafeLineupRows = useMemo(
    () =>
      safeSlotOrder.map((slot, i) => {
        const raw = kickoffStartingPlayerIds[i];
        const playerId = raw && String(raw).trim().length > 0 ? String(raw).trim() : null;
        const player = playerId ? rosterById.get(playerId) ?? null : null;
        return {
          id: player?.id ?? `kickoff-${slot}`,
          slot,
          rightLabel: getPositionLabel(labelForSlotInFormation(safeFormationId, slot)) || '–',
          display_name: player?.name ?? '—',
          position: player?.position ?? null,
          jersey_number: player?.number ?? null,
          avatar_url: player?.avatarUrl ?? null,
        };
      }),
    [safeSlotOrder, kickoffStartingPlayerIds, rosterById, safeFormationId],
  );
  const kickoffSafeLineupRowsCount = Array.isArray(kickoffSafeLineupRows)
    ? kickoffSafeLineupRows.filter((row) => {
        const n = String(row.display_name ?? '').trim();
        return n.length > 0 && n !== '—';
      }).length
    : 0;

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
      const pid = lineupSlotsForDisplay?.[slot];
      return typeof pid === 'string' && pid.length > 0;
    });
  }, [safeLineupRows, lineupSlotsForDisplay]);

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
                  sl && lineupSlotsForDisplay && typeof lineupSlotsForDisplay === 'object'
                    ? String(lineupSlotsForDisplay[sl] ?? '').trim()
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
  }, [subOutPlayerId, subInPlayerId, rosterById, substitutionFieldRows, substitutionBenchRows, lineupSlotsForDisplay]);

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

  const lineupPosSwapRingHighlight = useMemo((): Partial<Record<FieldSlotId, 'in' | 'out'>> => {
    if (!lineupPositionMode || !posSwapSlotA) return {};
    const h: Partial<Record<FieldSlotId, 'in' | 'out'>> = { [posSwapSlotA]: 'out' };
    if (posSwapSlotB) h[posSwapSlotB] = 'out';
    return h;
  }, [lineupPositionMode, posSwapSlotA, posSwapSlotB]);

  const wechselPitchSlotHighlight = subPitchSlotHighlight;

  const posSwapConfirmLabels = useMemo(() => {
    if (!posSwapSlotA || !posSwapSlotB) return { a: '', b: '' };
    const slots = lineupSlotsForDisplay as Record<FieldSlotId, string | null>;
    const ida = String(slots[posSwapSlotA] ?? '').trim();
    const idb = String(slots[posSwapSlotB] ?? '').trim();
    const na = mobileLineupName((rosterById.get(ida)?.name ?? '—').trim() || '—');
    const nb = mobileLineupName((rosterById.get(idb)?.name ?? '—').trim() || '—');
    return { a: na, b: nb };
  }, [posSwapSlotA, posSwapSlotB, lineupSlotsForDisplay, rosterById]);

  const [substitutionTransitionBySlot, setSubstitutionTransitionBySlot] = useState<
    Partial<Record<FieldSlotId, { outgoingPlayerId: string | null; incomingPlayerId: string | null }>>
  >({});
  const [slotHighlightBySlot, setSlotHighlightBySlot] = useState<Partial<Record<FieldSlotId, 'in' | 'out'>>>({});
  const mainLineupPitchSlotHighlight = useMemo(() => {
    const merged: Partial<Record<FieldSlotId, 'in' | 'out'>> = { ...slotHighlightBySlot };
    for (const k of Object.keys(lineupPosSwapRingHighlight) as FieldSlotId[]) {
      const v = lineupPosSwapRingHighlight[k];
      if (v) merged[k] = v;
    }
    return merged;
  }, [slotHighlightBySlot, lineupPosSwapRingHighlight]);
  const [substitutionToastText, setSubstitutionToastText] = useState<string | null>(null);
  const canRenderLivePitch = safeSlotOrder.length > 0 && safeFormationId != null;
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
    const isPureFieldSwap =
      changedSlots.length === 2 &&
      (() => {
        const [s1, s2] = changedSlots;
        const a1 = String(prev[s1] ?? '').trim();
        const b1 = String(current[s1] ?? '').trim();
        const a2 = String(prev[s2] ?? '').trim();
        const b2 = String(current[s2] ?? '').trim();
        return Boolean(a1 && b1 && a2 && b2 && a1 === b2 && a2 === b1);
      })();
    if (firstSwapSlot && !isPureFieldSwap) {
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
    } else if (isPureFieldSwap) {
      const [s1, s2] = changedSlots;
      const id1 = String(current[s1] ?? '').trim();
      const id2 = String(current[s2] ?? '').trim();
      const n1 = mobileLineupName((rosterById.get(id1)?.name ?? 'Spieler').trim() || 'Spieler');
      const n2 = mobileLineupName((rosterById.get(id2)?.name ?? 'Spieler').trim() || 'Spieler');
      setSubstitutionToastText(`↔ ${n1} · ${n2}`);
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

  /**
   * Wechsel-Vorschläge: kein TW; bevorzugt gleiche Liniengruppe (DEF/MID/OFF), sonst Fallback.
   * Max. 3 Paare, kein Spieler doppelt.
   */
  const substitutionSuggestions = useMemo(() => {
    if (matchIsFinished || matchRow?.status !== 'live') return [];
    const squadSet = new Set(squadPlayerIds.map((id) => String(id ?? '').trim()).filter(Boolean));
    const slots = lineupSlotsForDisplay as Record<FieldSlotId, string | null>;
    const gkId = String(slots?.GK ?? '').trim();

    const fieldIdsAll = onFieldIds.map((id) => String(id ?? '').trim()).filter((id) => squadSet.has(id));
    const fieldIds = fieldIdsAll.filter((id) => id && id !== gkId);
    const benchIdsRaw = liveReplayState.benchPlayerIds
      .map((id) => String(id ?? '').trim())
      .filter((id) => squadSet.has(id));
    const benchIds = benchIdsRaw.filter((id) => coachLineGroupFromRosterPosition(rosterById.get(id)?.position) !== 'GK');
    if (fieldIds.length === 0 || benchIds.length === 0) return [];

    const pt = (id: string) => Math.max(0, playtimes[id] ?? 0);
    const fieldSorted = [...new Set(fieldIds)].sort((a, b) => pt(b) - pt(a));
    const benchSorted = [...new Set(benchIds)].sort((a, b) => pt(a) - pt(b));

    const used = new Set<string>();
    const pairs: {
      outId: string;
      inId: string;
      outName: string;
      inName: string;
      outSec: number;
      inSec: number;
    }[] = [];

    const tryPair = (oid: string, matcher: (bid: string) => boolean): boolean => {
      if (used.has(oid)) return false;
      const inId = benchSorted.find((bid) => !used.has(bid) && matcher(bid));
      if (!inId) return false;
      used.add(oid);
      used.add(inId);
      pairs.push({
        outId: oid,
        inId,
        outName: (rosterById.get(oid)?.name ?? '?').trim() || '?',
        inName: (rosterById.get(inId)?.name ?? '?').trim() || '?',
        outSec: pt(oid),
        inSec: pt(inId),
      });
      return true;
    };

    for (const oid of fieldSorted) {
      if (pairs.length >= 3) break;
      const slot = slotForFieldPlayer(slots, oid);
      if (!slot || slot === 'GK') continue;
      const gOut = coachLineGroupFromSlot(slot);
      if (gOut === 'GK') continue;
      tryPair(oid, (bid) => coachLineGroupFromRosterPosition(rosterById.get(bid)?.position) === gOut);
    }
    for (const oid of fieldSorted) {
      if (pairs.length >= 3) break;
      const slot = slotForFieldPlayer(slots, oid);
      if (!slot || slot === 'GK') continue;
      tryPair(oid, () => true);
    }
    return pairs;
  }, [
    matchIsFinished,
    matchRow?.status,
    squadPlayerIds,
    onFieldIds,
    lineupSlotsForDisplay,
    playtimes,
    rosterById,
    liveReplayState.benchPlayerIds,
  ]);

  const subSuggestionSig = substitutionSuggestions.map((s) => `${s.outId}:${s.inId}`).join('|');
  useEffect(() => {
    setSubSuggestionsExpanded(false);
  }, [subSuggestionSig]);

  const squadRosterForPlaytimeList = useMemo(() => {
    const ids = collectLiveStatPlayerIds(liveReplayState, squadPlayerIds);
    const list = ids.map((id) => rosterById.get(id) ?? { id, name: '—', number: 0 });
    return [...list].sort((a, b) => {
      const ra = liveStatPlayerSortRank(a.id, liveReplayState);
      const rb = liveStatPlayerSortRank(b.id, liveReplayState);
      if (ra !== rb) return ra - rb;
      const sa = playtimes[a.id] ?? 0;
      const sb = playtimes[b.id] ?? 0;
      if (sa !== sb) return sb - sa;
      return compareRosterPlayers(a, b);
    });
  }, [liveReplayState, squadPlayerIds, playtimes, rosterById]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const ex = fairPlayExtraPlayerId?.trim();
    if (!ex) return;
    const inStats = squadRosterForPlaytimeList.some((p) => p.id === ex);
    if (!inStats) {
      console.warn('[liveReplay] FairPlay-Extra aktiv, fehlt in Statistikrows', { extra: ex });
    }
    if (playtimes[ex] == null) {
      console.warn('[liveReplay] FairPlay-Extra aktiv, playtimeSeconds fehlt', { extra: ex });
    }
    if (liveReplayState.benchPlayerIds.includes(ex)) {
      console.warn('[liveReplay] FairPlay-Extra aktiv, aber in benchPlayerIds', { extra: ex });
    }
  }, [
    fairPlayExtraPlayerId,
    squadRosterForPlaytimeList,
    playtimes,
    liveReplayState.benchPlayerIds,
  ]);

  const liveSubEventsDebugKey = useMemo(() => {
    const sig = sortMatchEventsChronologically(events)
      .filter((e) => e.type === 'sub_out' || e.type === 'sub_in' || e.type === 'substitution')
      .map((e) => `${e.id}:${e.type}:${e.timestamp}:${e.createdAt ?? ''}`)
      .join('|');
    return `${sig}::${liveLineupBasePlayerIds.join(',')}`;
  }, [events, liveLineupBasePlayerIds]);

  const liveDbgMatchSecRef = useRef(currentMatchSeconds);
  liveDbgMatchSecRef.current = currentMatchSeconds;

  useEffect(() => {
    if (!import.meta.env.DEV || matchRow?.status !== 'live') return;
    if (!liveLineupBasePlayerIds.some((id) => String(id ?? '').trim())) return;
    const tDbg = liveDbgMatchSecRef.current;
    const subs = sortMatchEventsChronologically(events).filter(
      (e) => e.timestamp <= tDbg && (e.type === 'sub_out' || e.type === 'sub_in'),
    );
    if (subs.length === 0) return;
    console.table(
      subs.map((e) => ({
        minute: e.timestamp,
        type: e.type,
        player_id: e.playerId ?? '',
        playerName: (e.playerId && rosterById.get(e.playerId)?.name) || '',
        created_at: e.createdAt ?? '',
      })),
    );
    const replay = replaySubstitutionEventsOnSlots(liveLineupBasePlayerIds, events, tDbg, {
      squadPlayerIds,
      collectSteps: true,
    });
    if (replay.steps?.length) {
      console.table(
        replay.steps.map((s) => ({
          step: s.step,
          kind: s.kind,
          out: s.outPlayerId ?? '',
          in: s.inPlayerId ?? '',
          duplicatesField: s.duplicatesField.join(','),
          duplicatesBench: s.duplicatesBench.join(','),
          playersInBoth: s.playersInBoth.join(','),
        })),
      );
    }
  }, [liveSubEventsDebugKey, events, liveLineupBasePlayerIds, matchRow?.status, rosterById, squadPlayerIds]);
  const periodScores = useMemo(() => parsePeriodScores(matchRow?.period_scores), [matchRow?.period_scores]);

  const persistSingle = useCallback(
    async (partial: Omit<MatchEngineEvent, 'id'>): Promise<{ ok: boolean; savedId?: string }> => {
      if (!effectiveMatchId) return { ok: false };
      if ((partial.type === 'goal' || partial.type === 'goal_away') && (!isClockRunning || matchIsFinished)) {
        setSaveError(goalBlockedMessage);
        return { ok: false };
      }
      setSaveError(null);
      const tempId = newEventId();
      const evForSave: Omit<MatchEngineEvent, 'id'> =
        partial.type === 'goal' || partial.type === 'goal_away'
          ? { ...partial, timestamp: clampEffectiveMatchSeconds(partial.timestamp) }
          : partial;
      const optimistic: MatchEngineEvent = { ...evForSave, id: tempId };
      setEvents((prev) => [optimistic, ...prev]);
      if (partial.type === 'start' || partial.type === 'pause' || partial.type === 'resume' || partial.type === 'end') {
        return { ok: true };
      }
      const payload = engineEventToInsertPayload(effectiveMatchId, evForSave, half);
      const { id, error } = await saveMatchEvent(payload);
      if (error || !id) {
        console.error('[LiveMatch] saveMatchEvent', error);
        setSaveError(error ?? 'Ereignis konnte nicht gespeichert werden.');
        setEvents((prev) => prev.filter((e) => e.id !== tempId));
        return { ok: false };
      }
      const mid = effectiveMatchId;
      setEvents((prev) => {
        const mapped = prev.map((e) => (e.id === tempId ? { ...evForSave, id } : e));
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
    [effectiveMatchId, half, isClockRunning, matchIsFinished, goalBlockedMessage],
  );

  const closeFairPlayExtraSheet = useCallback(() => {
    setFairPlayExtraSheetOpen(false);
    setFairPlayExtraPickId(null);
    setFairPlayExtraSaving(false);
    releaseLiveBodyScrollLock();
  }, [releaseLiveBodyScrollLock]);

  const openFairPlayExtraSheet = useCallback(() => {
    setFairPlayExtraPickId(null);
    setFairPlayExtraSaving(false);
    setFairPlayExtraSheetOpen(true);
  }, []);

  const closeFairPlayRemoveSheet = useCallback(() => {
    setFairPlayRemoveSheetOpen(false);
    setFairPlayRemovePickId(null);
    setFairPlayRemoveSaving(false);
    releaseLiveBodyScrollLock();
  }, [releaseLiveBodyScrollLock]);

  const openFairPlayRemoveSheet = useCallback(() => {
    setFairPlayRemovePickId(null);
    setFairPlayRemoveSaving(false);
    setFairPlayRemoveSheetOpen(true);
  }, []);

  const runPersistFairPlayExtraOn = useCallback(async () => {
    const pid = String(fairPlayExtraPickId ?? '').trim();
    const mid = effectiveMatchId?.trim();
    if (!mid || !pid || fairPlayExtraSaving) return;
    setFairPlayExtraSaving(true);
    setSaveError(null);
    const tempId = newEventId();
    const ts = clampEffectiveMatchSeconds(currentMatchSeconds);
    const optimistic: MatchEngineEvent = { id: tempId, type: 'extra_player_on', timestamp: ts, playerId: pid };
    setEvents((prev) => [optimistic, ...prev]);
    const { eventId, error } = await persistExtraPlayerOn({
      matchId: mid,
      playerId: pid,
      currentMatchSeconds: ts,
      period: half,
    });
    if (error || !eventId) {
      setEvents((prev) => prev.filter((e) => e.id !== tempId));
      setSaveError(error ?? 'FairPlay konnte nicht gespeichert werden.');
      setFairPlayExtraSaving(false);
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...optimistic, id: eventId } : e)));
    closeFairPlayExtraSheet();
    setFairPlayExtraSaving(false);
    setMainTab('hub');
    stabilizeLiveHubAfterFairPlay();
    void queueRealtimeReload();
  }, [
    fairPlayExtraPickId,
    effectiveMatchId,
    fairPlayExtraSaving,
    currentMatchSeconds,
    half,
    closeFairPlayExtraSheet,
    stabilizeLiveHubAfterFairPlay,
    queueRealtimeReload,
  ]);

  const runPersistFairPlayExtraOff = useCallback(async () => {
    const extraId = String(fairPlayExtraPlayerId ?? '').trim();
    const removedId = String(fairPlayRemovePickId ?? '').trim();
    const mid = effectiveMatchId?.trim();
    if (!mid || !extraId || !removedId || fairPlayRemoveSaving) return;
    setFairPlayRemoveSaving(true);
    setSaveError(null);
    const tempId = newEventId();
    const ts = clampEffectiveMatchSeconds(currentMatchSeconds);
    const optimistic: MatchEngineEvent = {
      id: tempId,
      type: 'extra_player_off',
      timestamp: ts,
      playerId: extraId,
      fairPlayRemovedPlayerId: removedId,
    };
    setEvents((prev) => [optimistic, ...prev]);
    const { eventId, error } = await persistExtraPlayerOff({
      matchId: mid,
      extraPlayerId: extraId,
      removedPlayerId: removedId,
      currentMatchSeconds: ts,
      period: half,
      currentStartingPlayerIds: fieldSlotMapToStartingIds(lineupSlotsForDisplay),
      squadPlayerIds,
    });
    if (error || !eventId) {
      setEvents((prev) => prev.filter((e) => e.id !== tempId));
      setSaveError(error ?? 'FairPlay konnte nicht gespeichert werden.');
      setFairPlayRemoveSaving(false);
      return;
    }
    setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...optimistic, id: eventId } : e)));
    closeFairPlayRemoveSheet();
    setFairPlayRemoveSaving(false);
    setMainTab('hub');
    stabilizeLiveHubAfterFairPlay();
    void queueRealtimeReload();
  }, [
    fairPlayExtraPlayerId,
    fairPlayRemovePickId,
    effectiveMatchId,
    fairPlayRemoveSaving,
    currentMatchSeconds,
    half,
    lineupSlotsForDisplay,
    squadPlayerIds,
    closeFairPlayRemoveSheet,
    stabilizeLiveHubAfterFairPlay,
    queueRealtimeReload,
  ]);

  const fairPlaySheetOpen = fairPlayExtraSheetOpen || fairPlayRemoveSheetOpen;
  useEffect(() => {
    if (fairPlaySheetOpen) return;
    releaseLiveBodyScrollLock();
  }, [fairPlaySheetOpen, releaseLiveBodyScrollLock]);

  useEffect(() => {
    if (!wechselSheetOpen) {
      releaseLiveBodyScrollLock();
      document.documentElement.style.overflow = '';
      const t = window.setTimeout(() => {
        liveHubScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        liveScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
      return () => window.clearTimeout(t);
    }
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [wechselSheetOpen, releaseLiveBodyScrollLock]);

  useEffect(() => {
    const onLiveNavReset = () => {
      setMainTab('hub');
      closeWechselSheet();
      closeFormationSheet();
      closeFairPlayExtraSheet();
      closeFairPlayRemoveSheet();
      setFormationPendingId(null);
      setLineupPositionMode(false);
      releaseLiveBodyScrollLock();
      liveHubScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      liveScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener(LIVE_NAV_RESET_EVENT, onLiveNavReset);
    return () => window.removeEventListener(LIVE_NAV_RESET_EVENT, onLiveNavReset);
  }, [
    closeWechselSheet,
    closeFormationSheet,
    closeFairPlayExtraSheet,
    closeFairPlayRemoveSheet,
    releaseLiveBodyScrollLock,
  ]);

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

  const openPauseConfirm = useCallback(() => {
    if (!canControlLiveMatch || !isRunning || matchIsFinished || !effectiveMatchId) return;
    setPauseConfirmOpen(true);
  }, [canControlLiveMatch, isRunning, matchIsFinished, effectiveMatchId]);

  const executeConfirmedPause = useCallback(async () => {
    if (!canControlLiveMatch || !isRunning || matchIsFinished || !effectiveMatchId) return;
    setPauseConfirmSaving(true);
    setSaveError(null);
    try {
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
      if (error) {
        setSaveError(error);
        return;
      }
      setMatchRow((prev) =>
        prev ? { ...prev, live_elapsed_seconds: frozen, live_is_running: false, period_scores: nextPeriodScores } : null,
      );
      setPauseConfirmOpen(false);
    } finally {
      setPauseConfirmSaving(false);
    }
  }, [
    canControlLiveMatch,
    isRunning,
    matchIsFinished,
    effectiveMatchId,
    currentMatchSeconds,
    periodScores,
    events,
    persistSingle,
  ]);

  useEffect(() => {
    if (matchIsFinished) setPauseConfirmOpen(false);
  }, [matchIsFinished]);

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
      const atReplay = resolveReplayAtMatchSecond(events, frozen);
      const syncRes = await syncFinalLineupBenchFromEventReplay({
        matchId: effectiveMatchId,
        kickoffStartingPlayerIds: kickoffStartingPlayerIds.slice(0, 7),
        squadPlayerIds,
        events: sortMatchEventsChronologically(events),
        atMatchSecond: atReplay,
        fallbackStartingPlayerIds: startingPlayerIds.slice(0, 7),
      });
      if (syncRes.error) {
        setSaveError(syncRes.error);
      } else {
        setStartingPlayerIds(syncRes.startingPlayerIds);
        setSquadPlayerIds(syncRes.squadPlayerIds);
        if (lineupData) {
          setLineupData({
            startingPlayerIds: syncRes.startingPlayerIds,
            squadPlayerIds: syncRes.squadPlayerIds,
          });
        }
      }
      console.info('[resultFeed][LiveMatch] persistMatchEndWithoutCalendar OK', {
        matchId: effectiveMatchId,
        status: 'finished',
        score_home: fh,
        score_away: fa,
      });
      void ensureResultFeedPostForMatch(effectiveMatchId).then((res) => {
        console.info('[resultFeed][LiveMatch] ensureResultFeedPostForMatch', {
          matchId: effectiveMatchId,
          ...res,
        });
        if (!res.ok) console.warn('[resultFeed][LiveMatch] ensure failed', res.error);
      });
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
      const outId = String(outgoingPlayerId ?? '').trim();
      const inId = String(incomingPlayerId ?? '').trim();
      if (!outId) {
        if (import.meta.env.DEV) console.warn('[LiveMatch] persistSubstitution: missing playerOutId');
        setSaveError('Bitte zuerst den auswechselnden Spieler wählen.');
        return false;
      }
      if (!inId) {
        if (import.meta.env.DEV) console.warn('[LiveMatch] persistSubstitution: missing playerInId');
        setSaveError('Bitte zuerst den einwechselnden Spieler wählen.');
        return false;
      }
      if (outId === inId) {
        setSaveError('Raus und Rein müssen unterschiedliche Spieler sein.');
        return false;
      }
      if (!canControlLiveMatch || matchIsFinished || !effectiveMatchId) return false;

      const check = handleSubstitution({
        outgoingPlayerId: outId,
        incomingPlayerId: inId,
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
      const tsSub = currentMatchSeconds;
      const replayBefore = deriveLiveMatchReplayState({
        kickoffLineup: liveLineupBasePlayerIds,
        kickoffLineupForPlaytime: kickoffStartingPlayerIds.slice(0, 7),
        squadPlayerIds,
        events,
        finalSecond: tsSub,
        fallbackStartingPlayerIds: startingPlayerIds.slice(0, 7),
      });
      const slotBefore = replayBefore.slotsBySlot;
      const fieldIdsBefore = replayBefore.onFieldPlayerIds;
      const benchIdsBefore = replayBefore.benchPlayerIds;
      const dupIds = (ids: string[]) => {
        const m = new Map<string, number>();
        for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
        return [...m.entries()].filter(([, n]) => n > 1).map(([id]) => id);
      };

      let applied = applySubstitutionToSlots(slotBefore, outId, inId);
      if (!applied.outSlot) {
        applied = applySubstitutionToSlots(
          startingLineupToSlotMap(liveLineupBasePlayerIds.slice(0, 7)),
          outId,
          inId,
        );
      }
      const { slots: nextSlots, outSlot } = applied;
      if (!outSlot) {
        setSaveError('Spielerposition für Wechsel nicht gefunden.');
        return false;
      }

      const nextStarting = fieldSlotMapToStartingIds(nextSlots);
      const nextSquad = [...new Set([...squadPlayerIds, outId, inId])];
      const fieldIdsAfter = LIVE_FIELD_SLOT_ORDER.map((s) => String(nextSlots[s] ?? '').trim()).filter(Boolean);
      const benchIdsAfter = getBenchPlayers(nextSquad, fieldIdsAfter);

      if (import.meta.env.DEV) {
        const onFieldSetBefore = new Set(fieldIdsBefore);
        console.debug('[LiveMatch][sub:before]', {
          outPlayerId: outId,
          inPlayerId: inId,
          outSlot,
          fieldIdsBefore,
          benchIdsBefore,
          duplicatesField: dupIds(fieldIdsBefore),
          duplicatesBench: dupIds(benchIdsBefore),
          playersInBoth: benchIdsBefore.filter((id) => onFieldSetBefore.has(id)),
        });
        const onFieldSetAfter = new Set(fieldIdsAfter);
        console.debug('[LiveMatch][sub:after]', {
          outPlayerId: outId,
          inPlayerId: inId,
          outSlot,
          fieldIdsAfter,
          benchIdsAfter,
          duplicatesField: dupIds(fieldIdsAfter),
          duplicatesBench: dupIds(benchIdsAfter),
          playersInBoth: benchIdsAfter.filter((id) => onFieldSetAfter.has(id)),
        });
      }

      const ts = currentMatchSeconds;
      const subPartial: Omit<MatchEngineEvent, 'id'> = {
        type: 'substitution',
        timestamp: ts,
        playerId: outId,
        swapWithPlayerId: inId,
      };
      const tempId = newEventId();
      const payload = engineEventToInsertPayload(effectiveMatchId, subPartial, half);
      const { id, error } = await saveMatchEvent(payload);
      if (error || !id) {
        console.error('[LiveMatch] saveMatchEvent substitution', error);
        setSaveError(error ?? 'Wechsel konnte nicht gespeichert werden.');
        return false;
      }

      const { error: swapErr } = await replaceMatchLineupAndBench(effectiveMatchId, nextStarting, nextSquad);
      if (swapErr) {
        console.error('[LiveMatch] replaceMatchLineupAndBench after substitution', swapErr);
        setSaveError(swapErr);
        await deleteMatchEventById(id);
        return false;
      }

      setStartingPlayerIds(nextStarting);
      setSquadPlayerIds(nextSquad);
      setEvents((prev) => [{ ...subPartial, id }, ...prev.filter((e) => e.id !== tempId)]);
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
      liveLineupBasePlayerIds,
      kickoffStartingPlayerIds,
      startingPlayerIds,
      squadPlayerIds,
    ],
  );

  const confirmSubstitution = useCallback(async () => {
    const outId = String(subOutPlayerId ?? '').trim();
    const inId = String(subInPlayerId ?? '').trim();
    if (!outId) {
      if (import.meta.env.DEV) console.warn('[LiveMatch] confirmSubstitution: missing playerOutId');
      setSaveError('Bitte zuerst den auswechselnden Spieler wählen.');
      return;
    }
    if (!inId) {
      if (import.meta.env.DEV) console.warn('[LiveMatch] confirmSubstitution: missing playerInId');
      setSaveError('Bitte zuerst den einwechselnden Spieler wählen.');
      return;
    }
    if (outId === inId) return;
    if (subSaveInFlightRef.current) {
      if (import.meta.env.DEV) console.warn('[LiveMatch] confirmSubstitution: duplicate save while saving');
      return;
    }
    subSaveInFlightRef.current = true;
    setSubSaving(true);
    try {
      const ok = await persistSubstitution(outId, inId);
      if (ok) {
        void queueRealtimeReload();
        setSubOutPlayerId(null);
        setSubInPlayerId(null);
        setSubRecommendedOutId(null);
        setSubRecommendedInId(null);
        setSubstitutionToastText('Wechsel gespeichert');
        if (substitutionToastTimerRef.current != null) window.clearTimeout(substitutionToastTimerRef.current);
        substitutionToastTimerRef.current = window.setTimeout(() => {
          setSubstitutionToastText(null);
          substitutionToastTimerRef.current = null;
        }, 2200);
      }
    } catch (e) {
      console.error('[LiveMatch] confirmSubstitution', e);
      setSaveError('Wechsel konnte nicht abgeschlossen werden.');
    } finally {
      subSaveInFlightRef.current = false;
      setSubSaving(false);
    }
  }, [subOutPlayerId, subInPlayerId, persistSubstitution, queueRealtimeReload]);

  useEffect(() => {
    if (subSheetView === 'list') {
      setPosSwapSlotA(null);
      setPosSwapSlotB(null);
      setPosSwapConfirmOpen(false);
    }
  }, [subSheetView]);

  useEffect(() => {
    if (lineupPositionMode) {
      setSubOutPlayerId(null);
      setSubInPlayerId(null);
    } else {
      setPosSwapSlotA(null);
      setPosSwapSlotB(null);
      setPosSwapConfirmOpen(false);
    }
  }, [lineupPositionMode]);

  useEffect(() => {
    if (mainTab !== 'lineup') {
      setLineupPositionMode(false);
    }
  }, [mainTab]);

  const confirmPositionSwap = useCallback(async () => {
    if (!effectiveMatchId || !posSwapSlotA || !posSwapSlotB || posSwapSlotA === posSwapSlotB || matchIsFinished) return;
    setPosSwapSaving(true);
    setSaveError(null);
    try {
      const map = lineupSlotsForDisplay as Record<FieldSlotId, string | null>;
      const { error } = await persistPositionSwap({
        matchId: effectiveMatchId,
        slotA: posSwapSlotA,
        slotB: posSwapSlotB,
        currentSlots: map,
        squadPlayerIds,
        timestamp: currentMatchSeconds,
        period: half,
      });
      if (error) {
        setSaveError(error);
        return;
      }
      setPosSwapConfirmOpen(false);
      setPosSwapSlotA(null);
      setPosSwapSlotB(null);
      setLineupPositionMode(false);
      void queueRealtimeReload();
    } catch (e) {
      console.error('[LiveMatch] confirmPositionSwap', e);
      setSaveError('Positionswechsel fehlgeschlagen.');
    } finally {
      setPosSwapSaving(false);
    }
  }, [
    effectiveMatchId,
    posSwapSlotA,
    posSwapSlotB,
    matchIsFinished,
    lineupSlotsForDisplay,
    squadPlayerIds,
    currentMatchSeconds,
    half,
    queueRealtimeReload,
  ]);

  const handleLineupPositionSlotTap = useCallback(
    (slot: FieldSlotId) => {
      if (!lineupPositionMode || !canControlLiveMatch || matchIsFinished || posSwapSaving) return;
      if (posSwapConfirmOpen) return;
      const slots = safeLineupSlots as Record<FieldSlotId, string | null>;
      const pid = String(slots[slot] ?? '').trim();
      if (!pid) return;
      if (!posSwapSlotA) {
        setPosSwapSlotA(slot);
        return;
      }
      if (posSwapSlotA === slot) {
        setPosSwapSlotA(null);
        setPosSwapSlotB(null);
        setPosSwapConfirmOpen(false);
        return;
      }
      setPosSwapSlotB(slot);
      setPosSwapConfirmOpen(true);
    },
    [
      lineupPositionMode,
      canControlLiveMatch,
      matchIsFinished,
      posSwapSaving,
      posSwapConfirmOpen,
      safeLineupSlots,
      posSwapSlotA,
    ],
  );

  const trainerTickerGroups = useMemo(
    () => groupTickerRowsByDisplayMinute(buildLiveTickerRows(events, eventsFilter)),
    [events, eventsFilter],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    for (const e of events) {
      if (e.type !== 'position_swap') continue;
      const a = String(e.playerId ?? '').trim();
      const b = String(e.swapWithPlayerId ?? '').trim();
      if (!a || !b) {
        console.warn('[LiveTicker] position_swap ohne vollständigen Spielerbezug (payload)', {
          id: e.id,
          playerId: e.playerId,
          swapWithPlayerId: e.swapWithPlayerId,
        });
      }
    }
  }, [events]);

  useEffect(() => {
    if (!import.meta.env.DEV || matchRow?.status !== 'live') return;
    const asc = sortMatchEventsChronologically(events);
    let depth = 0;
    let maxDepth = 0;
    for (const e of asc) {
      if (e.type === 'extra_player_on') depth += 1;
      if (e.type === 'extra_player_off') depth = Math.max(0, depth - 1);
      maxDepth = Math.max(maxDepth, depth);
    }
    if (maxDepth > 1) {
      console.warn('[FairPlay] Mehr als ein Zusatzspieler (überlappende extra_player_on)', { maxDepth });
    }
    const ex = fairPlayExtraPlayerId?.trim();
    if (!ex) return;
    if (onFieldIds.includes(ex)) {
      console.warn('[FairPlay] Zusatzspieler steht in einem normalen Feld-Slot', { playerId: ex });
    }
    if (!rosterById.has(ex)) {
      console.warn('[FairPlay] Zusatzspieler nicht im Kader / kein Feldbezug', { playerId: ex });
    }
    if (fairPlayGoalDiffOwnMinusOpp > -4) {
      console.warn('[FairPlay] Zusatzspieler aktiv obwohl keine FairPlay-Situation (weniger als 4 Tore Rückstand)', {
        playerId: ex,
        eigenMinusGegner: fairPlayGoalDiffOwnMinusOpp,
      });
    }
  }, [matchRow?.status, events, fairPlayExtraPlayerId, onFieldIds, rosterById, fairPlayGoalDiffOwnMinusOpp]);

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

  const positionSwapPrimaryLine = useCallback(
    (ev: MatchEngineEvent): string | null => {
      const a = String(ev.playerId ?? '').trim();
      const b = String(ev.swapWithPlayerId ?? '').trim();
      if (!a || !b) return null;
      const na = mobileLineupName((rosterById.get(a)?.name ?? '').trim() || '—');
      const nb = mobileLineupName((rosterById.get(b)?.name ?? '').trim() || '—');
      if ((!na || na === '—') && (!nb || nb === '—')) return null;
      return `↔ ${na} ⇄ ${nb}`;
    },
    [rosterById],
  );

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
      case 'substitution': {
        const { outId, inId } = substitutionOutInIds(ev);
        return formatSubstitutionTickerLine(rosterById, outId, inId);
      }
      case 'pause':
        return 'Pause';
      case 'resume':
        return 'Weiter';
      case 'end':
        return 'Spielende';
      case 'position_swap':
        return positionSwapPrimaryLine(ev) ?? 'Positionswechsel';
      case 'extra_player_on': {
        const n = name ? `${name} als Zusatzspieler eingesetzt` : 'Zusatzspieler eingesetzt';
        return `🟡 FairPlay: ${n}`;
      }
      case 'extra_player_off': {
        const removedId = fairPlayRemovedPlayerIdFromEvent(ev);
        const removedName = removedId
          ? mobileLineupName(rosterById.get(removedId)?.name ?? 'Spieler')
          : name
            ? mobileLineupName(name)
            : 'Spieler';
        return `🔴 FairPlay: ${removedName} vom Feld genommen`;
      }
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
      case 'substitution': {
        const { outId, inId } = substitutionOutInIds(ev);
        return formatSubstitutionTickerLine(rosterById, outId, inId);
      }
      case 'position_swap':
        return positionSwapPrimaryLine(ev) ?? 'Positionswechsel';
      case 'extra_player_on':
        return name
          ? `🟡 FairPlay: ${name} als Zusatzspieler eingesetzt`
          : '🟡 FairPlay: Zusatzspieler eingesetzt';
      case 'extra_player_off': {
        const removedId = fairPlayRemovedPlayerIdFromEvent(ev);
        const removedName = removedId
          ? mobileLineupName(rosterById.get(removedId)?.name ?? 'Spieler')
          : name
            ? mobileLineupName(name)
            : 'Spieler';
        return `🔴 FairPlay: ${removedName} vom Feld genommen`;
      }
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
    spectatorCompact = false,
    embedOnly = false,
  ) => {
    const isHomeGoal = ev.type === 'goal';
    const isAwayGoal = ev.type === 'goal_away';
    const isGoal = isHomeGoal || isAwayGoal;
    const isSub = ev.type === 'sub_out' || ev.type === 'sub_in' || ev.type === 'substitution';
    const isPosSwap = ev.type === 'position_swap';
    const isFairPlayOn = ev.type === 'extra_player_on';
    const isFairPlayOff = ev.type === 'extra_player_off';
    const isFairPlay = isFairPlayOn || isFairPlayOff;
    const pl = ev.playerId ? rosterById.get(ev.playerId) : undefined;
    const posSwapLine = isPosSwap ? positionSwapPrimaryLine(ev) : null;
    const scoreStr =
      showGoalScoreBadge && isGoal ? (goalScoreBadgeByEventId.get(ev.id) ?? null) : null;
    const iconTile = isHomeGoal
      ? 'bg-green-700 text-white'
      : isAwayGoal
        ? 'bg-red-700 text-white'
        : isPosSwap
          ? 'border border-zinc-600/45 bg-zinc-900/85 text-zinc-200'
          : isFairPlayOn
            ? 'border border-amber-500/55 bg-amber-950/90 text-amber-100'
            : isFairPlayOff
              ? 'border border-red-500/55 bg-red-950/90 text-red-100'
              : isSub
                ? 'bg-zinc-800 text-zinc-200'
                : 'bg-zinc-800 text-zinc-400';

    const cardBorder = isPosSwap
      ? 'border-zinc-600/40 bg-zinc-950/75 shadow-none'
      : isFairPlay
        ? isFairPlayOn
          ? 'border-amber-500/40 bg-amber-950/35 shadow-[0_0_18px_rgba(245,158,11,0.12)]'
          : 'border-red-500/40 bg-red-950/30 shadow-[0_0_18px_rgba(239,68,68,0.12)]'
        : isHomeGoal
          ? friendlyFeed
            ? 'border-red-500/45 shadow-[0_0_20px_rgba(220,38,38,0.22)]'
            : 'border-green-600/50'
          : isAwayGoal
            ? friendlyFeed
              ? 'border-red-500/45 shadow-[0_0_20px_rgba(220,38,38,0.22)]'
              : 'border-red-600/50'
            : isSub
              ? friendlyFeed
                ? 'border-zinc-500/35 bg-zinc-950/90'
                : 'border-zinc-600'
              : 'border-zinc-700';

    const scorePillClass = isHomeGoal
      ? 'rounded-full border border-green-600 bg-green-950/90 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-green-100 md:px-2.5 md:py-1 md:text-[11px]'
      : 'rounded-full border border-red-600 bg-red-950/90 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-red-100 md:px-2.5 md:py-1 md:text-[11px]';

    const tickerCardShell = friendlyFeed
      ? isPosSwap
        ? 'gap-1.5 rounded-xl px-2 py-1.5'
        : 'gap-2 rounded-xl px-2.5 py-2 md:gap-2 md:px-3 md:py-2.5'
      : 'gap-2 rounded-lg px-2 py-1.5 md:gap-2 md:px-2.5 md:py-2';
    const tickerIconBox =
      friendlyFeed && isPosSwap
        ? 'h-7 w-7 shrink-0 rounded-lg text-sm'
        : friendlyFeed
          ? 'h-9 w-9 shrink-0 rounded-lg text-base md:h-10 md:w-10 md:text-lg'
          : 'h-8 w-8 rounded-md text-sm md:h-9 md:w-9 md:text-base';

    const card = (
      <div className={`flex min-h-0 items-stretch border bg-zinc-950 ${tickerCardShell} ${cardBorder}`}>
        <div className={`flex shrink-0 items-center justify-center ${tickerIconBox} ${iconTile}`} aria-hidden>
          {eventIcon(ev.type)}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          {isHomeGoal ? (
            <>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                  friendlyFeed
                    ? 'border-red-500/50 bg-red-950/80 text-red-50 shadow-[0_0_14px_rgba(220,38,38,0.28)]'
                    : 'border-green-600 bg-green-950/80 text-green-100'
                }`}
              >
                ⚽ TOR {stadiumHomeDisplay}
              </span>
              {pl ? (
                <p className="mt-0.5 truncate text-sm font-semibold leading-snug text-white">
                  {pl.name}
                  {pl.number != null && String(pl.number).trim() !== '' ? (
                    <span className="text-gray-300"> ({pl.number})</span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-0.5 text-xs font-medium text-gray-400">Ohne Torschütze</p>
              )}
            </>
          ) : isAwayGoal ? (
            <>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                  friendlyFeed
                    ? 'border-red-500/50 bg-red-950/80 text-red-50 shadow-[0_0_14px_rgba(220,38,38,0.28)]'
                    : 'border-red-600 bg-red-950/80 text-red-100'
                }`}
              >
                ⚽ TOR {stadiumAwayDisplay}
              </span>
              {pl ? (
                <p className="mt-0.5 truncate text-sm font-semibold leading-snug text-white">
                  {pl.name}
                  {pl.number != null && String(pl.number).trim() !== '' ? (
                    <span className="text-gray-300"> ({pl.number})</span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-0.5 text-xs font-medium text-gray-400">Ohne Torschütze</p>
              )}
            </>
          ) : isPosSwap ? (
            <>
              <p className="text-[12px] font-semibold leading-snug text-zinc-100">
                {posSwapLine ?? 'Positionswechsel'}
              </p>
              {posSwapLine && !spectatorCompact ? (
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                  Positionswechsel
                </p>
              ) : null}
            </>
          ) : isFairPlay ? (
            <>
              <p className="text-[12px] font-semibold leading-snug text-white/95">
                {parentLiveEventDescription(ev)}
              </p>
              {!spectatorCompact ? (
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-200/70">
                  FairPlay
                </p>
              ) : null}
            </>
          ) : isSub ? (
            <>
              {!friendlyFeed ? (
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">Wechsel</p>
              ) : null}
              <p
                className={`${friendlyFeed ? '' : 'mt-1 '}text-sm font-semibold leading-snug ${
                  friendlyFeed ? 'text-zinc-200' : ev.type === 'sub_out' ? 'text-red-300' : 'text-emerald-300'
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
    );

    if (embedOnly) {
      return <div className="w-full min-w-0">{card}</div>;
    }

    return (
      <li
        key={ev.id}
        className={`relative flex gap-0 ${friendlyFeed ? 'pb-1.5 last:pb-0 md:pb-2' : 'pb-2.5 last:pb-0 md:pb-3'}`}
      >
        <div className="flex w-10 shrink-0 flex-col items-end pr-0.5 pt-0.5 md:w-12 md:pr-1">
          <span className="text-xs font-bold tabular-nums leading-none text-white md:text-sm">
            {formatMinute(ev.timestamp)}
          </span>
        </div>
        <div className="relative flex w-2.5 shrink-0 flex-col items-center pt-0.5 md:w-3">
          {index < listLength - 1 ? (
            <div
              className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${
                friendlyFeed ? 'top-1.5 w-px bg-zinc-600/45' : 'top-2.5 w-1 rounded-full bg-zinc-700'
              }`}
              aria-hidden
            />
          ) : null}
          <div
            className={`relative z-10 h-1.5 w-1.5 shrink-0 rounded-full ${
              friendlyFeed ? 'bg-zinc-500' : 'bg-red-600'
            }`}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">{card}</div>
      </li>
    );
  };

  const renderTrainerTickerSegment = (row: TickerSegmentRow) => {
    if (isSubstitutionTickerPair(row)) {
      const atomic = row.items[0]?.type === 'substitution' ? row.items[0] : null;
      const outId = atomic
        ? substitutionOutInIds(atomic).outId
        : String(row.items[0]?.playerId ?? '').trim();
      const inId = atomic
        ? substitutionOutInIds(atomic).inId
        : String(row.items[1]?.playerId ?? '').trim();
      const line = formatSubstitutionTickerLine(rosterById, outId, inId);
      return (
        <div
          key={row.key}
          className="flex min-h-0 items-stretch gap-2 rounded-xl border border-zinc-600/40 bg-zinc-950/88 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:gap-2 md:px-2.5 md:py-2"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-600/50 bg-zinc-900 text-base text-zinc-200"
            aria-hidden
          >
            ⇄
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Wechsel</p>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-zinc-200">{line}</p>
          </div>
        </div>
      );
    }

    const ev = row.items[0];
    return (
      <div key={row.key} className="w-full min-w-0">
        {renderTimelineRow(ev, 0, 1, true, true, spectatorView, true)}
      </div>
    );
  };

  const renderTrainerTickerMinuteGroup = (
    group: { groupKey: string; minuteLabel: string; segments: TickerSegmentRow[] },
    groupIndex: number,
    groupCount: number,
  ) => {
    const lineConnector =
      groupIndex < groupCount - 1 ? (
        <div className="absolute top-1.5 bottom-0 left-1/2 w-px -translate-x-1/2 bg-zinc-600/45" aria-hidden />
      ) : null;
    return (
      <li key={group.groupKey} className="relative flex gap-0 pb-1.5 last:pb-0 md:pb-2">
        <div className="flex w-10 shrink-0 flex-col items-end pr-0.5 pt-0.5 md:w-12 md:pr-1">
          <span className="text-xs font-bold tabular-nums leading-none text-white md:text-sm">{group.minuteLabel}</span>
        </div>
        <div className="relative flex w-2.5 shrink-0 flex-col items-center pt-0.5 md:w-3">
          {lineConnector}
          <div className="relative z-10 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {group.segments.map((seg) => renderTrainerTickerSegment(seg))}
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
  const matchboardVisible = mainTab === 'hub';
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
  const scoreTapHome = `${mbRowBtn} ${SCOREBOARD_NO_SELECT} gap-0 min-h-[48px] min-w-[2.85rem] shrink-0 rounded-xl border border-emerald-400/40 bg-gradient-to-b from-emerald-950/92 to-black/75 px-3 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_26px_rgba(16,185,129,0.35)] hover:border-emerald-300/50 hover:shadow-[0_0_32px_rgba(16,185,129,0.42)] active:scale-[0.97] sm:min-w-[3.1rem] sm:px-3.5 disabled:pointer-events-none disabled:opacity-38`;
  const scoreTapAway = `${mbRowBtn} ${SCOREBOARD_NO_SELECT} gap-0 min-h-[48px] min-w-[2.85rem] shrink-0 rounded-xl border border-red-400/45 bg-gradient-to-b from-red-950/92 to-black/75 px-3 text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_26px_rgba(239,68,68,0.38),0_0_12px_rgba(255,255,255,0.06)] hover:border-red-300/50 hover:shadow-[0_0_32px_rgba(239,68,68,0.45)] active:scale-[0.97] sm:min-w-[3.1rem] sm:px-3.5 disabled:pointer-events-none disabled:opacity-38`;
  const mbStart = `${mbRowBtn} rounded-xl border border-emerald-400/50 bg-gradient-to-b from-emerald-600/80 to-emerald-950/85 text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_22px_rgba(16,185,129,0.35)] hover:from-emerald-500/85 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]`;
  /** Pause als linke Hauptaktion — dunkelgrün wie Zielbild, klar von Beginn/Weiter (hellgrün) getrennt. */
  const mbPausePrimary = `${mbRowBtn} rounded-xl border border-emerald-800/55 bg-gradient-to-b from-emerald-950/92 to-black/85 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_16px_rgba(6,78,59,0.35)] hover:border-emerald-600/45 hover:from-emerald-900/88`;
  const mbEnd = `${mbRowBtn} rounded-xl border border-red-500/50 bg-gradient-to-b from-red-600/75 to-red-950/88 text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_rgba(220,38,38,0.38)] hover:from-red-500/78 hover:shadow-[0_0_32px_rgba(220,38,38,0.45)]`;
  const mbWechsel = `${mbRowBtn} w-full rounded-xl border border-white/22 bg-zinc-950/85 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/30 hover:bg-zinc-900/90`;
  /** Während Live: zurückhaltend (disabled). Nach Ende: klarer Gold-Abschluss. */
  const mbSpielEndeWhileLive = `${mbRowBtn} w-full rounded-xl border border-amber-500/30 bg-black/80 text-amber-100/70 shadow-none opacity-55`;
  const mbSpielEndeReady = `${mbRowBtn} w-full rounded-xl border-2 border-amber-400/80 bg-gradient-to-b from-amber-950/50 to-black/92 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_rgba(234,179,8,0.35),0_0_48px_rgba(245,158,11,0.18)] hover:border-amber-300/90 enabled:hover:shadow-[0_0_36px_rgba(250,204,21,0.38)]`;

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
    if (spectatorView || !canControlLiveMatch || matchIsFinished || !isClockRunning) return;
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
    if (spectatorView || !canControlLiveMatch || matchIsFinished || !isClockRunning) return;
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
                ) : ev.type === 'position_swap' ? (
                  <>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-white">
                      {positionSwapPrimaryLine(ev) ?? 'Positionswechsel'}
                    </p>
                    {positionSwapPrimaryLine(ev) ? (
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Positionswechsel
                      </p>
                    ) : null}
                  </>
                ) : ev.type === 'extra_player_on' || ev.type === 'extra_player_off' ? (
                  <>
                    <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-amber-300/95">
                      FairPlay
                    </p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-white">{parentLiveEventDescription(ev)}</p>
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
            onClick={openPauseConfirm}
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

  /** Höhe unter globalem App-Header (main pt); Matchboard+Hub fix, Module scrollen (inkl. pb für Bottom-Nav). */
  const liveShellOuter =
    'relative flex h-[calc(100svh-5.5rem)] max-h-[calc(100svh-5.5rem)] flex-col overflow-hidden text-white';
  const wechselScreenActive = Boolean(canControlLiveMatch && wechselSheetOpen && !matchIsFinished);

  return (
    <div className={liveShellOuter}>
      <style>{`@keyframes liveSubIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes liveSubOut{from{opacity:.92;transform:translateY(0)}to{opacity:0;transform:translateY(10px)}}`}</style>
      {!wechselScreenActive ? (
      <>
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
        ref={mainTab === 'hub' ? liveHubScrollRef : undefined}
        className={`border-b border-red-500/35 bg-black/78 shadow-[0_4px_32px_rgba(0,0,0,0.5)] backdrop-blur-md ${
          mainTab === 'hub'
            ? 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]'
            : 'shrink-0'
        }`}
      >
        <div
          className={`${layoutShell} ${
            spectatorView ? 'px-2 pb-1 pt-0 md:px-4 md:pb-1 md:pt-0' : 'px-2 pb-1 pt-0 md:px-4 md:pb-1 md:pt-0.5'
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
              <div className={`relative z-[1] w-full px-3 py-1.5 pb-1 sm:px-[13px] ${SCOREBOARD_NO_SELECT}`}>
                {matchTypeDisplay ? (
                  <div className="flex justify-center">
                    <p className="text-base font-semibold text-white sm:text-lg">{matchTypeDisplay}</p>
                  </div>
                ) : null}

                <div className={`flex justify-center ${matchTypeDisplay ? 'mt-1.5' : 'mt-1'}`}>
                  <div className={liveBadgeClassName}>
                    {hasClockStarted && !matchIsFinished ? (
                      <span className="text-[10px] leading-none text-red-100 sm:text-[11px]" aria-hidden>
                        ●
                      </span>
                    ) : null}
                    {matchIsFinished ? 'Endstand' : hasClockStarted ? 'Live' : 'Bereit'}
                  </div>
                </div>

                {isPaused && !matchIsFinished ? (
                  <div className="mt-1 flex justify-center px-2">
                    <div
                      role="status"
                      aria-label="Pause. Tore nach Weiter möglich."
                      className="inline-flex max-h-8 min-h-7 max-w-[10.5rem] flex-col items-center justify-center rounded-full border border-amber-400/30 bg-black/50 px-2.5 py-0.5 shadow-sm backdrop-blur-md min-[380px]:max-h-none min-[380px]:min-h-0 min-[380px]:max-w-[14rem] min-[380px]:py-1"
                    >
                      <span className="text-[9px] font-black uppercase leading-none tracking-[0.12em] text-amber-100/90 sm:text-[10px]">
                        <span aria-hidden>⏸</span> Pause
                      </span>
                      <span className="mt-0.5 hidden min-[380px]:block text-center text-[8px] font-medium leading-tight text-white/70 sm:text-[9px]">
                        Tore nach Weiter möglich
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Logo + Namen unter Logo | Score + Labels + Perioden | Logo + Namen */}
                <div
                  className={`flex items-start justify-between gap-1.5 sm:gap-2.5 ${
                    isPaused && !matchIsFinished ? 'mt-1.5' : matchTypeDisplay ? 'mt-2' : 'mt-1.5'
                  }`}
                >
                  <div className={`flex min-w-0 w-[30%] max-w-[8.75rem] flex-col items-center sm:max-w-[9.5rem] ${SCOREBOARD_NO_SELECT}`}>
                    <LiveMatchLogoTile src={homeLogoSrc} liveGlow={false} size="boardSm" />
                    <div className="mt-1 w-full px-0.5">
                      <MatchboardTeamNameLines parts={homeNameParts} align="center" tight />
                    </div>
                  </div>

                  <div className={`flex min-w-0 shrink flex-col items-center gap-1 px-0.5 sm:px-1 ${SCOREBOARD_NO_SELECT}`}>
                    {!spectatorView && canControlLiveMatch && !matchIsFinished ? (
                      <div className="flex items-start justify-center gap-1 sm:gap-2 motion-safe:transition-transform motion-safe:duration-300">
                        <div className="flex min-w-0 flex-col items-center">
                          <button
                            type="button"
                            disabled={!isClockRunning}
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
                              if (!isClockRunning) {
                                setSaveError(goalBlockedMessage);
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
                            <span className="text-3xl font-bold tabular-nums leading-none sm:text-4xl">
                              {displayScoreHome}
                            </span>
                          </button>
                        </div>
                        <span
                          className="shrink-0 select-none pt-0.5 text-2xl font-bold leading-none text-white/90 tabular-nums sm:pt-1 sm:text-3xl"
                          aria-hidden
                        >
                          :
                        </span>
                        <div className="flex min-w-0 flex-col items-center">
                          <button
                            type="button"
                            disabled={!isClockRunning}
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
                              if (!isClockRunning) {
                                setSaveError(goalBlockedMessage);
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
                            <span className="text-3xl font-bold tabular-nums leading-none sm:text-4xl">
                              {displayScoreAway}
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex flex-col items-center gap-1 ${SCOREBOARD_NO_SELECT}`}>
                        <div className="flex items-center justify-center motion-safe:transition-transform motion-safe:duration-300">
                          <span className="text-center text-5xl font-bold leading-none text-white tabular-nums whitespace-nowrap sm:text-6xl">
                            {displayScoreHome}
                            <span className="mx-1.5 text-white/85 sm:mx-2">:</span>
                            {displayScoreAway}
                          </span>
                        </div>
                        {!matchIsFinished ? (
                          <span
                            className={`liveTimer inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-1 font-mono text-base font-bold tabular-nums leading-none text-white shadow-[0_0_26px_rgba(220,38,38,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] sm:text-lg ${SCOREBOARD_NO_SELECT}`}
                            aria-live="polite"
                          >
                            {formatClock(currentMatchSeconds)}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <p className={`mt-0.5 w-full text-center font-mono text-[9px] font-medium tabular-nums leading-none text-white/80 sm:text-[10px] ${SCOREBOARD_NO_SELECT}`}>
                      <span className="inline-block whitespace-nowrap tracking-[-0.01em]">{periodScoreLine}</span>
                    </p>
                  </div>

                  <div className={`flex min-w-0 w-[30%] max-w-[8.75rem] flex-col items-center sm:max-w-[9.5rem] ${SCOREBOARD_NO_SELECT}`}>
                    <LiveMatchLogoTile src={awayLogoSrc} liveGlow={false} size="boardSm" />
                    <div className="mt-1 w-full px-0.5">
                      <MatchboardTeamNameLines parts={awayNameParts} align="center" tight />
                    </div>
                  </div>
                </div>
              </div>

              {matchRow?.status === 'live' && !matchIsFinished && (fairPlayRuleActivatable || fairPlayExtraPlayerId) ? (
                <div className="relative z-[1] border-t border-white/10 px-2 py-1 sm:px-2.5">
                  <div
                    className={[
                      'rounded-xl border px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md sm:px-2.5',
                      fairPlayMustRemoveExtra
                        ? 'border-red-500/45 bg-gradient-to-br from-red-950/55 to-black/70'
                        : fairPlayExtraPlayerId
                          ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/40 to-black/65'
                          : 'border-amber-400/35 bg-gradient-to-br from-yellow-950/35 to-black/60',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="shrink-0 text-base leading-none" aria-hidden>
                        {fairPlayMustRemoveExtra ? '🔴' : fairPlayExtraPlayerId ? '🟠' : '🟡'}
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/85">
                          {fairPlayMustRemoveExtra
                            ? 'Ein Spieler muss vom Feld'
                            : fairPlayExtraPlayerId
                              ? 'FairPlay-Zusatzspieler aktiv'
                              : 'FairPlay-Regel aktiv'}
                        </p>
                        <p className="text-[11px] font-semibold leading-snug text-white/95">
                          {fairPlayMustRemoveExtra
                            ? 'Nur noch 3 Tore Unterschied — Feldspieler wählen'
                            : fairPlayExtraPlayerId
                              ? `${mobileLineupName(fairPlayExtraDisplayName)} als Zusatzspieler am Feld`
                              : '4 Tore Rückstand — Zusatzspieler möglich'}
                        </p>
                      </div>
                    </div>
                    {canControlLiveMatch ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {fairPlayExtraPlayerId ? (
                          <button
                            type="button"
                            onClick={openFairPlayRemoveSheet}
                            className={`min-h-9 w-full rounded-lg border px-2.5 py-1.5 text-center text-[11px] font-bold active:scale-[0.98] sm:text-xs ${
                              fairPlayMustRemoveExtra
                                ? 'border-red-400/55 bg-red-950/55 text-red-50'
                                : 'border-white/20 bg-black/40 text-white'
                            }`}
                          >
                            {fairPlayMustRemoveExtra ? 'Spieler entfernen' : 'Zusatzspieler entfernen'}
                          </button>
                        ) : null}
                        {!fairPlayExtraPlayerId && fairPlayRuleActivatable ? (
                          <button
                            type="button"
                            onClick={openFairPlayExtraSheet}
                            className="min-h-9 w-full rounded-lg border border-amber-400/50 bg-amber-950/60 px-2.5 py-1.5 text-center text-[11px] font-bold text-amber-50 active:scale-[0.98] sm:text-xs"
                          >
                            + Zusatzspieler
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!spectatorView && canControlLiveMatch ? (
                <div className="relative z-[1] mt-0 space-y-1 border-t border-red-500/35 bg-black/55 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_-12px_32px_rgba(220,38,38,0.12)] backdrop-blur-md">
                  {renderTrainerClockActionRow('gap-1.5')}

                  {goalUndoOffer ? (
                    <div
                      className={`flex items-center justify-between gap-2 rounded-xl border border-red-400/45 bg-gradient-to-r from-red-950/95 to-black/90 px-3 py-2 shadow-[0_0_18px_rgba(220,38,38,0.22)] transition-all duration-300 ${
                        goalUndoToastClosing ? 'scale-[0.98] opacity-0' : 'scale-100 opacity-100'
                      }`}
                      role="status"
                    >
                      <p className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-tight text-white">
                        <span className="font-black text-red-200">Rückgängig</span>
                        <span className="text-white/85">
                          {' '}
                          · Tor für{' '}
                          {goalUndoOffer.side === 'home'
                            ? stadiumHomeDisplay || 'Heim'
                            : stadiumAwayDisplay || 'Gast'}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => void undoLastGoal()}
                        className="shrink-0 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white active:scale-[0.98]"
                      >
                        ↶ Rückgängig
                      </button>
                    </div>
                  ) : null}

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
                    className={`${
                      matchIsFinished && !calendarFinalized ? mbSpielEndeReady : mbSpielEndeWhileLive
                    } gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-[11px] disabled:opacity-35`}
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

          {mainTab === 'hub' ? (
            <nav
              className={`${spectatorView ? hubNavSpectator : hubNavTrainer} pb-[calc(170px+env(safe-area-inset-bottom,0px))]`}
              aria-label="Live Hub"
            >
              <button type="button" className={hubNavBtn} onClick={() => setMainTab('overview')}>
                Übersicht
              </button>
              <button type="button" className={hubNavBtn} onClick={() => setMainTab('lineup')}>
                Aufstellung
              </button>
              <button type="button" className={hubNavBtn} onClick={() => setMainTab('events')}>
                Liveticker
              </button>
              {!spectatorView ? (
                <button type="button" className={hubNavBtn} onClick={() => setMainTab('time')}>
                  Statistik
                </button>
              ) : null}
            </nav>
          ) : (
            <div className={liveModuleBackBar} aria-label="Zurück zum Live Hub">
              <button
                type="button"
                onClick={() => setMainTab('hub')}
                className="inline-flex min-h-[44px] min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-bold text-white shadow-sm backdrop-blur-sm transition active:scale-[0.98]"
              >
                <span aria-hidden>←</span>
                <span>Livespiel</span>
              </button>
              {canControlLiveMatch && mainTab === 'lineup' ? (
                <div className="ml-auto flex max-w-[min(100%,11rem)] shrink-0 items-stretch gap-1 sm:max-w-none sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLineupPositionMode(false);
                      setFormationSheetOpen(true);
                    }}
                    className="inline-flex min-h-[44px] min-w-0 flex-1 shrink items-center justify-center rounded-xl border border-red-500/35 bg-red-950/45 px-2 py-2 text-[10px] font-extrabold uppercase tracking-wide text-red-100 shadow-[0_0_16px_rgba(220,38,38,0.2)] transition-colors hover:border-red-400/45 hover:bg-red-950/60 active:scale-[0.98] sm:px-3 sm:text-xs"
                  >
                    Formation
                  </button>
                  <button
                    type="button"
                    disabled={matchIsFinished}
                    title="Positionen auf dem Feld tauschen"
                    aria-pressed={lineupPositionMode}
                    onClick={() => setLineupPositionMode((v) => !v)}
                    className={[
                      'inline-flex min-h-[44px] min-w-0 flex-1 shrink items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-[10px] font-extrabold uppercase tracking-wide transition-colors active:scale-[0.98] sm:gap-1 sm:px-3 sm:text-xs',
                      lineupPositionMode
                        ? 'border-violet-400/55 bg-violet-950/55 text-violet-50 shadow-[0_0_14px_rgba(139,92,246,0.28)]'
                        : 'border-white/14 bg-white/[0.06] text-white/80 hover:border-white/22 hover:bg-white/[0.1]',
                      matchIsFinished ? 'pointer-events-none opacity-40' : '',
                    ].join(' ')}
                  >
                    <span aria-hidden>↔</span>
                    <span className="truncate">Pos.</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </header>

      <div
        ref={liveScrollRef}
        className={`relative min-h-0 overscroll-y-contain [-webkit-overflow-scrolling:touch] ${layoutShell} md:px-4 lg:px-5 md:py-4 ${
          mainTab === 'hub'
            ? 'hidden'
            : 'flex-1 overflow-y-auto px-2 py-3 pt-2 pb-[calc(140px+env(safe-area-inset-bottom,0px))]'
        } ${mainTab === 'lineup' ? '!px-0 !py-0 sm:!py-1' : ''}`}
      >
        {mainTab === 'overview' && (
          <div className={canControlLiveMatch ? 'space-y-2' : 'space-y-4'}>
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
                      <p className="mt-0.5 text-xs font-medium text-white">
                        {`${activePlayerIds.length}/7 aktiv`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Bank</p>
                      <p className="mt-0.5 text-xs font-medium text-white">{benchPlayers.length}</p>
                    </div>
                  </div>
                  {isPaused ? (
                    <p className="mt-1.5 rounded-lg border border-amber-400/25 bg-gradient-to-br from-amber-950/40 via-yellow-950/20 to-black/70 px-2.5 py-1.5 text-center text-[11px] font-semibold leading-snug text-amber-50/95 shadow-[0_0_20px_rgba(251,191,36,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <span aria-hidden className="mr-1">
                        ☕
                      </span>
                      Pause läuft – Zeit für Wechsel & Anpassungen.
                    </p>
                  ) : null}
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
          <div className="flex flex-col gap-2 px-2 pt-2 sm:px-3">
            <section className="flex flex-col gap-2 sm:rounded-2xl sm:border sm:border-white/[0.08] sm:bg-black/30 sm:p-1.5">
              <div className="px-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Live-Aufstellung</p>
                {canControlLiveMatch && lineupPositionMode && !matchIsFinished ? (
                  <p className="mt-0.5 text-[11px] font-semibold leading-snug text-violet-200/90">
                    Zwei Feldspieler antippen, dann bestätigen.
                  </p>
                ) : null}
              </div>
              {canRenderLivePitch ? (
                <>
                  <LineupFormationPitch
                  formationId={safeFormationId}
                  slots={safeLineupSlots as Record<FieldSlotId, string | null>}
                  interactive={Boolean(canControlLiveMatch && lineupPositionMode && !matchIsFinished)}
                  onSlotTap={handleLineupPositionSlotTap}
                  emphasizedPlayerId={null}
                  slotHighlightBySlot={mainLineupPitchSlotHighlight}
                  className={
                    fairPlayExtraPlayerId
                      ? 'min-h-[34dvh] max-h-[min(48dvh,26rem)] w-full shrink-0'
                      : 'min-h-[40dvh] max-h-[min(56dvh,32rem)] w-full shrink-0'
                  }
                  renderSlotContent={({ slot, label, playerId, isGk }) => {
                    if (!playerId) return null;
                    const player = rosterById.get(playerId) ?? null;
                    const posLabel = getPositionLabel(label) || '–';
                    const rawName = (player?.displayName ?? player?.name ?? '').trim() || 'Spieler';
                    const shortName = (() => {
                      const s = mobileLineupName(rawName);
                      return s === '—' || !s ? 'Spieler' : s;
                    })();
                    const isPosSwapPick =
                      lineupPositionMode && posSwapSlotA === slot && Boolean(playerId) && !posSwapConfirmOpen;
                    return (
                      <div
                        className={[
                          'pointer-events-none relative flex w-full max-w-[min(22vw,5.25rem)] flex-col items-center',
                          isPosSwapPick ? 'scale-[1.04]' : '',
                        ].join(' ')}
                      >
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
                            className={isPosSwapPick ? 'ring-2 ring-violet-400/75' : ''}
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
                {fairPlayExtraPlayerId ? (
                  <div className="flex shrink-0 items-center justify-center gap-2 px-1 py-0.5">
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-amber-200/85">
                      FairPlay +1
                    </span>
                    <div className="relative flex items-center gap-1.5">
                      <span
                        className="absolute -right-1 -top-1 z-[2] rounded-full border border-amber-300/90 bg-amber-400 px-0.5 text-[7px] font-black leading-none text-black"
                        aria-label="Zusatzspieler"
                      >
                        +1
                      </span>
                      {(() => {
                        const pid = fairPlayExtraPlayerId.trim();
                        const player = rosterById.get(pid) ?? null;
                        const rawName = (player?.displayName ?? player?.name ?? '').trim() || 'Spieler';
                        const shortName = mobileLineupName(rawName);
                        return (
                          <>
                            <LeibchenJersey
                              lastName={shortName === '—' || !shortName ? 'Spieler' : shortName}
                              number={player?.number ?? '–'}
                              position="FP"
                              variant="field"
                              size="compact"
                              pitchStyleBack
                              className="!h-[2.5rem] !w-[2rem] ring-1 ring-amber-400/45"
                            />
                            <div className="min-w-0 text-left">
                              <p className="max-w-[5.5rem] truncate text-[9px] font-semibold text-white">{shortName}</p>
                              <p className="font-mono text-[9px] font-bold tabular-nums text-amber-200/90">
                                {formatClock(playtimes[pid] ?? 0)}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : null}
                </>
              ) : (
                <p className="rounded-xl border border-white/10 bg-black/25 px-3 py-4 text-sm text-white/55">
                  Live-Aufstellung wird geladen
                </p>
              )}

              <div className="rounded-xl border border-white/10 bg-black/40 p-2 sm:p-2.5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Bank</p>
                {safeBenchRowsCount === 0 ? (
                  <p className="text-[12px] text-white/45">Keine Bankspieler</p>
                ) : (
                  <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                    <div className="flex min-w-min flex-nowrap items-start gap-2 sm:gap-2.5">
                      {(Array.isArray(safeBenchRows) ? safeBenchRows : []).map((row, idx) => {
                        const posLabel = getPositionLabel(row.position) || '–';
                        const fullBenchName = String(row.display_name || row.name || 'Spieler').trim() || 'Spieler';
                        return (
                          <div
                            key={`live-bench-tile-${row.id || idx}`}
                            className="flex w-[7.25rem] min-w-0 shrink-0 flex-col items-center rounded-xl border border-white/12 bg-black/45 px-1.5 py-2 sm:w-[8.5rem]"
                          >
                            <LeibchenJersey
                              lastName={mobileLineupName(fullBenchName)}
                              number={row.jersey_number ?? row.number ?? '–'}
                              position={posLabel}
                              variant={posLabel === 'TW' ? 'goalkeeper' : 'field'}
                              size="compact"
                              pitchStyleBack
                              className="!h-[3.35rem] !w-[2.6rem] sm:!h-[3.85rem] sm:!w-[3rem]"
                            />
                            <span
                              className="mt-1.5 line-clamp-2 block w-full min-w-0 overflow-hidden px-0.5 text-center text-[11px] font-semibold leading-snug text-white [overflow-wrap:anywhere] sm:text-xs"
                              title={fullBenchName}
                            >
                              {fullBenchName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="rounded-xl border border-white/[0.08] bg-black/30">
              <button
                type="button"
                onClick={() => setKickoffAccordionOpen((o) => !o)}
                className="flex w-full min-h-[48px] items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
                aria-expanded={kickoffAccordionOpen}
              >
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white/65">
                  Startaufstellung (Kickoff)
                </span>
                <span className="shrink-0 text-white/45" aria-hidden>
                  {kickoffAccordionOpen ? '▾' : '▸'}
                </span>
              </button>
              {kickoffAccordionOpen ? (
                <div className="border-t border-white/[0.06] px-3 pb-3 pt-1">
                  {kickoffSafeLineupRowsCount === 0 ? (
                    <p className="pt-1 text-[12px] text-white/45">Keine Kickoff-Daten.</p>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {(Array.isArray(kickoffSafeLineupRows) ? kickoffSafeLineupRows : []).map((row) => (
                        <MatchPlayerRow
                          key={`kickoff-lineup-${row.slot}`}
                          player={row}
                          rightLabel={row.rightLabel}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {mainTab === 'events' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-1 pb-4 sm:px-2">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/12 bg-black/50 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:grid-cols-4">
              {(
                [
                  ['all', 'Alle'],
                  ['goals', 'Tore'],
                  ['subs', 'Wechsel'],
                  ['cards', 'Karten'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEventsFilter(key)}
                  className={`min-h-[44px] rounded-xl px-2 py-2 text-[12px] font-extrabold tracking-tight transition-colors sm:min-h-[48px] sm:text-sm ${
                    eventsFilter === key
                      ? 'border border-red-500/45 bg-gradient-to-b from-red-600/90 to-red-950/90 text-white shadow-[0_0_20px_rgba(220,38,38,0.25)]'
                      : 'border border-transparent text-white/50 hover:border-white/10 hover:bg-white/[0.05] hover:text-white/85'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {eventsFilter === 'cards' ? (
              <p className="rounded-2xl border border-amber-400/25 bg-amber-950/20 px-4 py-10 text-center text-sm font-medium leading-relaxed text-amber-100/90">
                Keine Karten erfasst.
              </p>
            ) : trainerTickerGroups.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/40 px-4 py-10 text-center text-sm text-zinc-400">
                Keine Einträge für diesen Filter.
              </p>
            ) : (
              <ul className="min-h-0 flex-1 space-y-0 overflow-y-auto rounded-2xl border border-zinc-600/30 bg-black/55 px-1.5 py-2 sm:px-2 sm:py-3">
                {trainerTickerGroups.map((g, i, arr) => renderTrainerTickerMinuteGroup(g, i, arr.length))}
              </ul>
            )}
          </div>
        )}

        {mainTab === 'time' && (
          <div className="space-y-1.5">
            {isPaused ? (
              <p className="rounded-lg border border-amber-400/25 bg-gradient-to-br from-amber-950/45 via-yellow-950/22 to-black/75 px-2.5 py-2 text-center text-[12px] font-semibold leading-snug text-amber-50/95 shadow-[0_0_22px_rgba(251,191,36,0.14),inset_0_1px_0_rgba(255,255,255,0.06)]">
                <span aria-hidden className="mr-1">
                  ☕
                </span>
                Pause läuft – Zeit für Wechsel & Anpassungen.
              </p>
            ) : null}
            <section
              className={[
                'rounded-lg p-0.5',
                isPaused ? 'ring-2 ring-amber-300/35 ring-offset-1 ring-offset-black shadow-[0_0_24px_rgba(251,191,36,0.12)]' : '',
              ].join(' ')}
            >
              <h2 className="mb-0.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">
                Wechsel-Vorschläge
              </h2>
              <div className="space-y-1">
                {matchRow?.status !== 'live' && !matchIsFinished ? (
                  <p className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center text-[12px] text-white/55">
                    Wechselvorschläge sind ab Anpfiff verfügbar.
                  </p>
                ) : substitutionSuggestions.length > 0 ? (
                  <>
                    {(subSuggestionsExpanded ? substitutionSuggestions : substitutionSuggestions.slice(0, 2)).map(
                      (sug) => (
                        <div
                          key={`sub-sug-${sug.outId}-${sug.inId}`}
                          className="rounded-lg border border-white/10 bg-zinc-950/90 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        >
                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                            <p className="min-w-0 text-[12px] font-bold leading-tight text-white">
                              <span className="font-normal text-white/50">Raus</span> {sug.outName}
                              <span className="ml-1 font-mono text-[11px] font-semibold tabular-nums text-red-400/90">
                                {formatClock(sug.outSec)}
                              </span>
                            </p>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                            <p className="min-w-0 text-[12px] font-bold leading-tight text-white">
                              <span className="font-normal text-white/50">Rein</span> {sug.inName}
                              <span className="ml-1 font-mono text-[11px] font-semibold tabular-nums text-emerald-400/90">
                                {formatClock(sug.inSec)}
                              </span>
                            </p>
                          </div>
                          <p className="mt-0.5 text-[10px] leading-snug text-white/40">Mehr Spielzeit für Bankspieler</p>
                          <button
                            type="button"
                            disabled={matchIsFinished}
                            onClick={() => openWechselSheetWithPreset(sug.outId, sug.inId)}
                            className="mt-1 flex h-10 w-full items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-950/35 text-[11px] font-bold text-emerald-100/95 transition-colors hover:border-emerald-400/50 hover:bg-emerald-900/30 disabled:opacity-35"
                          >
                            Vorschlag übernehmen
                          </button>
                        </div>
                      ),
                    )}
                    {substitutionSuggestions.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => setSubSuggestionsExpanded((v) => !v)}
                        className="flex h-9 w-full items-center justify-center rounded-md border border-white/10 bg-transparent text-[11px] font-semibold text-white/50 transition-colors hover:border-amber-400/25 hover:bg-white/[0.04] hover:text-amber-100/80"
                      >
                        {subSuggestionsExpanded ? 'Weniger anzeigen' : 'Weitere Vorschläge anzeigen'}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center text-[12px] text-white/55">
                    Alle Spieler sind aktuell ausgeglichen.
                  </p>
                )}
              </div>
            </section>
            <p className="mb-1 text-[13px] text-gray-400">Effektive Spielzeit (ohne Pausen)</p>
            <ul className="space-y-1.5">
              {squadRosterForPlaytimeList.map((p) => {
                const sec = playtimes[p.id] ?? 0;
                const st = getPlaytimeStatus(sec, currentMatchSeconds, squadPlayerIds.length);
                const isFairPlayExtra =
                  Boolean(fairPlayExtraPlayerId) && String(fairPlayExtraPlayerId).trim() === p.id;
                const isActive = activePlayerIds.includes(p.id);
                const lowOnField = isActive && st === 'red';
                return (
                  <li
                    key={p.id}
                    className={[
                      'flex min-h-[46px] items-center gap-2 rounded-lg border px-2 py-1.5',
                      isActive
                        ? isFairPlayExtra
                          ? 'border-amber-500/45 bg-amber-950/18 ring-1 ring-amber-400/35'
                          : lowOnField
                            ? 'border-emerald-500/50 bg-emerald-950/20 ring-1 ring-amber-500/30'
                            : 'border-emerald-600/40 bg-emerald-950/12'
                        : 'border-zinc-700/40 bg-zinc-950/90',
                    ].join(' ')}
                  >
                    <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
                      {isActive ? (
                        <span
                          className={[
                            'h-2 w-2 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.45)]',
                            isFairPlayExtra ? 'bg-amber-400/95' : 'bg-emerald-500/90',
                          ].join(' ')}
                        />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-zinc-500/80" />
                      )}
                      <span className={`h-2.5 w-2.5 rounded-full ${ampelDot(st)}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-white">
                        {p.number || '–'} · {p.name}
                        {isFairPlayExtra ? (
                          <span className="ml-1.5 inline-flex rounded border border-amber-400/50 bg-amber-500/20 px-1 py-px text-[9px] font-black text-amber-100">
                            +1
                          </span>
                        ) : null}
                      </p>
                      <p
                        className={`mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] ${
                          isActive
                            ? isFairPlayExtra
                              ? 'text-amber-200/95'
                              : 'text-emerald-300'
                            : 'text-zinc-500'
                        }`}
                      >
                        {isFairPlayExtra && isActive
                          ? 'Am Feld · Zusatz'
                          : isActive
                            ? 'Am Feld'
                            : 'Auf der Bank'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-base font-semibold tabular-nums tracking-tight ${
                        isActive ? 'text-red-400/90' : 'text-zinc-500'
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
      </div>
      </>
      ) : null}

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
              className="flex min-h-0 w-full max-h-[min(80dvh,40rem)] flex-col overflow-hidden rounded-t-3xl border border-red-500/20 bg-gradient-to-b from-red-950/35 via-black to-black text-white shadow-[0_-12px_48px_rgba(0,0,0,0.65),0_0_28px_rgba(239,68,68,0.1)]"
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
                  {formationPendingId
                    ? 'Alle aktiven Feldspieler inkl. Torwart bleiben erhalten; nur die Darstellung der Positionen ändert sich.'
                    : 'Andere Systeme wählen — die 7 aktiven Spieler bleiben auf den Slots erhalten.'}
                </p>
              </div>
              {formationPendingId ? (
                <div className="mx-3 mb-2 shrink-0 rounded-2xl border border-amber-400/35 bg-amber-950/25 px-3 py-3">
                  <p className="text-center text-[13px] font-black text-amber-100">Formation wechseln?</p>
                  <p className="mt-1.5 text-center text-[12px] font-medium leading-snug text-white/80">
                    Alle {countOccupiedFieldSlots(lineupSlotsForDisplay)}{' '}
                    aktiven Spieler bleiben erhalten und werden bei Bedarf auf die neuen Slot-Positionen abgebildet.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={formationSaving}
                      onClick={() => setFormationPendingId(null)}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-white/14 bg-zinc-900/90 text-[12px] font-bold text-white/88 hover:bg-zinc-800 disabled:opacity-45"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      disabled={formationSaving}
                      onClick={() => void confirmFormationChange()}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-amber-500 px-2 text-[12px] font-black text-amber-950 shadow-[0_0_16px_rgba(245,158,11,0.35)] disabled:opacity-45"
                    >
                      {formationSaving ? '…' : 'Übernehmen'}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-3 [-webkit-overflow-scrolling:touch] pb-2">
                {U11_FORMATION_CHOICES.map((id) => {
                  const active = id === safeFormationId;
                  return (
                    <button
                      key={`formation-pick-${id}`}
                      type="button"
                      disabled={formationSaving}
                      onClick={() => requestFormationChange(id)}
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
                style={{ paddingBottom: LIVE_SHEET_FOOTER_CONFIRM_SAFE_PB }}
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

      {wechselScreenActive ? (
        <div
          className={WECHSEL_SCREEN_SHELL}
          style={{ top: WECHSEL_SHEET_TOP_OFFSET, bottom: WECHSEL_SHEET_BOTTOM_OFFSET }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wechsel-sheet-title"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-black">
            <div
              className="absolute inset-0 bg-cover opacity-[0.14] brightness-[0.38] saturate-[0.7]"
              style={{
                backgroundImage: `url(${matchboardWelcomeHeroSrc()})`,
                backgroundPosition: 'center 43%',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-red-950/75 to-black" />
          </div>
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-white/[0.07] bg-black/90 px-2 pb-1 pt-1">
              <h3 id="wechsel-sheet-title" className="shrink-0 text-[13px] font-black leading-none tracking-tight text-white">
                Wechsel
              </h3>
              <div
                className="inline-flex h-8 min-h-8 max-w-[12.5rem] flex-1 items-stretch justify-end overflow-hidden rounded-md border border-white/12 bg-black/70 p-px sm:max-w-[14rem]"
                role="tablist"
                aria-label="Ansicht"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={subSheetView === 'list'}
                  onClick={() => setSubSheetView('list')}
                  className={[
                    'min-h-8 flex-1 px-2 text-center text-[10px] font-bold leading-none transition-colors sm:text-[11px]',
                    subSheetView === 'list'
                      ? 'rounded-md bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.25)]'
                      : 'rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white/80',
                  ].join(' ')}
                >
                  Liste
                </button>
                <span className="w-px shrink-0 self-stretch bg-white/12" aria-hidden />
                <button
                  type="button"
                  role="tab"
                  aria-selected={subSheetView === 'pitch'}
                  onClick={() => setSubSheetView('pitch')}
                  className={[
                    'min-h-8 flex-1 px-2 text-center text-[10px] font-bold leading-none transition-colors sm:text-[11px]',
                    subSheetView === 'pitch'
                      ? 'rounded-md bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.25)]'
                      : 'rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white/80',
                  ].join(' ')}
                >
                  Spielfeld
                </button>
              </div>
            </div>

            <div className="shrink-0 border-b border-white/[0.07] bg-black/95 px-2 py-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold leading-none text-white">Spielerwechsel</p>
                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/40">Modus</span>
              </div>
              <p className="mt-0.5 truncate text-[10px] font-semibold leading-snug text-emerald-200/95">
                {wechselSheetPickLabels.outLabel || wechselSheetPickLabels.inLabel
                  ? `Raus ${wechselSheetPickLabels.outLabel || '…'} → Rein ${wechselSheetPickLabels.inLabel || '…'}`
                  : 'Schritt 1: Raus wählen · Schritt 2: Rein wählen'}
              </p>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 pb-0 pt-0.5">
              {subSheetView === 'list' ? (
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-1 overflow-hidden sm:gap-1.5">
                  <div className="flex min-h-0 flex-1 flex-col gap-0.5">
                    <p className="shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-red-300/95">Raus · Feld · inkl. TW</p>
                    {substitutionFieldRows.length === 0 ? (
                      <p className="shrink-0 rounded-md border border-red-500/15 bg-black/50 px-1.5 py-1 text-[10px] text-white/45">
                        Keine Feldspieler.
                      </p>
                    ) : (
                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pr-0.5">
                        <div className="flex flex-col gap-1">
                          {substitutionFieldRows.map((row) => {
                            const slot = row?.slot;
                            const pid =
                              slot && lineupSlotsForDisplay && typeof lineupSlotsForDisplay === 'object'
                                ? String(lineupSlotsForDisplay[slot] ?? '').trim()
                                : '';
                            if (!pid) return null;
                            const rosterP = rosterById.get(pid) ?? null;
                            const name = String(row?.display_name ?? rosterP?.name ?? 'Spieler').trim() || 'Spieler';
                            const shortName = mobileLineupName(name);
                            const slotBadge = String(row?.rightLabel ?? '–').trim() || '—';
                            const posLabel = getPositionLabel(row.position) || slotBadge;
                            const num = rosterP?.number ?? row?.jersey_number ?? null;
                            const selected = subOutPlayerId === pid;
                            const recOut = Boolean(subRecommendedOutId && subRecommendedOutId === pid && !selected);
                            const isGk = posLabel === 'TW' || slotBadge === 'TW';
                            return (
                              <button
                                key={`sub-out-${slot}-${pid}`}
                                type="button"
                                onClick={() => setSubOutPlayerId(pid)}
                                className={[
                                  'flex h-[58px] min-h-[54px] max-h-[62px] shrink-0 items-center gap-1 rounded-lg border px-1.5 py-0.5 text-left transition-all active:scale-[0.99]',
                                  'bg-gradient-to-br from-red-950/40 via-black/75 to-black/92',
                                  selected
                                    ? 'border-red-500 shadow-[0_0_18px_rgba(239,68,68,0.38)] ring-2 ring-red-500/50'
                                    : recOut
                                      ? 'border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/35'
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
                                    className="!h-[2.75rem] !w-[2.15rem] sm:!h-[3rem] sm:!w-[2.45rem]"
                                  />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                                  <p className="truncate text-[13px] font-bold leading-snug text-white">
                                    {shortName}
                                  </p>
                                  <span className="inline-flex w-fit rounded-md border border-red-500/35 bg-red-950/50 px-1 py-px text-[7px] font-bold uppercase tracking-wide text-red-100/95">
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
                        <div className="flex flex-col gap-1">
                          {substitutionBenchRows.map((row) => {
                            const pid = String(row?.id ?? '').trim();
                            if (!pid) return null;
                            const rosterP = rosterById.get(pid) ?? null;
                            const name = String(row?.display_name ?? rosterP?.name ?? 'Spieler').trim() || 'Spieler';
                            const shortName = mobileLineupName(name);
                            const posLabel = getPositionLabel(row.position) || '–';
                            const num = rosterP?.number ?? row?.jersey_number ?? null;
                            const selected = subInPlayerId === pid;
                            const recIn = Boolean(subRecommendedInId && subRecommendedInId === pid && !selected);
                            const isGk = posLabel === 'TW';
                            return (
                              <button
                                key={`sub-in-${pid}`}
                                type="button"
                                onClick={() => setSubInPlayerId(pid)}
                                className={[
                                  'flex h-[58px] min-h-[54px] max-h-[62px] shrink-0 items-center gap-1 rounded-lg border px-1.5 py-0.5 text-left transition-all active:scale-[0.99]',
                                  'bg-gradient-to-br from-emerald-950/25 via-black/75 to-black/92',
                                  selected
                                    ? 'border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.38)] ring-2 ring-emerald-400/55'
                                    : recIn
                                      ? 'border-emerald-400/45 shadow-[0_0_12px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/40'
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
                                    className="!h-[2.75rem] !w-[2.15rem] sm:!h-[3rem] sm:!w-[2.45rem]"
                                  />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                                  <p className="truncate text-[13px] font-bold leading-snug text-white">
                                    {shortName}
                                  </p>
                                  <span className="inline-flex w-fit rounded-md border border-amber-500/35 bg-amber-950/45 px-1 py-px text-[7px] font-bold uppercase tracking-wide text-amber-100/95">
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
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pr-0.5 pb-1">
                  {!canRenderLivePitch ? (
                    <p className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center text-[10px] text-white/50">
                      Aufstellung wird geladen …
                    </p>
                  ) : (
                    <>
                      <div className="mx-auto flex min-h-[14rem] w-full max-w-md flex-1 flex-col overflow-hidden px-0.5">
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
                          slotHighlightBySlot={wechselPitchSlotHighlight}
                          emphasizedPlayerId={null}
                          renderSlotContent={({ slot: _slot, label, playerId, isGk }) => {
                            if (!playerId) return null;
                            const player = rosterById.get(playerId) ?? null;
                            const posLabel = getPositionLabel(label) || '–';
                            const rawName = (player?.displayName ?? player?.name ?? '').trim() || 'Spieler';
                            const shortName = (() => {
                              const s = mobileLineupName(rawName);
                              return s === '—' || !s ? 'Spieler' : s;
                            })();
                            const isOutPick = String(subOutPlayerId ?? '').trim() === String(playerId).trim();
                            const recOutPitch =
                              Boolean(subRecommendedOutId) &&
                              String(subRecommendedOutId ?? '').trim() === String(playerId).trim() &&
                              !isOutPick;
                            return (
                              <div
                                className={[
                                  'pointer-events-none relative flex w-full max-w-[min(22vw,5.25rem)] flex-col items-center rounded-lg transition-[transform,box-shadow] duration-200',
                                  isOutPick
                                    ? 'shadow-[0_0_22px_rgba(239,68,68,0.55),0_0_8px_rgba(239,68,68,0.35)]'
                                    : recOutPitch
                                      ? 'shadow-[0_0_14px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/45 rounded-lg'
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
                                  className={['sm:!h-[4.1rem] sm:!w-[3.25rem]', isOutPick ? 'ring-2 ring-red-500/70' : ''].join(
                                    ' ',
                                  )}
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
                          className="min-h-[14rem] max-h-[min(52dvh,32rem)] flex-1 sm:max-h-[min(54dvh,34rem)]"
                        />
                      </div>
                      <section className="shrink-0 border-t border-white/[0.08] pt-1 transition-opacity duration-200">
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
                                const recInPitch =
                                  Boolean(subRecommendedInId) &&
                                  String(subRecommendedInId ?? '').trim() === pid &&
                                  !selected;
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
                                        : recInPitch
                                          ? 'border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.28)] ring-1 ring-emerald-400/45'
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
                </div>
              )}
            </div>

            <footer
              className="sticky bottom-0 z-[70] shrink-0 border-t border-red-500/15 bg-black/90 px-2 pt-1 backdrop-blur-md"
              style={{ paddingBottom: WECHSEL_SCREEN_FOOTER_PB }}
            >
              <div className="flex flex-row gap-1.5">
                <button
                  type="button"
                  disabled={subSaving || posSwapSaving}
                  onClick={closeWechselSheet}
                  className="flex min-h-[46px] flex-1 items-center justify-center rounded-xl border border-white/12 bg-zinc-900/95 text-[11px] font-bold text-white/85 hover:bg-zinc-800 disabled:opacity-45"
                >
                  Zurück zum Livespiel
                </button>
                <button
                  type="button"
                  disabled={
                    subSaving ||
                    posSwapSaving ||
                    !String(subOutPlayerId ?? '').trim() ||
                    !String(subInPlayerId ?? '').trim() ||
                    String(subOutPlayerId ?? '').trim() === String(subInPlayerId ?? '').trim()
                  }
                  onClick={() => void confirmSubstitution()}
                  className="flex min-h-[46px] flex-1 items-center justify-center rounded-xl bg-emerald-600 px-1 text-[11px] font-bold text-white shadow-[0_0_14px_rgba(16,185,129,0.32)] disabled:opacity-35"
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

      {posSwapConfirmOpen && posSwapSlotA && posSwapSlotB && canControlLiveMatch && !matchIsFinished ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[10060] flex flex-col justify-end"
          style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            aria-label="Abbrechen"
            disabled={posSwapSaving}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity disabled:opacity-60"
            onClick={() => {
              if (posSwapSaving) return;
              setPosSwapConfirmOpen(false);
              setPosSwapSlotA(null);
              setPosSwapSlotB(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-swap-confirm-title"
            className="relative z-[1] mx-auto mb-0 w-[min(100%,24rem)] rounded-2xl border border-red-500/40 bg-gradient-to-b from-zinc-950/98 via-zinc-950/95 to-black px-3 pb-4 pt-3 shadow-[0_0_32px_rgba(239,68,68,0.35),0_-12px_40px_rgba(0,0,0,0.75)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-white/18" />
            <h3
              id="pos-swap-confirm-title"
              className="text-center text-[13px] font-black uppercase tracking-[0.12em] text-white sm:text-sm"
            >
              Positionen tauschen?
            </h3>
            <p className="mt-2 text-center text-[13px] font-semibold leading-snug text-white/85 sm:text-[14px]">
              {posSwapConfirmLabels.a} ↔ {posSwapConfirmLabels.b}
            </p>
            <div className="mt-4 flex min-h-[48px] flex-row gap-2">
              <button
                type="button"
                disabled={posSwapSaving}
                onClick={() => {
                  setPosSwapConfirmOpen(false);
                  setPosSwapSlotA(null);
                  setPosSwapSlotB(null);
                }}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-white/14 bg-zinc-900/90 text-[12px] font-bold text-white/88 backdrop-blur-sm hover:bg-zinc-800 disabled:opacity-45"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={posSwapSaving || matchIsFinished}
                onClick={() => void confirmPositionSwap()}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-red-600 px-2 text-[12px] font-black text-white shadow-[0_0_18px_rgba(220,38,38,0.5)] disabled:opacity-40"
              >
                {posSwapSaving ? '…' : 'Tauschen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canControlLiveMatch && fairPlayExtraSheetOpen && !matchIsFinished ? (
        <div
          className={FAIRPLAY_SHEET_OVERLAY}
          role="presentation"
          onClick={() => {
            if (fairPlayExtraSaving) return;
            closeFairPlayExtraSheet();
          }}
        >
          <div
            className="mx-auto flex w-full max-w-lg max-h-[min(70dvh,34rem)] flex-col overflow-y-auto rounded-t-2xl border border-amber-500/25 bg-gradient-to-b from-amber-950/45 via-black to-black text-white shadow-[0_-8px_40px_rgba(0,0,0,0.72)]"
            style={{ marginBottom: FAIRPLAY_SHEET_BOTTOM_OFFSET }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fairplay-extra-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-1.5 h-1 w-8 shrink-0 rounded-full bg-amber-400/40" aria-hidden />
            <div className="shrink-0 border-b border-white/[0.07] px-3 py-1.5">
              <h3
                id="fairplay-extra-title"
                className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-200/95"
              >
                {fairPlayExtraPickId ? 'FairPlay bestätigen' : 'Zusatzspieler'}
              </h3>
              {!fairPlayExtraPickId ? (
                <p className="mt-0.5 text-[12px] font-medium text-white/55">Spieler von der Bank wählen</p>
              ) : null}
            </div>
            {fairPlayExtraPickId ? (
              <>
                <div className="shrink-0 px-3 py-2.5">
                  <p className="text-center text-[15px] font-bold leading-snug text-white">
                    {mobileLineupName(rosterById.get(fairPlayExtraPickId)?.name ?? 'Spieler')}
                  </p>
                  <p className="mt-1 text-center text-[12px] font-medium leading-snug text-white/65">
                    als Zusatzspieler am Feld einsetzen?
                  </p>
                </div>
                <footer
                  className="sticky bottom-0 z-10 shrink-0 border-t border-amber-500/20 bg-black/95 px-3 pt-2 backdrop-blur-md"
                  style={{ paddingBottom: LIVE_SHEET_FOOTER_SAFE_PB }}
                >
                  <button
                    type="button"
                    disabled={fairPlayExtraSaving}
                    onClick={() => void runPersistFairPlayExtraOn()}
                    className="flex min-h-[52px] w-full touch-manipulation items-center justify-center rounded-xl border border-amber-300/55 bg-amber-500 text-[15px] font-black text-black shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-[0.99] disabled:opacity-45"
                  >
                    {fairPlayExtraSaving ? '…' : 'Zusatzspieler einsetzen'}
                  </button>
                  <button
                    type="button"
                    disabled={fairPlayExtraSaving}
                    onClick={() => setFairPlayExtraPickId(null)}
                    className="mt-2 flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl border border-white/14 bg-zinc-900/90 text-sm font-bold text-white/88 active:scale-[0.99] disabled:opacity-45"
                  >
                    Zurück zur Auswahl
                  </button>
                </footer>
              </>
            ) : (
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-1.5 [-webkit-overflow-scrolling:touch]"
                style={{ paddingBottom: FAIRPLAY_SHEET_LIST_BOTTOM_PAD }}
              >
                {benchPlayers.length === 0 ? (
                  <p className="py-4 text-center text-sm text-white/50">Keine Bankspieler.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {benchPlayers.map((p) => {
                      const shortName = mobileLineupName(p.name);
                      const posLabel = getPositionLabel(p.position ?? '') || '–';
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFairPlayExtraPickId(p.id)}
                          className="flex min-h-[64px] items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-2 py-2 text-left transition-transform active:scale-[0.99]"
                        >
                          <div className="pointer-events-none shrink-0">
                            <LeibchenJersey
                              lastName={shortName === '—' || !shortName ? 'Spieler' : shortName}
                              number={p.number ?? '–'}
                              position={posLabel}
                              variant="field"
                              size="compact"
                              pitchStyleBack
                              className="!h-[3.2rem] !w-[2.55rem]"
                            />
                          </div>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {canControlLiveMatch && fairPlayRemoveSheetOpen && fairPlayExtraPlayerId && !matchIsFinished ? (
        <div
          className={FAIRPLAY_SHEET_OVERLAY}
          role="presentation"
          onClick={() => {
            if (fairPlayRemoveSaving) return;
            closeFairPlayRemoveSheet();
          }}
        >
          <div
            className="relative z-[1] mx-auto flex w-full max-w-lg max-h-[min(70dvh,34rem)] flex-col overflow-y-auto rounded-t-2xl border border-red-500/35 bg-gradient-to-b from-red-950/40 via-black to-black text-white shadow-[0_-8px_40px_rgba(0,0,0,0.72)]"
            style={{ marginBottom: FAIRPLAY_SHEET_BOTTOM_OFFSET }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fairplay-remove-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-1.5 h-1 w-8 shrink-0 rounded-full bg-red-400/40" aria-hidden />
            <div className="shrink-0 border-b border-white/[0.07] px-3 py-1.5">
              <h3
                id="fairplay-remove-title"
                className="text-[11px] font-black uppercase tracking-[0.14em] text-red-300/95"
              >
                {fairPlayRemovePickId ? 'Entfernen bestätigen' : 'Spieler vom Feld'}
              </h3>
              {!fairPlayRemovePickId ? (
                <p className="mt-0.5 text-[12px] font-medium text-white/55">
                  {fairPlayMustRemoveExtra
                    ? 'Ein Spieler muss vom Feld — Zusatzspieler darf bleiben'
                    : 'Feldspieler wählen, der auf die Bank geht'}
                </p>
              ) : null}
            </div>
            {fairPlayRemovePickId ? (
              <>
                <div className="shrink-0 px-3 py-2.5">
                  <p className="text-center text-[15px] font-bold leading-snug text-white">
                    {mobileLineupName(rosterById.get(fairPlayRemovePickId)?.name ?? 'Spieler')}
                  </p>
                  <p className="mt-1 text-center text-[12px] font-medium leading-snug text-white/65">
                    {String(fairPlayRemovePickId).trim() === String(fairPlayExtraPlayerId ?? '').trim()
                      ? 'Zusatzspieler verlässt das Feld (7/7)'
                      : 'verlässt das Feld — Zusatzspieler bleibt am Feld'}
                  </p>
                </div>
                <footer
                  className="sticky bottom-0 z-10 shrink-0 border-t border-red-500/20 bg-black/95 px-3 pt-2 backdrop-blur-md"
                  style={{ paddingBottom: LIVE_SHEET_FOOTER_SAFE_PB }}
                >
                  <button
                    type="button"
                    disabled={fairPlayRemoveSaving}
                    onClick={() => void runPersistFairPlayExtraOff()}
                    className="flex min-h-[52px] w-full touch-manipulation items-center justify-center rounded-xl bg-red-600 text-[15px] font-black text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-[0.99] disabled:opacity-40"
                  >
                    {fairPlayRemoveSaving ? '…' : 'Vom Feld nehmen'}
                  </button>
                  <button
                    type="button"
                    disabled={fairPlayRemoveSaving}
                    onClick={() => setFairPlayRemovePickId(null)}
                    className="mt-2 flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-xl border border-white/14 bg-zinc-900/90 text-sm font-bold text-white/88 active:scale-[0.99] disabled:opacity-45"
                  >
                    Zurück zur Auswahl
                  </button>
                </footer>
              </>
            ) : (
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-1.5 [-webkit-overflow-scrolling:touch]"
                style={{ paddingBottom: FAIRPLAY_SHEET_LIST_BOTTOM_PAD }}
              >
                {fairPlayRemoveFieldRows.length === 0 ? (
                  <p className="py-4 text-center text-sm text-white/50">Keine Feldspieler.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {fairPlayRemoveFieldRows.map((p) => {
                      const shortName = mobileLineupName(p.name);
                      const posLabel = getPositionLabel(p.position ?? '') || '–';
                      const isExtra = String(p.id).trim() === String(fairPlayExtraPlayerId ?? '').trim();
                      return (
                        <button
                          key={`fairplay-remove-pick-${p.id}`}
                          type="button"
                          onClick={() => setFairPlayRemovePickId(p.id)}
                          className="flex min-h-[64px] items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-2 py-2 text-left transition-transform active:scale-[0.99]"
                        >
                          <div className="pointer-events-none shrink-0">
                            <LeibchenJersey
                              lastName={shortName === '—' || !shortName ? 'Spieler' : shortName}
                              number={p.number ?? '–'}
                              position={posLabel}
                              variant="field"
                              size="compact"
                              pitchStyleBack
                              className="!h-[3.2rem] !w-[2.55rem]"
                            />
                          </div>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">
                            {p.name}
                            {isExtra ? (
                              <span className="ml-1 text-[10px] font-semibold text-amber-300/90">Zusatz</span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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
              disabled={!homeGoalPickId || !isClockRunning}
              onClick={async () => {
                if (!homeGoalPickId || !effectiveMatchId) return;
                if (!isClockRunning) {
                  setSaveError(goalBlockedMessage);
                  return;
                }
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
              disabled={!awayGoalPickId || !isClockRunning}
              onClick={async () => {
                if (!awayGoalPickId || !effectiveMatchId) return;
                if (!isClockRunning) {
                  setSaveError(goalBlockedMessage);
                  return;
                }
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

      {pauseConfirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto overscroll-y-contain bg-black/85 px-4 pt-[max(3rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:py-6"
          role="presentation"
          onClick={() => {
            if (!pauseConfirmSaving) setPauseConfirmOpen(false);
          }}
        >
          <div
            className="my-auto flex w-full max-w-md max-h-[82dvh] flex-col overflow-hidden rounded-2xl border-2 border-emerald-700/55 bg-zinc-950 shadow-[0_0_40px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-confirm-title"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
              <h3 id="pause-confirm-title" className="text-2xl font-black leading-tight tracking-tight text-white">
                Pause aktivieren?
              </h3>
              <p className="mt-2 text-[15px] font-medium leading-snug text-zinc-300 sm:text-base">
                Das aktuelle Drittel wird abgeschlossen und der Zwischenstand wird übernommen.
              </p>
            </div>
            <div
              className="sticky bottom-0 z-10 shrink-0 border-t border-white/[0.06] bg-zinc-950 px-4 pt-2.5 sm:px-5"
              style={{
                paddingBottom: 'max(12px, calc(env(safe-area-inset-bottom, 0px) + 5.25rem))',
              }}
            >
              <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-stretch">
                <button
                  type="button"
                  className="flex h-14 min-h-14 min-w-0 flex-1 items-center justify-center rounded-xl border border-white/12 bg-zinc-950 px-3 text-sm font-semibold text-zinc-300 shadow-none active:scale-[0.99] disabled:opacity-45"
                  disabled={pauseConfirmSaving}
                  onClick={() => setPauseConfirmOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="flex h-14 min-h-14 min-w-0 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-emerald-700 to-emerald-950 px-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_22px_rgba(16,185,129,0.28)] active:scale-[0.99] disabled:opacity-45"
                  disabled={pauseConfirmSaving}
                  onClick={() => void executeConfirmedPause()}
                >
                  {pauseConfirmSaving ? '…' : 'Pause aktivieren'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {endeConfirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto overscroll-y-contain bg-black/85 px-4 pt-[max(3rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:py-6"
          role="presentation"
          onClick={() => setEndeConfirmOpen(false)}
        >
          <div
            className="my-auto flex w-full max-w-md max-h-[82dvh] flex-col overflow-hidden rounded-2xl border-2 border-red-500/55 bg-zinc-950 shadow-[0_0_40px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ende-match-title"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
              <h3 id="ende-match-title" className="text-2xl font-black leading-tight tracking-tight text-white">
                Spiel beenden?
              </h3>
              <p className="mt-2 text-[15px] font-medium leading-snug text-zinc-300 sm:text-base">
                Die Uhr stoppt, der Live-Modus endet und der Endstand wird gespeichert. Anschließend kannst du den Kalender-Termin mit{' '}
                <span className="font-semibold text-white">Spiel abschließen</span> abschließen.
              </p>
            </div>
            <div
              className="sticky bottom-0 z-10 shrink-0 border-t border-white/[0.06] bg-zinc-950 px-4 pt-2.5 sm:px-5"
              style={{
                paddingBottom: 'max(12px, calc(env(safe-area-inset-bottom, 0px) + 5.25rem))',
              }}
            >
              <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-stretch">
                <button
                  type="button"
                  className="flex h-14 min-h-14 min-w-0 flex-1 items-center justify-center rounded-xl border border-white/12 bg-zinc-950 px-3 text-sm font-semibold text-zinc-300 shadow-none active:scale-[0.99]"
                  onClick={() => setEndeConfirmOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="flex h-14 min-h-14 min-w-0 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-red-600 to-red-950 px-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_22px_rgba(220,38,38,0.38)] active:scale-[0.99]"
                  onClick={async () => {
                    setEndeConfirmOpen(false);
                    await persistMatchEndWithoutCalendar();
                  }}
                >
                  Ende
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {spielAbschlussOpen && (
        <div
          className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto overscroll-y-contain bg-black/85 px-4 pt-[max(3rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:py-6"
          role="presentation"
          onClick={() => setSpielAbschlussOpen(false)}
        >
          <div
            className="my-auto flex w-full max-w-md max-h-[82dvh] flex-col overflow-hidden rounded-2xl border-2 border-amber-500/45 bg-zinc-950 shadow-[0_0_40px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spiel-abschluss-title"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
              <h3 id="spiel-abschluss-title" className="text-2xl font-black leading-tight tracking-tight text-white">
                Kalender abschließen?
              </h3>
              <p className="mt-2 text-[15px] font-medium leading-snug text-zinc-300 sm:text-base">
                Der verknüpfte Termin wird im Spielplan als beendet markiert. Danach wechselt die Ansicht zur App-Übersicht.
              </p>
            </div>
            <div
              className="sticky bottom-0 z-10 shrink-0 border-t border-white/[0.06] bg-zinc-950 px-4 pt-2.5 sm:px-5"
              style={{
                paddingBottom: 'max(12px, calc(env(safe-area-inset-bottom, 0px) + 5.25rem))',
              }}
            >
              <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-stretch">
                <button
                  type="button"
                  className="flex h-14 min-h-14 min-w-0 flex-1 items-center justify-center rounded-xl border border-white/12 bg-zinc-950 px-3 text-sm font-semibold text-zinc-300 shadow-none active:scale-[0.99]"
                  onClick={() => setSpielAbschlussOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="flex h-14 min-h-14 min-w-0 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-amber-600 to-amber-950 px-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_22px_rgba(245,158,11,0.32)] active:scale-[0.99]"
                  onClick={() => void finalizeCalendarForMatch()}
                >
                  Abschließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
  );
};

export default LiveMatchScreen;
