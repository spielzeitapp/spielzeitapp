Warning: truncated output (original token count: 82307)
Total output lines: 7354

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { usePlayers, type PlayerItem } from '../../hooks/usePlayers';
import { PlayerProfileModal } from '../../components/team/PlayerProfileModal';
import {
  LivePageHeader,
  LivePremiumShell,
  LiveScheduleCtaLink,
} from '../../components/live/LivePremiumShell';
import { PremiumEmptyState } from '../../ui';
import { canManageRoster, normalizeRole } from '../../lib/roles';
import { useMatchTimer } from '../../hooks/useMatchTimer';
import { useResetScrollOnLiveEntry } from '../../hooks/useResetScrollOnLiveEntry';
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
  swapTwoOccupiedFieldSlots,
  type MatchEngineEvent,
  type MatchEventType,
} from '../../lib/matchEngine';
import {
  engineEventToInsertPayload,
  fetchEventIsHomeByMatchId,
  fetchFirstLiveMatch,
  ensureKickoffLineupSnapshot,
  fetchKickoffLineupPlayerIds,
  fetchLineupForLiveMatch,
  fetchMatchById,
  deleteMatchEventById,
  fetchMatchEvents,
  getMatchLiveClockStatus,
  LIVE_FIELD_SLOT_ORDER,
  persistExtraPlayerOff,
  persistExtraPlayerOn,
  persistFairPlayExtraSessionTransfer,
  lineupPersistInProgress,
  persistLiveLineupAndBenchSafe,
  repairLiveMatchLineupBenchIfNeeded,
  syncFinalLineupBenchFromEventReplay,
  persistPositionSwap,
  saveMatchEvent,
  updateGoalScorer,
  updateSubstitutionPlayers,
  updateMatchRow,
  matchEventDbRowToEngine,
  type LiveMatchRow,
} from '../../lib/liveMatchService';
import { ensureLiveFeedPostForMatch } from '../../lib/ensureLiveFeedPost';
import { forceReleaseBodyScrollLocks, lockBodyScroll } from '../../lib/bodyScrollLock';
import { getMatchSides } from '../../lib/matchSides';
import {
  DEFAULT_MINIMUM_PLAYTIME_MINUTES,
  formatMinimumPlaytimeProgress,
  formatMissingMinutesLabel,
  getMinimumPlaytimePlayerStatus,
  getMinimumPlaytimeUrgency,
  getPlannedMatchDurationSeconds,
  getRemainingEffectiveMatchSeconds,
  isBelowMinimumPlaytime,
  isMinimumPlaytimeUrgent,
  minimumPlaytimeSecondsFromMinutes,
  minimumPlaytimeUrgencyRank,
  DEFAULT_PLANNED_MATCH_MINUTES,
  normalizeMinimumPlaytimeMinutes,
  normalizePlannedMatchMinutes,
  type MinimumPlaytimeUrgency,
} from '../../lib/minimumPlaytime';
import { countOccupiedFieldSlots } from '../../lib/liveLineupNormalize';
import { LineupFormationPitch } from '../../components/match/LineupFormationPitch';
import { LeibchenJersey } from '../../components/match/LeibchenJersey';
import { PremiumPlayerCard } from '../../components/player/PremiumPlayerCard';
import {
  DS_JERSEY_COMPACT,
  DS_JERSEY_STARTER,
  DS_LIST_GAP,
  dsCardTitleClass,
  dsLineupViewTabClass,
  dsMetaTextClass,
  dsPageAtmosphereAbsoluteClass,
  dsPlayerNameClass,
  dsPrimaryCtaClass,
  dsSecondaryCtaClass,
  dsSegmentTabClass,
  dsSegmentTrackClass,
  dsWechselColumnAmbientClass,
  dsWechselPickRowClass,
  dsLiveHubNavBtnClass,
} from '../../lib/premiumDesignSystem';
import { matchdayBenchTileClass } from '../../lib/matchdayPlayerCard';
import {
  auditFormationSlotLayout,
  FAIRPLAY_FORMATION_CHOICES,
  isFairPlayFormationId,
  isU11FormationId,
  labelForSlotInFormation,
  resolveLivePitchFormationId,
  U11_FORMATION_CHOICES,
  U11_FORMATIONS,
  U11_FORMATION_DB_FALLBACK,
  type U11FormationId,
} from '../../lib/matchFormations';
import type { FieldSlotId } from '../../types/match';
import { compareRosterPlayers, playerItemToRoster, type RosterPlayer } from '../../lib/rosterPlayer';
import { getPositionFull, getPositionLabel } from '../../lib/positionLabels';
import { supabase } from '../../lib/supabaseClient';
import { getClubLogo, getOurTeamDisplayName } from '../../lib/teamLogos';
import { isValidLogoUrl } from '../../utils/logoResolver';
import { ensureResultFeedPostForMatch } from '../../lib/ensureResultFeedPost';
import {
  fetchTournamentMatchNavigationContext,
  type TournamentMatchNavigationContext,
} from '../../lib/tournamentMatchNavigation';
import { TournamentNextMatchWorkflowCta } from '../../components/tournament/TournamentNextMatchWorkflowCta';
import { syncOfficialPlanAfterTournamentMatchFinish } from '../../lib/tournamentPlanSync';
import { broadcastLiveMatchStateChanged, subscribeLiveMatchStateChanged } from '../../lib/liveMatchBroadcast';
import { useDemoMode } from '../../demo/DemoContext';
import { useInternalBasePath } from '../../demo/demoPaths';
import { getDemoMatchLite } from '../../demo/demoMatchState';
import { getDemoTournamentEventIdForMatch } from '../../demo/demoTournamentState';
import {
  isDemoLiveCalendarFinalized,
  markDemoLiveCalendarFinalized,
  getDemoLiveEventRows,
  getDemoLiveMatchRow,
} from '../../demo/demoLiveRuntime';
import {
  DEMO_TOUR_FINISH_MATCH_EVENT,
  DEMO_TOUR_FOCUS_PLAYTIME_EVENT,
} from '../../demo/demoTourActions';

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
  '1-3-3-1': 'FairPlay · 3-3 + FP',
  '1-4-3': 'FairPlay · 4er Kette',
  '1-3-4': 'FairPlay · 4 vorne',
};

/** Mini-Pitch mit Slot-Punkten für Formation-Karten im Coach-Sheet. */
function MiniFormationPitchPreview({
  formationId,
  active = false,
  className,
}: {
  formationId: U11FormationId;
  active?: boolean;
  className?: string;
}) {
  const slots = U11_FORMATIONS[formationId];
  return (
    <div
      className={[
        'relative h-[3.25rem] w-[2.85rem] shrink-0 overflow-hidden rounded-lg border bg-gradient-to-b from-emerald-950/55 via-zinc-950/90 to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]',
        active ? 'border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.18)]' : 'border-white/12',
        className ?? '',
      ].join(' ')}
      aria-hidden
    >
      <div className="absolute inset-[9%] rounded-lg border border-white/12 bg-emerald-950/35" />
      <div className="absolute left-1/2 top-[18%] h-[32%] w-[42%] -translate-x-1/2 rounded-full border border-white/10" />
      {slots.map((s) => (
        <span
          key={s.slot}
          className={[
            'absolute h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full border',
            s.slot === 'GK'
              ? 'border-amber-200/80 bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.45)]'
              : active
                ? 'border-emerald-100/90 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.55)]'
                : 'border-white/45 bg-white/90',
          ].join(' ')}
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
        />
      ))}
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
    ? `min-h-[1em] text-[9px] font-semibold uppercase leading-tight tracking-[0.14em] text-white/52 sm:text-[10px] ${textAlign}`
    : `min-h-[1em] text-xs font-medium uppercase leading-tight tracking-widest text-white/75 ${textAlign}`;
  const clubCls = tight
    ? `mt-0.5 text-[11px] font-medium leading-snug text-white/62 sm:text-xs ${textAlign}`
    : `mt-1 text-lg font-semibold leading-snug text-white/80 sm:text-xl md:text-2xl ${textAlign}`;
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
const hubNavBtn = dsLiveHubNavBtnClass();
const liveModuleBackBar =
  'sticky top-0 z-40 mt-0 flex min-h-[48px] shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-black/85 px-2 py-2 backdrop-blur-md sm:px-3';

const liveCardShell =
  'rounded-[22px] border border-[rgba(255,40,40,0.07)] bg-[rgba(10,10,14,0.97)] shadow-[0_8px_28px_rgba(0,0,0,0.42),0_0_20px_rgba(255,45,85,0.05)]';

const mbBtnH = 'h-10 min-h-10';
const mbRound = 'rounded-xl';
const mbRowBtn = `flex ${mbBtnH} touch-manipulation items-center justify-center gap-1.5 ${mbRound} px-3 text-xs font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40`;

/** BottomNav (~76px) + Safe Area — Live-Sheets/Confirm über Nav & Safari-Bar */
const LIVE_SHEET_BOTTOM_CLEARANCE = 'calc(4.75rem + env(safe-area-inset-bottom, 0px))';
const LIVE_SHEET_FOOTER_SAFE_PB = 'max(0.75rem, env(safe-area-inset-bottom, 0px))';
/** Sheet-CTA: BottomNav + Safari Home-Indicator */
const LIVE_SHEET_FOOTER_CONFIRM_SAFE_PB = 'calc(120px + env(safe-area-inset-bottom, 0px))';
/** Formation-Sheet: nur Home-Indicator, kein BottomNav-Offset */
const FORMATION_SHEET_FOOTER_PB = 'max(0.65rem, env(safe-area-inset-bottom, 0px))';
const LIVE_SHEET_MAX_HEIGHT = 'min(80dvh, 40rem)';
const LIVE_SCROLL_BOTTOM_PAD = 'calc(140px + env(safe-area-inset-bottom, 0px))';
/** FairPlay-Sheets über BottomNav (~96px + Safe Area) */
const FAIRPLAY_SHEET_BOTTOM_OFFSET = 'calc(96px + env(safe-area-inset-bottom, 0px))';
const FAIRPLAY_SHEET_MAX_HEIGHT = 'min(70dvh, 34rem)';
const FAIRPLAY_SHEET_LIST_BOTTOM_PAD = 'calc(120px + env(safe-area-inset-bottom, 0px))';
const LIVE_HUB_SCROLL_BOTTOM_PAD = 'calc(170px + env(safe-area-inset-bottom, 0px))';
const FAIRPLAY_SHEET_OVERLAY =
  'fixed inset-0 z-[10000] flex flex-col justify-end bg-black/80 backdrop-blur-sm';
/** Wechsel-Sheet: direkt unter App-Header + über BottomNav (~78px) */
const WECHSEL_SHEET_TOP_OFFSET = 'calc(80px + env(safe-area-inset-top, 0px))';
const WECHSEL_SHEET_BOTTOM_OFFSET = 'calc(78px + env(safe-area-inset-bottom, 0px))';
/** Wechsel: eigener Screen unter App-Header, über Hub (opaque, kein Hub-Scroll) */
const WECHSEL_SCREEN_SHELL =
  'fixed inset-x-0 z-[40] flex min-h-0 flex-col overflow-hidden border-t border-red-500/30 bg-black text-white';
/** Spielfeld-Tab: Scroll-Ende über Footer/BottomNav */
const WECHSEL_PITCH_TAB_SCROLL_BOTTOM_PAD = 'calc(150px + env(safe-area-inset-bottom, 0px))';
/** Aufstellung: Pitch + Bank — Abstand über BottomNav (Live + Startelf) */
const LINEUP_CONTENT_SCROLL_BOTTOM_PAD = 'calc(182px + env(safe-area-inset-bottom, 0px))';
/** Footer im Screen — BottomNav-Abstand kommt vom Screen-bottom (78px) */
const WECHSEL_SCREEN_FOOTER_PB = 'max(0.5rem, env(safe-area-inset-bottom, 0px))';
/** Wechsel-Content: Abstand am Scroll-Ende über dem sticky Footer */
const WECHSEL_CONTENT_SCROLL_BOTTOM_PAD = 'max(0.75rem, env(safe-area-inset-bottom, 0px))';
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

function substitutionPlayersBeforeEvent(params: {
  kickoffPlayerIds: string[];
  squadPlayerIds: string[];
  savedBenchPlayerIds: string[];
  events: MatchEngineEvent[];
  eventId: string;
  eventTimestamp: number;
}): { fieldPlayerIds: string[]; benchPlayerIds: string[] } {
  const sorted = sortMatchEventsChronologically(params.events);
  const eventIndex = sorted.findIndex((event) => event.id === params.eventId);
  const eventsBefore = eventIndex >= 0 ? sorted.slice(0, eventIndex) : [];
  const replay = replaySubstitutionEventsOnSlots(
    params.kickoffPlayerIds,
    eventsBefore,
    params.eventTimestamp,
    { squadPlayerIds: params.squadPlayerIds },
  );
  const fieldPlayerIds = getOnFieldIdsInSlotOrder(replay.slots);
  return {
    fieldPlayerIds,
    benchPlayerIds: getBenchPlayers(
      params.squadPlayerIds,
      fieldPlayerIds,
      params.savedBenchPlayerIds,
    ),
  };
}

function firstInvalidAtomicSubstitution(params: {
  kickoffPlayerIds: string[];
  squadPlayerIds: string[];
  events: MatchEngineEvent[];
}): MatchEngineEvent | null {
  const sorted = sortMatchEventsChronologically(params.events);
  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    if (event.type !== 'substitution') continue;
    const replayBefore = replaySubstitutionEventsOnSlots(
      params.kickoffPlayerIds,
      sorted.slice(0, index),
      event.timestamp,
      { squadPlayerIds: params.squadPlayerIds },
    );
    const fieldIds = new Set(getOnFieldIdsInSlotOrder(replayBefore.slots));
    const outId = String(event.playerId ?? '').trim();
    const inId = String(event.swapWithPlayerId ?? '').trim();
    if (!outId || !inId || outId === inId || !fieldIds.has(outId) || fieldIds.has(inId)) {
      return event;
    }
  }
  return null;
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

/** Kurzcode → volle Positionsbezeichnung (Matchday-Squad, lesbare Schreibweise). */
const KICKOFF_POSITION_FULL_DE: Record<string, string> = {
  TW: 'Torwart',
  GK: 'Torwart',
  LV: 'Linksverteidiger',
  LB: 'Linksverteidiger',
  RV: 'Rechtsverteidiger',
  RB: 'Rechtsverteidiger',
  ZM: 'Zentrales Mittelfeld',
  CM: 'Zentrales Mittelfeld',
  LF: 'Linker Flügel',
  RF: 'Rechter Flügel',
  LM: 'Linker Flügel',
  RM: 'Rechter Flügel',
  LW: 'Linker Flügel',
  RW: 'Rechter Flügel',
  ST: 'Stürmer',
  VT: 'Verteidiger',
  IV: 'Innenverteidiger',
  MF: 'Mittelfeld',
  FP: 'Fairplay',
};

function kickoffPositionParts(
  shortLabel: string,
  rosterPosition?: string | null,
): { short: string; full: string } {
  const rosterShort = rosterPosition
    ? (getPositionLabel(rosterPosition) || String(rosterPosition)).trim().toUpperCase()
    : '';
  let short = (shortLabel || rosterShort || '').trim().toUpperCase();
  if (!short || short === '–' || short === '-') short = rosterShort;
  if (!short || short === '–' || short === '-') short = '–';
  let full = KICKOFF_POSITION_FULL_DE[short];
  if (!full && rosterPosition) {
    const fromRoster = getPositionFull(rosterPosition).trim();
    if (fromRoster) full = fromRoster;
  }
  if (!full || full === '–') full = short === '–' ? 'Position' : short;
  return { short, full };
}

const LINEUP_HUB_TAB_BTN =
  'inline-flex h-[34px] shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-[22px] border border-white/[0.08] bg-[rgba(12,12,16,0.88)] px-3 text-[13px] font-semibold text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition-all duration-200 hover:border-[rgba(255,75,92,0.2)] hover:bg-[rgba(16,12,14,0.92)] hover:text-white active:scale-[0.985]';

const LINEUP_TRAINER_ACTION_BTN =
  'inline-flex h-[38px] shrink-0 items-center justify-center whitespace-nowrap rounded-2xl border px-3 text-[11px] font-semibold uppercase tracking-[0.03em] transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:text-xs';

/** Live-Pitch: Badge unter Trikot; nutzt formationsspezifische labelDx/labelDy (nur UI). */
function liveLineupPitchNameOffset(
  slot: FieldSlotId,
  formationId: U11FormationId,
): { dx: number; dy: number } {
  const row = (U11_FORMATIONS[formationId] ?? []).find((s) => s.slot === slot);
  const dx = row?.labelDx ?? 0;
  const baseDy = row?.labelDy ?? 0;
  const y = row?.y ?? 50;

  let addDy = 2;
  if (slot === 'GK') {
    addDy = 1;
  } else if (y <= 20) {
    addDy = 1;
  } else if (y >= 66) {
    addDy = 3;
  }

  return { dx, dy: baseDy + addDy };
}

/** Startelf-Liste: Scroll-Puffer über BottomNav */
const KICKOFF_LINEUP_SCROLL_BOTTOM_PAD = LINEUP_CONTENT_SCROLL_BOTTOM_PAD;

/** Trikot-Badge für Startaufstellung — gleiche Komponente/Props wie Pitch & Live-Bank. */
function KickoffSquadJerseyBadge({
  name,
  positionLabel,
  jerseyNumber,
  compact = false,
  matchday = true,
}: {
  name: string;
  positionLabel: string;
  jerseyNumber: number | string | null | undefined;
  compact?: boolean;
  matchday?: boolean;
}) {
  const posUpper = positionLabel.trim().toUpperCase();
  const isGk = posUpper === 'TW' || posUpper === 'GK';
  const shortName = mobileLineupName(name);
  const lastName =
    shortName && shortName !== '—' ? shortName : (name.trim().split(/\s+/).filter(Boolean).pop() ?? name);
  const jerseyClass = matchday ? (compact ? DS_JERSEY_COMPACT : DS_JERSEY_STARTER) : compact ? '!h-[2.65rem] !w-[2.05rem]' : '!h-[2.85rem] !w-[2.2rem]';
  const jerseyPx = matchday
    ? compact
      ? { h: '2.92rem', w: '2.29rem' }
      : { h: '3.08rem', w: '2.42rem' }
    : compact
      ? { h: '2.65rem', w: '2.05rem' }
      : { h: '2.85rem', w: '2.2rem' };

  return (
    <div
      className={[
        'flex shrink-0 items-center justify-center overflow-visible',
        matchday ? 'opacity-90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.38),0_0_16px_rgba(255,40,40,0.1)]' : '',
      ].join(' ')}
      style={{ width: jerseyPx.w, height: jerseyPx.h, minWidth: jerseyPx.w, minHeight: jerseyPx.h }}
      aria-hidden
    >
      <LeibchenJersey
        lastName={lastName}
        number={jerseyNumber ?? '–'}
        position={positionLabel}
        variant={isGk ? 'goalkeeper' : 'field'}
        size="compact"
        pitchStyleBack
        showBackPrint={false}
        className={`shrink-0 ${jerseyClass}`}
      />
    </div>
  );
}

type KickoffRosterPlayerCardProps = {
  name: string;
  positionShort: string;
  rosterPosition?: string | null;
  jerseyNumber: number | string | null | undefined;
  avatarUrl: string | null | undefined;
  variant: 'starter' | 'bench';
  onClick?: () => void;
};

function KickoffRosterPlayerCard({
  name,
  positionShort,
  rosterPosition,
  jerseyNumber,
  avatarUrl,
  variant,
  onClick,
}: KickoffRosterPlayerCardProps) {
  const isStarter = variant === 'starter';
  const { short: posShort, full: posFull } = kickoffPositionParts(positionShort, rosterPosition);
  const subline = `${posShort} · ${posFull}`;
  const num =
    typeof jerseyNumber === 'number'
      ? jerseyNumber
      : typeof jerseyNumber === 'string' && jerseyNumber.trim()
        ? Number(jerseyNumber)
        : undefined;

  return (
    <PremiumPlayerCard
      tone="matchday"
      active={isStarter}
      player={{
        display_name: name,
        position: positionShort,
        jersey_number: Number.isFinite(num) ? num : undefined,
        avatar_url: avatarUrl ?? undefined,
      }}
      subline={subline}
      density="compact"
      onClick={onClick}
      className={isStarter ? '' : 'opacity-[0.94]'}
      trailing={
        <KickoffSquadJerseyBadge
          name={name}
          positionLabel={posShort}
          jerseyNumber={jerseyNumber}
          compact={!isStarter}
          matchday
        />
      }
    />
  );
}

export const LiveMatchScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const matchIdParam = searchParams.get('matchId');
  /** DEMO.2F: gleicher Screen unter /demo, aber gegen die lokale Runtime statt Supabase. */
  const demo = useDemoMode();
  const isDemo = Boolean(demo);
  const basePath = useInternalBasePath();

  const [effectiveMatchId, setEffectiveMatchId] = useState<string | null>(null);
  const [matchRow, setMatchRow] = useState<LiveMatchRow | null>(null);
  const [lineupData, setLineupData] = useState<{
    startingPlayerIds: string[];
    squadPlayerIds: string[];
    savedBenchPlayerIds: string[];
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [squadPlayerIds, setSquadPlayerIds] = useState<string[]>([]);
  const [savedBenchPlayerIds, setSavedBenchPlayerIds] = useState<string[]>([]);
  const [startingPlayerIds, setStartingPlayerIds] = useState<string[]>([]);
  /** Kickoff-Feld aus `match_lineup_snapshots` — einzige Basis für Live-Wechsel-Replay (nicht mutierendes DB-Lineup). */
  const [kickoffStartingPlayerIds, setKickoffStartingPlayerIds] = useState<string[]>([]);
  const [initialStartingPlayerIds, setInitialStartingPlayerIds] = useState<string[]>([]);
  const [events, setEvents] = useState<MatchEngineEvent[]>([]);
  const [opponentLabel, setOpponentLabel] = useState('Gegner');
  const [opponentLogoUrl, setOpponentLogoUrl] = useState<string | null>(null);
  const [eventIsHome, setEventIsHome] = useState<boolean | null>(null);
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);

  const { selectedTeamSeason, canAccess, backendRole } = useSession();
  const canControlLiveMatch =
    isDemo || canAccess('match_admin') || String(backendRole ?? '').trim().toLowerCase() === 'admin';

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
          setOpponentLogoUrl(null);
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
        setOpponentLogoUrl(null);
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
        setOpponentLogoUrl(null);
        setPageLoading(false);
        return;
      }
      setEffectiveMatchId(resolvedId);
      setMatchRow(mRes.data);
      setEventIsHome(isHomeRes.isHome);
      setOpponentLogoUrl(isHomeRes.opponentLogoUrl);
      const lineData = lineRes.error
        ? { startingPlayerIds: [], squadPlayerIds: [], savedBenchPlayerIds: [] }
        : lineRes.data;
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
        const hasSubs = sorted.some(
          (e) => e.type === 'substitution' || e.type === 'sub_out' || e.type === 'sub_in',
        );
        if (hasSubs) {
          console.warn('LiveMatch missing kickoff snapshot - playtime replay may be wrong', {
            matchId: resolvedId,
          });
        } else {
          console.warn(
            '[LiveMatch] Kein Kickoff-Snapshot (match_lineup_snapshots); Replay-Basis = aktuelles match_lineup.',
          );
        }
      }
      if (lineRes.error) setSaveError(lineRes.error);
      if (evRes.error) setSaveError(evRes.error);
      setPageLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Demo: Session wird im DemoProvider synchron gebootet; Match-ID der Runtime
    // als Abhängigkeit, falls der erste Fetch vor dem Boot lief.
  }, [matchIdParam, isDemo ? demo?.liveRuntimeMatchId ?? null : null]);

  const teamSeasonForRoster = matchRow?.team_season_id ?? null;
  const {
    players: dbPlayers,
    loading: dbPlayersLoading,
    error: dbPlayersError,
  } = usePlayers(isDemo ? null : teamSeasonForRoster);
  const players = isDemo && demo ? demo.players : dbPlayers;
  const playersLoading = isDemo ? false : dbPlayersLoading;
  const playersError = isDemo ? null : dbPlayersError;
  const safePlayers = Array.isArray(players) ? players : [];

  const roster = useMemo(() => sortRosterByNumber(safePlayers.map(playerItemToRoster)), [safePlayers]);
  const rosterById = useMemo(() => {
    const m = new Map<string, RosterPlayer>();
    roster.forEach((p) => m.set(p.id, p));
    return m;
  }, [roster]);

  const playersById = useMemo(() => {
    const m = new Map<string, PlayerItem>();
    safePlayers.forEach((p) => m.set(p.id, p));
    return m;
  }, [safePlayers]);

  const canManagePlayers = canManageRoster(normalizeRole(backendRole ?? null));

  const [kickoffProfilePlayer, setKickoffProfilePlayer] = useState<PlayerItem | null>(null);

  const openKickoffPlayerProfile = useCallback(
    (playerId: string) => {
      const pid = String(playerId ?? '').trim();
      if (!pid || pid.startsWith('kickoff-')) return;
      const p = playersById.get(pid);
      if (p) setKickoffProfilePlayer(p);
    },
    [playersById],
  );

  useEffect(() => {
    if (!kickoffProfilePlayer?.id) return;
    const next = playersById.get(kickoffProfilePlayer.id);
    if (next) setKickoffProfilePlayer(next);
  }, [playersById, kickoffProfilePlayer?.id]);

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
    setStartingPlayerIds([...lineupData.startingPlayerIds]);
    setSavedBenchPlayerIds([...(lineupData.savedBenchPlayerIds ?? [])]);
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
        if (lineupPersistInProgress.current) return;
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
        !lineupPersistInProgress.current &&
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
      setLineupData(
        lineRes.error
          ? { startingPlayerIds: [], squadPlayerIds: [], savedBenchPlayerIds: [] }
          : lineRes.data,
      );
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
    const sorted = sortMatchEventsChronologically(evRes.data ?? []);
    setEvents((prev) => {
      const fetchedIds = new Set(sorted.map((e) => e.id));
      const pending = prev.filter((e) => !fetchedIds.has(e.id));
      const merged = sortMatchEventsChronologically([...sorted, ...pending]);
      return [...merged].reverse();
    });
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
      if (lineupPersistInProgress.current) {
        if (import.meta.env.DEV) {
          console.debug('[LiveMatch] realtime update deferred — lineup persist in progress', payload.eventType);
        }
        return;
      }
      if (import.meta.env.DEV) {
        console.log('live lineup realtime update', payload.eventType);
      }
      queueRealtimeReload();
    },
    [queueRealtimeReload],
  );

  useEffect(() => {
    // Demo: lokale Runtime, kein Realtime-Kanal.
    if (!effectiveMatchId || isDemo) return;
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
  }, [effectiveMatchId, isDemo, queueLiveMatchRealtimeUpdate]);

  /** Demo hat keine Session-Team-Saison — Teamname kommt aus den Demo-Fixtures. */
  const ownTeamName = isDemo
    ? demo?.data.teamName ?? HOME_FALLBACK
    : selectedTeamSeason?.team?.name ?? HOME_FALLBACK;
  const homeNameRaw = ownTeamName;
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
    const tab = (searchParams.get('tab') ?? '').trim().toLowerCase();
    if (tab === 'time' || tab === 'statistik' || tab === 'spielzeiten') {
      setMainTab('time');
    } else if (tab === 'events' || tab === 'liveticker') {
      setMainTab('events');
    } else if (tab === 'lineup' || tab === 'aufstellung') {
      setMainTab('lineup');
    } else if (tab === 'overview' || tab === 'uebersicht') {
      setMainTab('overview');
    } else if (tab === 'hub') {
      setMainTab('hub');
    }
  }, [searchParams]);
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
  const [substitutionToastText, setSubstitutionToastText] = useState<string | null>(null);
  /** Aufstellung-Tab: Positionswechsel direkt auf dem Spielfeld (nur Feldspieler). */
  const [lineupPositionMode, setLineupPositionMode] = useState(false);
  /** Aufstellung: Live-Feld vs. Startaufstellung-Snapshot (read-only). */
  const [lineupPanelView, setLineupPanelView] = useState<'live' | 'kickoff'>('live');
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

  useEffect(() => {
    if (mainTab !== 'lineup' && lineupPanelView !== 'live') setLineupPanelView('live');
  }, [mainTab, lineupPanelView]);

  /** Beim Wechsel in den Aufstellung-Tab: bei laufendem Spiel immer zuerst Live-Mannschaft zeigen. */
  const prevMainTabForLineupDefaultRef = useRef(mainTab);
  useEffect(() => {
    const enteredLineup = mainTab === 'lineup' && prevMainTabForLineupDefaultRef.current !== 'lineup';
    prevMainTabForLineupDefaultRef.current = mainTab;
    if (enteredLineup && matchRow?.status === 'live') {
      setLineupPanelView('live');
      setLineupPositionMode(false);
      setFormationSheetOpen(false);
    }
  }, [mainTab, matchRow?.status]);

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
  const [editingGoalEvent, setEditingGoalEvent] = useState<MatchEngineEvent | null>(null);
  const [editingGoalScorerId, setEditingGoalScorerId] = useState('');
  const [editingGoalSaving, setEditingGoalSaving] = useState(false);
  const [editingSubstitutionEvent, setEditingSubstitutionEvent] = useState<MatchEngineEvent | null>(null);
  const [editingSubstitutionOutId, setEditingSubstitutionOutId] = useState('');
  const [editingSubstitutionInId, setEditingSubstitutionInId] = useState('');
  const [editingSubstitutionSaving, setEditingSubstitutionSaving] = useState(false);
  const liveEditDialogOpen = Boolean(editingGoalEvent || editingSubstitutionEvent);

  useEffect(() => {
    document.body.toggleAttribute('data-live-edit-dialog-open', liveEditDialogOpen);
    return () => document.body.removeAttribute('data-live-edit-dialog-open');
  }, [liveEditDialogOpen]);

  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [pauseConfirmSaving, setPauseConfirmSaving] = useState(false);
  const [endeConfirmOpen, setEndeConfirmOpen] = useState(false);
  const [minPlaytimeEndWarnOpen, setMinPlaytimeEndWarnOpen] = useState(false);
  const [spielAbschlussOpen, setSpielAbschlussOpen] = useState(false);
  const [calendarFinalized, setCalendarFinalized] = useState(false);
  const [tournamentNavContext, setTournamentNavContext] =
    useState<TournamentMatchNavigationContext | null>(null);
  const [tournamentPlanSyncBusy, setTournamentPlanSyncBusy] = useState(false);
  const [tournamentPlanSyncStatus, setTournamentPlanSyncStatus] = useState<string | null>(null);
  const [goalUndoOffer, setGoalUndoOffer] = useState<{
    eventId: string;
    side: 'home' | 'away';
    prevHome: number;
    prevAway: number;
  } | null>(null);
  const [goalUndoToastClosing, setGoalUndoToastClosing] = useState(false);
  const goalUndoTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const goalUndoFadeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const resultFeedRefreshAttemptRef = useRef<string | null>(null);
  const liveScrollRef = useRef<HTMLDivElement>(null);
  const liveHubScrollRef = useRef<HTMLElement>(null);

  // Scroll-Reset: bei Route-Eintritt (location.key) und jedem Tab-Wechsel
  // (Hub ↔ Übersicht/Aufstellung/Liveticker/Statistik) zuverlässig oben starten.
  // Hub und Unterseiten teilen sich per CSS umgeschaltete Scrollcontainer,
  // deren scrollTop sonst erhalten bleibt (plus iOS/bfcache window-Restore).
  const routeLocation = useLocation();
  useResetScrollOnLiveEntry(`${routeLocation.key}:${mainTab}`, [liveHubScrollRef, liveScrollRef]);

  const releaseLiveBodyScrollLock = useCallback(() => {
    // Defensiv: alle hängenden Locks lösen (body + html), z. B. nach Sheet-Races.
    forceReleaseBodyScrollLocks();
  }, []);

  /** Repariert auch bereits bestehende Ergebnis-Posts, wenn ein Trainer das beendete Spiel erneut öffnet. */
  useEffect(() => {
    const mid = effectiveMatchId?.trim() ?? '';
    if (!mid || isDemo || !canControlLiveMatch || matchRow?.status !== 'finished') return;
    if (resultFeedRefreshAttemptRef.current === mid) return;
    resultFeedRefreshAttemptRef.current = mid;
    void ensureResultFeedPostForMatch(mid).then((result) => {
      if (!result.ok) {
        console.warn('[resultFeed][LiveMatch] refresh existing post failed', result.error);
        resultFeedRefreshAttemptRef.current = null;
      }
    });
  }, [effectiveMatchId, isDemo, canControlLiveMatch, matchRow?.status]);

  const stabilizeLiveHubAfterFairPlay = useCallback(() => {
    releaseLiveBodyScrollLock();
    window.setTimeout(() => {
      liveHubScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      liveScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }, [releaseLiveBodyScrollLock]);
  const substitutionToastTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearSubstitutionToast = useCallback(() => {
    if (substitutionToastTimerRef.current != null) {
      window.clearTimeout(substitutionToastTimerRef.current);
      substitutionToastTimerRef.current = null;
    }
    setSubstitutionToastText(null);
  }, []);

  const showSubstitutionToast = useCallback((message: string, ms = 2200) => {
    clearSubstitutionToast();
    setSubstitutionToastText(message);
    substitutionToastTimerRef.current = window.setTimeout(() => {
      setSubstitutionToastText(null);
      substitutionToastTimerRef.current = null;
    }, ms);
  }, [clearSubstitutionToast]);
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
    if (isDemo) {
      setCalendarFinalized(isDemoLiveCalendarFinalized(effectiveMatchId));
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
  }, [effectiveMatchId, isDemo, matchRow?.status]);

  useEffect(() => {
    // Demo: keine Turnier-Navigation (kein Turnier-Match im Demo-Katalog).
    if (!effectiveMatchId || isDemo) {
      setTournamentNavContext(null);
      return;
    }
    let cancelled = false;
    void fetchTournamentMatchNavigationContext(effectiveMatchId, { afterCurrentMatch: true }).then(
      (ctx) => {
        if (!cancelled) setTournamentNavContext(ctx);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [effectiveMatchId, matchIsFinished, matchRow?.status, isDemo]);

  /**
   * Eltern/Fans: sticky ?matchId= darf nicht auf finished Match 1 bleiben,
   * wenn bereits Match 2 (eigenes Team) live ist. 8s Poll + Broadcast.
   */
  useEffect(() => {
    if (canControlLiveMatch || isDemo) return;
    const teamSeasonId =
      String(selectedTeamSeason?.id ?? '').trim() ||
      String(matchRow?.team_season_id ?? '').trim();
    if (!teamSeasonId || !effectiveMatchId) return;

    let cancelled = false;
    const trySwitchToLive = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id')
        .eq('team_season_id', teamSeasonId)
        .eq('status', 'live')
        .order('match_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error) return;
      const liveId = data?.id ? String(data.id).trim() : '';
      if (!liveId || liveId === effectiveMatchId) return;
      navigate(`${basePath}/live?matchId=${encodeURIComponent(liveId)}`, { replace: true });
    };

    void trySwitchToLive();
    const unsub = subscribeLiveMatchStateChanged((detail) => {
      if (detail.status === 'live' || detail.status === 'finished') {
        void trySwitchToLive();
      }
    });
    const interval = window.setInterval(() => void trySwitchToLive(), 8_000);
    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(interval);
    };
  }, [
    canControlLiveMatch,
    isDemo,
    selectedTeamSeason?.id,
    matchRow?.team_season_id,
    effectiveMatchId,
    navigate,
    basePath,
  ]);

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

  const kickoffSnapshotWarnedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV || !effectiveMatchId || matchRow?.status !== 'live') return;
    const hasSubs = eventsSortedAsc.some(
      (e) => e.type === 'substitution' || e.type === 'sub_out' || e.type === 'sub_in',
    );
    if (!hasSubs) return;
    if (kickoffSnapshotWarnedRef.current === effectiveMatchId) return;

    let cancelled = false;
    void fetchKickoffLineupPlayerIds(effectiveMatchId).then((ids) => {
      if (cancelled) return;
      const hasSnap = ids != null && ids.some((id) => String(id ?? '').trim().length > 0);
      if (!hasSnap) {
        kickoffSnapshotWarnedRef.current = effectiveMatchId;
        console.warn('LiveMatch missing kickoff snapshot - playtime replay may be wrong', {
          matchId: effectiveMatchId,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveMatchId, matchRow?.status, eventsSortedAsc]);

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
      fallbackStartingPlayerIds: startingPlayerIds,
      savedBenchPlayerIds,
      previousPlaytimesByPlayerId: prevPlaytimesRef.current,
      isLiveMatchRunning: matchRow?.status === 'live' && isRunning && !matchIsFinished,
    });
    prevPlaytimesRef.current = state.playtimeSecondsByPlayerId;
    if (import.meta.env.DEV && matchRow?.status === 'live') {
      const n = countOccupiedFieldSlots(state.slotsBySlot);
      const minExpected = state.fairPlayExtraPlayerId ? 8 : 7;
      if (n < minExpected) {
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
    savedBenchPlayerIds,
    matchRow?.status,
    isRunning,
    matchIsFinished,
  ]);

  const lineupSlotsForDisplay = liveReplayState.slotsBySlot;
  const onFieldIds = liveReplayState.onFieldPlayerIds;
  const currentFieldPlayerCount = countOccupiedFieldSlots(lineupSlotsForDisplay);
  const activePlayerIds = liveReplayState.activePlayerIds;
  const fairPlayExtraPlayerId = liveReplayState.fairPlayExtraPlayerId;
  const playtimes = liveReplayState.playtimeSecondsByPlayerId;

  const plannedMatchMinutes = normalizePlannedMatchMinutes(
    matchRow?.planned_match_minutes ?? DEFAULT_PLANNED_MATCH_MINUTES,
  );
  const minimumPlaytimeEnabled = Boolean(matchRow?.minimum_playtime_enabled);
  const minimumPlaytimeMinutes = normalizeMinimumPlaytimeMinutes(
    matchRow?.minimum_playtime_minutes ?? DEFAULT_MINIMUM_PLAYTIME_MINUTES,
    plannedMatchMinutes,
  );
  const minimumPlaytimeRequiredSec = minimumPlaytimeSecondsFromMinutes(minimumPlaytimeMinutes);

  const plannedMatchDurationSec = useMemo(
    () => getPlannedMatchDurationSeconds({ plannedMinutes: plannedMatchMinutes }),
    [plannedMatchMinutes],
  );

  const remainingEffectiveMatchSec = useMemo(
    () => getRemainingEffectiveMatchSeconds(plannedMatchDurationSec, currentMatchSeconds),
    [plannedMatchDurationSec, currentMatchSeconds],
  );

  const belowMinimumPlaytimePlayers = useMemo(() => {
    if (!minimumPlaytimeEnabled) return [];
    const squadSet = new Set(squadPlayerIds.map((id) => String(id ?? '').trim()).filter(Boolean));
    const rows: {
      id: string;
      name: string;
      missingSeconds: number;
      playedMinutes: number;
      urgency: MinimumPlaytimeUrgency;
      onBench: boolean;
    }[] = [];
    for (const id of squadSet) {
      const sec = playtimes[id] ?? 0;
      if (!isBelowMinimumPlaytime(sec, minimumPlaytimeMinutes)) continue;
      const st = getMinimumPlaytimePlayerStatus(sec, minimumPlaytimeMinutes);
      const urgency = getMinimumPlaytimeUrgency(sec, minimumPlaytimeMinutes, remainingEffectiveMatchSec);
      rows.push({
        id,
        name: (rosterById.get(id)?.name ?? '?').trim() || '?',
        missingSeconds: st.missingSeconds,
        playedMinutes: st.playedMinutes,
        urgency,
        onBench: !activePlayerIds.includes(id),
      });
    }
    rows.sort(
      (a, b) =>
        minimumPlaytimeUrgencyRank(a.urgency) - minimumPlaytimeUrgencyRank(b.urgency) ||
        b.missingSeconds - a.missingSeconds ||
        a.name.localeCompare(b.name, 'de'),
    );
    return rows;
  }, [
    minimumPlaytimeEnabled,
    squadPlayerIds,
    playtimes,
    minimumPlaytimeMinutes,
    rosterById,
    remainingEffectiveMatchSec,
    plannedMatchDurationSec,
    activePlayerIds,
  ]);

  const belowMinimumPlaytimeCount = belowMinimumPlaytimePlayers.length;

  const urgentMinimumPlaytimeAlerts = useMemo(
    () =>
      belowMinimumPlaytimePlayers.filter((p) => p.onBench && isMinimumPlaytimeUrgent(p.urgency)),
    [belowMinimumPlaytimePlayers],
  );
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

  const pitchFormationId = useMemo(
    (): U11FormationId => resolveLivePitchFormationId(safeFormationId, Boolean(fairPlayExtraPlayerId)),
    [safeFormationId, fairPlayExtraPlayerId],
  );

  const formationSheetChoices = useMemo(
    (): U11FormationId[] =>
      fairPlayExtraPlayerId ? [...FAIRPLAY_FORMATION_CHOICES] : [...U11_FORMATION_CHOICES],
    [fairPlayExtraPlayerId],
  );

  const requestFormationChange = useCallback(
    (id: U11FormationId) => {
      if (!effectiveMatchId || !canControlLiveMatch || formationSaving) return;
      if (fairPlayExtraPlayerId && !isFairPlayFormationId(id)) return;
      if (!fairPlayExtraPlayerId…42307 tokens truncated…                          <div className="mt-1 space-y-0.5">
                              <p
                                className={`text-[10px] font-semibold leading-snug ${
                                  urgency === 'ok'
                                    ? 'text-emerald-300/95'
                                    : urgency === 'warning'
                                      ? 'text-amber-200/90'
                                      : urgency === 'urgent'
                                        ? 'text-amber-300/95'
                                        : 'text-red-300/90'
                                }`}
                              >
                                {formatMinimumPlaytimeProgress(
                                  minSt.playedMinutes,
                                  minimumPlaytimeMinutes,
                                )}{' '}
                                {icon}
                              </p>
                              {missLbl ? (
                                <p className="text-[10px] text-white/50">{missLbl}</p>
                              ) : null}
                              {showSubstituteNow ? (
                                <p className="text-[10px] font-bold text-red-300/90">Jetzt einwechseln</p>
                              ) : null}
                              <div
                                className="h-1 w-full max-w-[120px] overflow-hidden rounded-full bg-white/10"
                                aria-hidden
                              >
                                <div
                                  className={`h-full rounded-full ${
                                    minSt.status === 'ok'
                                      ? 'bg-emerald-500/80'
                                      : minSt.status === 'warning'
                                        ? 'bg-amber-500/75'
                                        : 'bg-red-500/70'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()
                      ) : null}
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
        <div className="fixed inset-0 z-[9998] flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 border-0 bg-black/78 backdrop-blur-md transition-opacity duration-200"
            onClick={closeFormationSheet}
            aria-label="Schließen"
          />
          <div
            className={[
              'relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-[1.35rem] border border-white/10 border-b-0 bg-gradient-to-b from-zinc-950/98 via-black to-black text-white shadow-[0_-20px_60px_rgba(0,0,0,0.75),0_0_40px_rgba(220,38,38,0.08)] transition-all duration-200 sm:max-w-none',
              formationSheetChoices.length <= 4
                ? 'h-auto max-h-[min(92dvh,820px)]'
                : 'max-h-[min(90dvh,820px)] min-h-0',
            ].join(' ')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="formation-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-4 pt-1.5 pb-0.5">
              <div className="mx-auto h-1 w-8 rounded-full bg-white/25" />
            </div>
            <div className="shrink-0 px-4 pb-1.5 pt-1 text-center">
              <h3 id="formation-sheet-title" className="text-[15px] font-black tracking-tight text-white">
                Formation ändern
              </h3>
              <p className="mt-0.5 truncate text-[10px] leading-tight text-white/45">
                {formationPendingId
                  ? 'Spieler bleiben erhalten — nur Positionen ändern sich.'
                  : fairPlayExtraPlayerId
                    ? '8 aktive Spieler bleiben auf den Slots erhalten.'
                    : '7 aktive Spieler bleiben auf den Slots erhalten.'}
              </p>
            </div>
            {formationPendingId ? (
              <div className="mx-4 mb-3 shrink-0 rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-950/40 to-black/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-center text-[14px] font-black text-amber-100">Formation wechseln?</p>
                <p className="mt-1.5 text-center text-[12px] font-medium leading-snug text-white/75">
                  Alle {currentFieldPlayerCount} aktiven Spieler bleiben erhalten und werden bei
                  Bedarf auf die neuen Slot-Positionen abgebildet.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={formationSaving}
                    onClick={() => setFormationPendingId(null)}
                    className="flex min-h-[46px] flex-1 items-center justify-center rounded-xl border border-white/12 bg-zinc-900/90 text-sm font-semibold text-white/85 transition-all duration-200 hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-45"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={formationSaving}
                    onClick={() => void confirmFormationChange()}
                    className="flex min-h-[46px] flex-1 items-center justify-center rounded-xl bg-amber-500 text-sm font-black text-amber-950 shadow-[0_0_18px_rgba(245,158,11,0.32)] transition-all duration-200 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-45"
                  >
                    {formationSaving ? '…' : 'Übernehmen'}
                  </button>
                </div>
              </div>
            ) : null}
            <div
              className={[
                'flex shrink-0 flex-col px-4',
                formationSheetChoices.length > 4
                  ? 'min-h-0 flex-1 gap-2 overflow-y-auto overscroll-y-contain py-1 [-webkit-overflow-scrolling:touch]'
                  : 'gap-1.5 py-0.5',
              ].join(' ')}
            >
              {formationSheetChoices.map((id) => {
                const active = id === pitchFormationId;
                return (
                  <button
                    key={`formation-pick-${id}`}
                    type="button"
                    disabled={formationSaving}
                    onClick={() => requestFormationChange(id)}
                    className={[
                      'grid w-full min-h-[70px] shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border px-2.5 py-[7px] text-left transition-all duration-200 active:scale-[0.99] disabled:opacity-45 sm:min-h-[72px]',
                      active
                        ? 'border-emerald-400/35 bg-gradient-to-r from-emerald-950/45 via-zinc-950/95 to-black shadow-[0_0_10px_rgba(16,185,129,0.12),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-emerald-500/25'
                        : 'border-white/10 bg-gradient-to-r from-red-950/20 via-zinc-950/90 to-black hover:border-white/16 hover:bg-zinc-900/75',
                    ].join(' ')}
                  >
                    <MiniFormationPitchPreview formationId={id} active={active} />
                    <div className="min-w-0">
                      <p className="text-xl font-black tabular-nums leading-none tracking-tight text-white">
                        {id}
                      </p>
                      <p className="mt-1 text-[12px] font-medium leading-tight text-white/55">
                        {FORMATION_OPTION_LABELS[id]}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-center justify-center pl-0.5">
                      {active ? (
                        <>
                          <span
                            className="mb-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/12 shadow-[0_0_8px_rgba(16,185,129,0.22)]"
                            aria-hidden
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </span>
                          <span className="text-[8px] font-extrabold uppercase tracking-[0.1em] text-emerald-300/90">
                            Aktiv
                          </span>
                        </>
                      ) : (
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-base text-white/40"
                          aria-hidden
                        >
                          ›
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <footer
              className="mt-auto shrink-0 border-t border-white/10 bg-black/95 px-4 pt-1.5 backdrop-blur-md"
              style={{ paddingBottom: FORMATION_SHEET_FOOTER_PB }}
            >
              <button
                type="button"
                disabled={formationSaving}
                onClick={closeFormationSheet}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/12 bg-zinc-900/95 text-sm font-bold text-white/90 transition-all duration-200 hover:border-white/18 hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-45"
              >
                Schließen
              </button>
            </footer>
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
          <div aria-hidden className={dsPageAtmosphereAbsoluteClass()} />
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col bg-[#080808]">
            <div className="sticky top-0 z-20 shrink-0 bg-[rgba(8,8,8,0.92)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-1 border-b border-transparent px-2 py-1 shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
              <h3 id="wechsel-sheet-title" className={`shrink-0 ${dsCardTitleClass()} text-base`}>
                Wechsel
              </h3>
              <div
                className={`${dsSegmentTrackClass()} h-8 min-h-8 max-w-[14rem] flex-1 sm:max-w-[14rem]`}
                role="tablist"
                aria-label="Ansicht"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={subSheetView === 'list'}
                  onClick={() => setSubSheetView('list')}
                  className={`${dsSegmentTabClass(subSheetView === 'list')} min-h-7 text-[10px] font-bold sm:text-[11px]`}
                >
                  Liste
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={subSheetView === 'pitch'}
                  onClick={() => setSubSheetView('pitch')}
                  className={`${dsSegmentTabClass(subSheetView === 'pitch')} min-h-7 text-[10px] font-bold sm:text-[11px]`}
                >
                  Spielfeld
                </button>
              </div>
            </div>

            <div className="border-b border-white/[0.07] px-2 py-0.5">
              <p className="truncate text-[10px] font-semibold leading-snug text-emerald-200/95">
                {wechselSheetPickLabels.outLabel || wechselSheetPickLabels.inLabel
                  ? `Raus ${wechselSheetPickLabels.outLabel || '…'} → Rein ${wechselSheetPickLabels.inLabel || '…'}`
                  : 'Schritt 1: Raus wählen · Schritt 2: Rein wählen'}
              </p>
            </div>
            </div>

            <div
              className={[
                'flex min-h-0 min-w-0 flex-1 flex-col px-2 pb-0 pt-0.5',
                subSheetView === 'pitch'
                  ? 'overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]'
                  : 'overflow-hidden',
              ].join(' ')}
            >
              {subSheetView === 'list' ? (
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 overflow-hidden sm:gap-2">
                  <div className={`flex min-h-0 flex-1 flex-col gap-1 ${dsWechselColumnAmbientClass('out')}`}>
                    <p className="shrink-0 px-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-red-300/90">Raus · Feld · inkl. TW</p>
                    {substitutionFieldRows.length === 0 ? (
                      <p className="shrink-0 rounded-md border border-red-500/15 bg-black/50 px-1.5 py-1 text-[10px] text-white/45">
                        Keine Feldspieler.
                      </p>
                    ) : (
                      <div
                        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pr-0.5"
                        style={{ paddingBottom: WECHSEL_CONTENT_SCROLL_BOTTOM_PAD }}
                      >
                        <div className="flex flex-col gap-1">
                          {substitutionFieldRows.map((row) => {
                            const slot = row?.slot;
                            const pid =
                              slot && lineupSlotsForDisplay && typeof lineupSlotsForDisplay === 'object'
                                ? String(lineupSlotsForDisplay[slot] ?? '').trim()
                                : '';
                            if (!pid) return null;
                            // Badge folgt der Session-player_id, nicht dem FP-Slot.
                            const isFairPlayExtra =
                              Boolean(fairPlayExtraPlayerId) &&
                              String(fairPlayExtraPlayerId ?? '').trim() === pid;
                            const rosterP = rosterById.get(pid) ?? null;
                            const name = String(row?.display_name ?? rosterP?.name ?? 'Spieler').trim() || 'Spieler';
                            const jerseyName = mobileLineupName(name);
                            const slotBadge = isFairPlayExtra
                              ? 'FairPlay +1'
                              : String(row?.rightLabel ?? '–').trim() || '—';
                            const posLabel =
                              slot === 'FP' ? 'FP' : getPositionLabel(row.position) || slotBadge;
                            const num = rosterP?.number ?? row?.jersey_number ?? null;
                            const selected = subOutPlayerId === pid;
                            const recOut = Boolean(subRecommendedOutId && subRecommendedOutId === pid && !selected);
                            const isGk = slot !== 'FP' && (posLabel === 'TW' || slotBadge === 'TW');
                            return (
                              <button
                                key={isFairPlayExtra ? `sub-out-fairplay-${pid}` : `sub-out-${slot}-${pid}`}
                                type="button"
                                onClick={() => setSubOutPlayerId(pid)}
                                className={dsWechselPickRowClass({
                                  selected,
                                  recommended: recOut,
                                  side: 'out',
                                })}
                              >
                                <div className="pointer-events-none shrink-0">
                                  <LeibchenJersey
                                    lastName={jerseyName}
                                    number={num ?? '–'}
                                    position={posLabel}
                                    variant={isGk ? 'goalkeeper' : 'field'}
                                    size="compact"
                                    pitchStyleBack
                                    className={[
                                      '!h-[2.9rem] !w-[2.28rem] sm:!h-[3.1rem] sm:!w-[2.55rem]',
                                      isFairPlayExtra ? 'ring-1 ring-amber-400/55' : '',
                                    ].join(' ')}
                                  />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-1">
                                  <p className={dsPlayerNameClass()}>{name}</p>
                                  <span
                                    className={[
                                      'inline-flex w-fit rounded-md border border-transparent px-1.5 py-px text-[8px] font-bold uppercase tracking-wide',
                                      isFairPlayExtra
                                        ? 'bg-amber-500/20 text-amber-100'
                                        : 'bg-[rgba(120,18,28,0.26)] text-[#FF8D98]',
                                    ].join(' ')}
                                  >
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

                  <div className={`flex min-h-0 flex-1 flex-col gap-1 ${dsWechselColumnAmbientClass('in')}`}>
                    <p className="shrink-0 px-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300/90">Rein · Bank</p>
                    {substitutionBenchRows.length === 0 ? (
                      <p className="shrink-0 rounded-md border border-emerald-500/15 bg-black/50 px-1.5 py-1 text-[10px] text-white/45">
                        Keine Bankspieler.
                      </p>
                    ) : (
                      <div
                        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pr-0.5"
                        style={{ paddingBottom: WECHSEL_CONTENT_SCROLL_BOTTOM_PAD }}
                      >
                        <div className="flex flex-col gap-1">
                          {substitutionBenchRows.map((row) => {
                            const pid = String(row?.id ?? '').trim();
                            if (!pid) return null;
                            const rosterP = rosterById.get(pid) ?? null;
                            const name = String(row?.display_name ?? rosterP?.name ?? 'Spieler').trim() || 'Spieler';
                            const jerseyName = mobileLineupName(name);
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
                                className={dsWechselPickRowClass({
                                  selected,
                                  recommended: recIn,
                                  side: 'in',
                                })}
                              >
                                <div className="pointer-events-none shrink-0">
                                  <LeibchenJersey
                                    lastName={jerseyName}
                                    number={num ?? '–'}
                                    position={posLabel}
                                    variant={isGk ? 'goalkeeper' : 'field'}
                                    size="compact"
                                    pitchStyleBack
                                    className="!h-[2.9rem] !w-[2.28rem] sm:!h-[3.1rem] sm:!w-[2.55rem]"
                                  />
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-1">
                                  <p className={dsPlayerNameClass()}>{name}</p>
                                  <span className="inline-flex w-fit rounded-md border border-transparent bg-[rgba(16,16,20,0.88)] px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-[#9A9AA0]">
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
              ) : !canRenderLivePitch ? (
                <p className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center text-[10px] text-white/50">
                  Aufstellung wird geladen …
                </p>
              ) : (
                <>
                  <div className="mx-auto w-full max-w-md px-0.5">
                    <LineupFormationPitch
                          formationId={pitchFormationId}
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
                          className="min-h-[11rem] max-h-[min(46dvh,28rem)] w-full sm:max-h-[min(48dvh,30rem)]"
                        />
                  </div>
                  {fairPlayExtraPlayerId &&
                  !Object.values(lineupSlotsForDisplay ?? {}).some(
                    (v) => String(v ?? '').trim() === String(fairPlayExtraPlayerId ?? '').trim(),
                  ) ? (
                    <div className="mx-auto mt-1 flex w-full max-w-md justify-center px-0.5">
                      {(() => {
                        const pid = fairPlayExtraPlayerId.trim();
                        const player = rosterById.get(pid) ?? null;
                        const rawName = (player?.displayName ?? player?.name ?? '').trim() || 'Spieler';
                        const shortName = mobileLineupName(rawName);
                        const selected = String(subOutPlayerId ?? '').trim() === pid;
                        const recOut =
                          Boolean(subRecommendedOutId) &&
                          String(subRecommendedOutId ?? '').trim() === pid &&
                          !selected;
                        return (
                          <button
                            type="button"
                            onClick={() => setSubOutPlayerId(pid)}
                            className={[
                              'flex min-w-[9.5rem] flex-col items-center rounded-xl border bg-black/45 px-2 py-1.5 transition-all active:scale-[0.98]',
                              selected
                                ? 'border-red-500 shadow-[0_0_18px_rgba(239,68,68,0.45)] ring-2 ring-red-500/65'
                                : recOut
                                  ? 'border-amber-400/55 shadow-[0_0_12px_rgba(251,191,36,0.28)] ring-1 ring-amber-400/45'
                                  : 'border-amber-400/35 hover:border-amber-300/55',
                            ].join(' ')}
                          >
                            <span className="mb-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-amber-200/90">
                              FairPlay +1 · Raus
                            </span>
                            <LeibchenJersey
                              lastName={shortName}
                              number={player?.number ?? '–'}
                              position="FP"
                              variant="field"
                              size="compact"
                              pitchStyleBack
                              className="!h-[3rem] !w-[2.35rem] ring-1 ring-amber-400/55"
                            />
                            <span className="mt-0.5 truncate text-[10px] font-semibold text-white">{shortName}</span>
                          </button>
                        );
                      })()}
                    </div>
                  ) : null}
                  <section
                    className="border-t border-white/[0.08] pt-1 transition-opacity duration-200"
                    style={{ paddingBottom: WECHSEL_PITCH_TAB_SCROLL_BOTTOM_PAD }}
                  >
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

            <footer
              className="sticky bottom-0 z-30 shrink-0 border-t border-transparent bg-[rgba(8,8,8,0.92)] px-2 pt-1 backdrop-blur-xl shadow-[0_-10px_36px_rgba(0,0,0,0.42)]"
              style={{ paddingBottom: WECHSEL_SCREEN_FOOTER_PB }}
            >
              <div className="flex flex-row gap-2">
                <button
                  type="button"
                  disabled={subSaving || posSwapSaving}
                  onClick={closeWechselSheet}
                  className={`flex min-h-[48px] flex-1 items-center justify-center px-2 text-[11px] font-bold ${dsSecondaryCtaClass()}`}
                >
                  Zurück zum Livespiel
                </button>
                <button
                  type="button"
                  disabled={
                    subSaving ||
                    posSwapSaving ||
                    !String(subOutPlayerId ?? '').trim() ||
                    (!fairPlaySubOutOnly &&
                      (!String(subInPlayerId ?? '').trim() ||
                        String(subOutPlayerId ?? '').trim() === String(subInPlayerId ?? '').trim()))
                  }
                  onClick={() => void confirmSubstitution()}
                  className={`flex min-h-[48px] flex-1 items-center justify-center px-1 text-[11px] font-bold ${dsPrimaryCtaClass()}`}
                >
                  {subSaving
                    ? '…'
                    : fairPlaySubOutOnly
                      ? 'FairPlay beenden'
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
                              <span className="ml-1 text-[10px] font-semibold text-amber-300/90">FairPlay +1</span>
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

      {editingGoalEvent && (editingGoalEvent.type === 'goal' || editingGoalEvent.type === 'goal_away') ? (
        <div
          className="fixed inset-0 z-[10020] flex min-h-dvh flex-col justify-end bg-black/75 pt-[var(--app-header-offset)] backdrop-blur-sm"
          role="presentation"
          onClick={() => {
            if (!editingGoalSaving) setEditingGoalEvent(null);
          }}
        >
          <div
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#141414] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-edit-title"
          >
            <div className="shrink-0 px-4 pb-3 pt-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
              <button
                type="button"
                disabled={editingGoalSaving}
                onClick={() => setEditingGoalEvent(null)}
                className="mb-3 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 text-sm font-bold text-white/85 disabled:opacity-40"
              >
                <span aria-hidden>←</span>
                Zurück zum Livespiel
              </button>
              <h3 id="goal-edit-title" className="text-center text-lg font-bold">Torschütze ändern</h3>
              <p className="mt-1 text-center text-sm text-white/50">
                {formatMinute(editingGoalEvent.timestamp)} · Tor{' '}
                {editingGoalEvent.type === 'goal' ? stadiumHomeDisplay : stadiumAwayDisplay}
              </p>
            </div>

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-4 [-webkit-overflow-scrolling:touch]">
              <p className="mb-2 text-xs font-bold uppercase text-red-400/90">Kader</p>
              <div className="flex flex-wrap gap-2">
                {roster.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    disabled={editingGoalSaving}
                    onClick={() => setEditingGoalScorerId(player.id)}
                    className={`min-h-[48px] min-w-[100px] flex-1 rounded-xl px-3 py-2 text-sm font-bold ${
                      editingGoalScorerId === player.id
                        ? 'bg-red-600 text-white'
                        : 'bg-white/10 text-white active:bg-white/20'
                    }`}
                  >
                    {player.number || '–'} {player.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-white/10 bg-black/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
              {saveError ? (
                <p className="mb-2 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-center text-[11px] font-medium leading-snug text-amber-100">
                  {saveError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={!editingGoalScorerId || editingGoalSaving}
                onClick={async () => {
                  if (!editingGoalScorerId || editingGoalSaving) return;
                  setEditingGoalSaving(true);
                  setSaveError(null);
                  const { error } = await updateGoalScorer(editingGoalEvent.id, editingGoalScorerId);
                  if (error) {
                    setSaveError(error);
                    setEditingGoalSaving(false);
                    return;
                  }
                  setEvents((previous) =>
                    previous.map((event) =>
                      event.id === editingGoalEvent.id
                        ? { ...event, playerId: editingGoalScorerId }
                        : event,
                    ),
                  );
                  if (effectiveMatchId) {
                    const feedResult = await ensureResultFeedPostForMatch(effectiveMatchId);
                    if (!feedResult.ok) {
                      setSaveError(`Torschütze geändert, Feed konnte nicht aktualisiert werden: ${feedResult.error}`);
                      setEditingGoalEvent(null);
                      setEditingGoalSaving(false);
                      return;
                    }
                  }
                  setEditingGoalEvent(null);
                  setEditingGoalSaving(false);
                }}
                className="flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-red-600 text-lg font-bold text-white disabled:opacity-35 active:scale-[0.99]"
              >
                {editingGoalSaving ? 'Wird gespeichert…' : 'Änderung speichern'}
              </button>
              <button
                type="button"
                disabled={editingGoalSaving}
                onClick={() => setEditingGoalEvent(null)}
                className="mt-2 min-h-[46px] w-full rounded-2xl border border-white/15 text-sm font-semibold text-white/80 disabled:opacity-40"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingSubstitutionEvent?.type === 'substitution' ? (
        <div
          className="fixed inset-0 z-[10020] flex min-h-dvh flex-col justify-end bg-black/80 pt-[var(--app-header-offset)] backdrop-blur-sm"
          role="presentation"
          onClick={() => {
            if (!editingSubstitutionSaving) setEditingSubstitutionEvent(null);
          }}
        >
          <div
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#141414] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="substitution-edit-title"
          >
            <div className="shrink-0 px-4 pb-3 pt-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
              <button
                type="button"
                disabled={editingSubstitutionSaving}
                onClick={() => setEditingSubstitutionEvent(null)}
                className="mb-3 inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 text-sm font-bold text-white/85 disabled:opacity-40"
              >
                <span aria-hidden>←</span>
                Zurück zum Livespiel
              </button>
              <h3 id="substitution-edit-title" className="text-center text-lg font-bold">
                Wechsel korrigieren
              </h3>
              <p className="mt-1 text-center text-sm text-white/50">
                {formatMinute(editingSubstitutionEvent.timestamp)} · Spieler neu zuordnen
              </p>
            </div>

            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-4 [-webkit-overflow-scrolling:touch]">
              <section>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-red-300/90">
                  Raus · Spieler am Feld
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {substitutionEditChoices.outgoing.map((player) => (
                    <button
                      key={`edit-sub-out-${player.id}`}
                      type="button"
                      disabled={editingSubstitutionSaving}
                      onClick={() => setEditingSubstitutionOutId(player.id)}
                      className={`min-h-[46px] rounded-xl border px-2.5 py-2 text-left text-[12px] font-bold leading-snug transition-colors ${
                        editingSubstitutionOutId === player.id
                          ? 'border-red-400/65 bg-red-700/80 text-white'
                          : 'border-white/10 bg-white/[0.06] text-white/85 active:bg-white/15'
                      }`}
                    >
                      <span className="mr-1 text-white/45">{player.number || '–'}</span>
                      {player.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-emerald-300/90">
                  Rein · Spieler auf der Bank
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {substitutionEditChoices.incoming.map((player) => (
                    <button
                      key={`edit-sub-in-${player.id}`}
                      type="button"
                      disabled={editingSubstitutionSaving}
                      onClick={() => setEditingSubstitutionInId(player.id)}
                      className={`min-h-[46px] rounded-xl border px-2.5 py-2 text-left text-[12px] font-bold leading-snug transition-colors ${
                        editingSubstitutionInId === player.id
                          ? 'border-emerald-400/65 bg-emerald-800/80 text-white'
                          : 'border-white/10 bg-white/[0.06] text-white/85 active:bg-white/15'
                      }`}
                    >
                      <span className="mr-1 text-white/45">{player.number || '–'}</span>
                      {player.name}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="shrink-0 border-t border-white/10 bg-black/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
              {saveError ? (
                <p className="mb-2 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-center text-[11px] font-medium leading-snug text-amber-100">
                  {saveError}
                </p>
              ) : null}
              <p className="mb-3 truncate text-center text-[12px] font-semibold text-white/70">
                Raus {rosterById.get(editingSubstitutionOutId)?.name ?? '…'} → Rein{' '}
                {rosterById.get(editingSubstitutionInId)?.name ?? '…'}
              </p>
              <button
                type="button"
                disabled={
                  !editingSubstitutionOutId ||
                  !editingSubstitutionInId ||
                  editingSubstitutionOutId === editingSubstitutionInId ||
                  editingSubstitutionSaving
                }
                onClick={() => void saveEditedSubstitution()}
                className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-red-600 text-base font-bold text-white disabled:opacity-35 active:scale-[0.99]"
              >
                {editingSubstitutionSaving ? 'Wird gespeichert…' : 'Änderung speichern'}
              </button>
              <button
                type="button"
                disabled={editingSubstitutionSaving}
                onClick={() => setEditingSubstitutionEvent(null)}
                className="mt-2 min-h-[46px] w-full rounded-2xl border border-white/15 text-sm font-semibold text-white/80 disabled:opacity-40"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                {isDemo
                  ? 'Das Demo-Spiel wird lokal abgeschlossen. Es werden keine echten Daten veröffentlicht. Anschließend kannst du Spielzeiten auswerten.'
                  : (
                    <>
                      Die Uhr stoppt, der Live-Modus endet und der Endstand wird gespeichert. Anschließend kannst du den Kalender-Termin mit{' '}
                      <span className="font-semibold text-white">Spiel abschließen</span> abschließen.
                    </>
                  )}
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
                  onClick={() => {
                    if (minimumPlaytimeEnabled && belowMinimumPlaytimeCount > 0) {
                      setEndeConfirmOpen(false);
                      setMinPlaytimeEndWarnOpen(true);
                      return;
                    }
                    setEndeConfirmOpen(false);
                    void persistMatchEndWithoutCalendar();
                  }}
                >
                  Ende
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {minPlaytimeEndWarnOpen && (
        <div
          className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto overscroll-y-contain bg-black/85 px-4 pt-[max(3rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:py-6"
          role="presentation"
          onClick={() => setMinPlaytimeEndWarnOpen(false)}
        >
          <div
            className="my-auto flex w-full max-w-md max-h-[82dvh] flex-col overflow-hidden rounded-2xl border-2 border-amber-500/50 bg-zinc-950 shadow-[0_0_40px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="min-playtime-end-title"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
              <h3 id="min-playtime-end-title" className="text-xl font-black leading-tight tracking-tight text-white">
                <span aria-hidden className="mr-1">
                  ⚠
                </span>
                Mindestspielzeit nicht erreicht
              </h3>
              <p className="mt-2 text-[15px] font-medium leading-snug text-zinc-300">
                {belowMinimumPlaytimeCount}{' '}
                {belowMinimumPlaytimeCount === 1
                  ? 'Spieler hat die Mindestspielzeit noch nicht erreicht.'
                  : 'Spieler haben die Mindestspielzeit noch nicht erreicht.'}
              </p>
              <ul className="mt-3 space-y-1.5">
                {belowMinimumPlaytimePlayers.map((p) => (
                  <li key={p.id} className="text-[14px] leading-snug text-white/88">
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className="text-white/55">: {formatMissingMinutesLabel(p.missingSeconds)}</span>
                  </li>
                ))}
              </ul>
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
                  onClick={() => setMinPlaytimeEndWarnOpen(false)}
                >
                  Zurück
                </button>
                <button
                  type="button"
                  className="flex h-14 min-h-14 min-w-0 flex-1 items-center justify-center rounded-xl bg-gradient-to-b from-red-600 to-red-950 px-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_22px_rgba(220,38,38,0.38)] active:scale-[0.99]"
                  onClick={() => {
                    setMinPlaytimeEndWarnOpen(false);
                    void persistMatchEndWithoutCalendar();
                  }}
                >
                  Spiel trotzdem beenden
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
        <div className="pointer-events-none fixed bottom-[calc(96px+env(safe-area-inset-bottom,0px))] left-1/2 z-[10001] w-[calc(100%-2rem)] max-w-[17rem] -translate-x-1/2">
          <div className="rounded-lg border border-emerald-400/25 bg-black/78 px-3 py-2 text-center text-[14px] font-medium text-emerald-50/95 shadow-[0_4px_16px_rgba(0,0,0,0.45)] backdrop-blur-sm">
            ✓ Formation geändert
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
};

export default LiveMatchScreen;
