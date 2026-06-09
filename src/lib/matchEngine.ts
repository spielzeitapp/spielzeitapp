/**
 * Live-Match-Logik: Feld, Bank, Spielzeit, Wechsel.
 * Events: `timestamp` = Spielsekunden seit Anpfiff (nicht Wall-Clock).
 */

import type { FieldSlotId } from '../types/match';

export const MATCH_HALF_DURATION_SEC = 25 * 60; // 1500

/** Obergrenze für gespeicherte / angezeigte Spielsekunden (U11, verhindert z. B. 128′-Artefakte). */
export const U11_MATCH_CLOCK_MAX_SECONDS = 90 * 60;

/** Effektive Spielsekunden auf sinnvollen Bereich begrenzen (vor Speichern in `match_events.minute`). */
export function clampEffectiveMatchSeconds(sec: number): number {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  return Math.min(n, U11_MATCH_CLOCK_MAX_SECONDS);
}

/** Persistierter Live-Uhr-Zustand (DB `matches.live_*`). */
export type LiveMatchClockPersisted = {
  elapsedSeconds?: number | null;
  isRunning?: boolean | null;
  hasEnded?: boolean | null;
  /** Wall-Clock-Start des aktuellen Laufsegments (nur wenn `isRunning`). */
  startedAtISO?: string | null;
};

/**
 * Effektive Spielsekunden aus Akkumulator + Wall-Clock des Laufsegments.
 * Keine lokale Hochzählung — robust gegen Sleep, Hintergrund, Tab-Throttling.
 */
export function computeLiveMatchSecondsFromClockState(
  state: LiveMatchClockPersisted,
  nowMs: number = Date.now(),
): number {
  const base = clampEffectiveMatchSeconds(Number(state.elapsedSeconds ?? 0) || 0);
  if (state.hasEnded) return base;
  if (!state.isRunning || !state.startedAtISO) return base;
  const startedMs = new Date(state.startedAtISO).getTime();
  if (Number.isNaN(startedMs)) return base;
  const segmentSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  const capLeft = Math.max(0, U11_MATCH_CLOCK_MAX_SECONDS - base);
  return clampEffectiveMatchSeconds(base + Math.min(segmentSec, capLeft));
}

/**
 * Optional: Pause/Resume/End-Events als Plausibilitätsanker (Reload, veraltete DB).
 */
export function reconcileLiveMatchSecondsWithClockEvents(
  state: LiveMatchClockPersisted,
  events: MatchEngineEvent[] | undefined,
  nowMs: number = Date.now(),
): number {
  const wall = computeLiveMatchSecondsFromClockState(state, nowMs);
  if (!events?.length) return wall;

  const sorted = sortMatchEventsChronologically(events);
  const endEv = [...sorted].reverse().find((e) => e.type === 'end');
  if (state.hasEnded && endEv) {
    return clampEffectiveMatchSeconds(endEv.timestamp);
  }

  if (!state.isRunning) {
    let lastPause = -1;
    for (const e of sorted) {
      if (e.type === 'pause') lastPause = Math.max(lastPause, e.timestamp);
    }
    if (lastPause >= 0 && Math.abs(wall - lastPause) > 1) {
      return clampEffectiveMatchSeconds(lastPause);
    }
    return wall;
  }

  let runAnchor = -1;
  for (const e of sorted) {
    if (e.type === 'start') runAnchor = Math.max(runAnchor, e.timestamp);
    if (e.type === 'resume') runAnchor = Math.max(runAnchor, e.timestamp);
  }
  if (runAnchor >= 0 && wall + 1 < runAnchor) {
    return clampEffectiveMatchSeconds(runAnchor);
  }
  return wall;
}

/** Anzeige-Spielminute (1…90) aus effektiven Spielsekunden; 0 Sek → 0 (nur Uhr). */
export function displayMatchMinuteFromEffectiveSeconds(sec: number): number {
  const s = clampEffectiveMatchSeconds(sec);
  if (s <= 0) return 0;
  return Math.max(1, Math.min(90, Math.ceil(s / 60)));
}

/** Gleiche Reihenfolge wie DB-/Aufstellung (`match_lineup.slot` / LIVE_FIELD_SLOT_ORDER). */
export const FIELD_SLOT_ORDER: FieldSlotId[] = ['GK', 'LB', 'RB', 'CM', 'LW', 'RW', 'ST', 'FP'];

export type MatchEventType =
  | 'start'
  | 'pause'
  | 'resume'
  | 'end'
  | 'sub_out'
  | 'sub_in'
  /** Ein DB-Event: playerId = Raus, swapWithPlayerId = Rein (payload.player_in_id). */
  | 'substitution'
  | 'goal'
  | 'goal_away'
  /** Nur Slot-Tausch am Feld; kein Bank-Wechsel, keine Spielzeit-Logik wie sub_* . */
  | 'position_swap'
  /** U11 FairPlay: zusätzlicher Spieler ohne normalen Wechsel / ohne Slot-Remap. */
  | 'extra_player_on'
  | 'extra_player_off';

export type MatchEngineEvent = {
  id: string;
  type: MatchEventType;
  timestamp: number;
  playerId?: string;
  /** DB `created_at` (ISO), für stabile Wechsel-Paarung bei gleicher Spielsekunde. */
  createdAt?: string;
  /** `position_swap`: zweiter Spieler (UUID), Tausch nur zwischen diesen beiden auf dem Feld. */
  swapWithPlayerId?: string;
  /** `position_swap` mit FairPlay-Extra: kein Slot-Remap in `match_lineup`, nur visuelle Positionsanker. */
  fairPlayPositionSwap?: boolean;
  /** Ziel-Slot für FairPlay-Overlay nach Positionswechsel mit Feldspieler. */
  fairPlayAnchorSlot?: FieldSlotId;
  /** `extra_player_off`: Zusatzspieler-Session (`playerId`); dieser Spieler verlässt das Feld. */
  fairPlayRemovedPlayerId?: string;
};

/** Spieler, der bei FairPlay-Ende das Feld verlässt (`payload.removed_player_id` oder Legacy `playerId`). */
export function fairPlayRemovedPlayerIdFromEvent(e: MatchEngineEvent): string | null {
  if (e.type !== 'extra_player_off') return null;
  const removed = String(e.fairPlayRemovedPlayerId ?? '').trim();
  if (removed) return removed;
  return String(e.playerId ?? '').trim() || null;
}

/** Zusatzspieler der FairPlay-Session (`player_id` am Event). */
export function fairPlayExtraPlayerIdFromOffEvent(e: MatchEngineEvent): string | null {
  if (e.type !== 'extra_player_off') return null;
  return String(e.playerId ?? '').trim() || null;
}

const TYPE_ORDER: Record<MatchEventType, number> = {
  start: 0,
  resume: 1,
  sub_out: 2,
  sub_in: 3,
  substitution: 3.25,
  /** Gleiche Spielsekunde wie Wechsel: zuerst sub_out/sub_in, dann Positionskorrektur. */
  position_swap: 3.5,
  extra_player_on: 3.52,
  extra_player_off: 3.53,
  goal: 4,
  goal_away: 5,
  pause: 6,
  end: 7,
};

/** Aufsteigend nach Spielzeit; bei gleicher Sekunde zuerst `createdAt`, dann Event-Typ. */
export function sortMatchEventsChronologically(events: MatchEngineEvent[]): MatchEngineEvent[] {
  return [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    const ca = a.createdAt ?? '';
    const cb = b.createdAt ?? '';
    if (ca !== cb) return ca.localeCompare(cb);
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });
}

/** Chronologisch aufsteigend — aktuelle FairPlay-Zusatzspieler-ID (letztes on/off). */
export function fairPlayExtraPlayerIdFromSortedEvents(sortedAsc: MatchEngineEvent[]): string | null {
  let cur: string | null = null;
  for (const e of sortedAsc) {
    if (e.type === 'extra_player_on') {
      const id = String(e.playerId ?? '').trim();
      if (id) cur = id;
    } else if (e.type === 'extra_player_off') {
      cur = null;
    }
  }
  return cur;
}

type ClockState = { running: boolean; ended: boolean };

function clockStateAfterEvents(eventsUpToT: MatchEngineEvent[]): ClockState {
  let started = false;
  let paused = false;
  let ended = false;
  for (const e of eventsUpToT) {
    if (e.type === 'start') {
      started = true;
      paused = false;
    } else if (e.type === 'pause') {
      paused = true;
    } else if (e.type === 'resume') {
      paused = false;
    } else if (e.type === 'end') {
      ended = true;
    }
  }
  return { running: started && !paused && !ended, ended };
}

function isClockRunningAt(matchSecond: number, allSorted: MatchEngineEvent[]): boolean {
  const capped = Math.max(0, matchSecond);
  const relevant = allSorted.filter((e) => e.timestamp <= capped);
  return clockStateAfterEvents(relevant).running;
}

function isClockRunningAtImplicitStart(matchSecond: number, allSorted: MatchEngineEvent[]): boolean {
  const capped = Math.max(0, matchSecond);
  const relevant = allSorted.filter((e) => e.timestamp <= capped);
  let running = true;
  let ended = false;
  for (const e of relevant) {
    if (e.type === 'pause') running = false;
    else if (e.type === 'resume') running = true;
    else if (e.type === 'end') ended = true;
  }
  return running && !ended;
}

/** Feldspieler-IDs in Slot-Reihenfolge (GK … ST), ohne Leerstrings. */
export function getOnFieldIdsInSlotOrder(slots: Record<FieldSlotId, string | null>): string[] {
  return FIELD_SLOT_ORDER.map((s) => String(slots[s] ?? '').trim()).filter(Boolean);
}

/** Startelf aus `startingPlayerIds` (Index = FIELD_SLOT_ORDER) als Slot-Map. */
export function startingLineupToSlotMap(startingPlayerIds: string[]): Record<FieldSlotId, string | null> {
  const slots = {} as Record<FieldSlotId, string | null>;
  for (let i = 0; i < FIELD_SLOT_ORDER.length; i += 1) {
    const slot = FIELD_SLOT_ORDER[i];
    const raw = startingPlayerIds[i];
    const pid = raw && String(raw).trim().length > 0 ? String(raw).trim() : null;
    slots[slot] = pid;
  }
  return slots;
}

/** Entfernt doppelte Spieler-IDs: erster Slot in `FIELD_SLOT_ORDER` gewinnt. */
export function dedupeFieldSlotMap(slots: Record<FieldSlotId, string | null>): Record<FieldSlotId, string | null> {
  const next = { ...slots } as Record<FieldSlotId, string | null>;
  const seen = new Set<string>();
  for (const s of FIELD_SLOT_ORDER) {
    const raw = next[s];
    const pid = raw && String(raw).trim().length > 0 ? String(raw).trim() : '';
    if (!pid) {
      next[s] = null;
      continue;
    }
    if (seen.has(pid)) next[s] = null;
    else seen.add(pid);
  }
  return next;
}

/**
 * Wechsel im Slot-Raster: Einwechselspieler übernimmt exakt den Slot des Auswechslers;
 * der Einwechselspieler wird aus allen anderen Slots entfernt. Anschließend Dedupe.
 */
export function applySubstitutionToSlots(
  slots: Record<FieldSlotId, string | null>,
  outgoingPlayerId: string,
  incomingPlayerId: string,
): { slots: Record<FieldSlotId, string | null>; outSlot: FieldSlotId | null } {
  const out = String(outgoingPlayerId ?? '').trim();
  const inn = String(incomingPlayerId ?? '').trim();
  if (!out || !inn) return { slots: dedupeFieldSlotMap({ ...slots }), outSlot: null };

  const next = { ...slots } as Record<FieldSlotId, string | null>;
  let outSlot: FieldSlotId | null = null;
  for (const s of FIELD_SLOT_ORDER) {
    const v = next[s] ? String(next[s]).trim() : '';
    if (v === out) {
      outSlot = s;
      break;
    }
  }
  if (!outSlot) return { slots: dedupeFieldSlotMap(next), outSlot: null };

  next[outSlot] = inn;
  for (const s of FIELD_SLOT_ORDER) {
    if (s !== outSlot) {
      const v = next[s] ? String(next[s]).trim() : '';
      if (v === inn) next[s] = null;
    }
  }
  return { slots: dedupeFieldSlotMap(next), outSlot };
}

/** Slot-Karte → Startelf-Array (Index = `FIELD_SLOT_ORDER`), leere Slots als `''`. */
export function fieldSlotMapToStartingIds(slots: Record<FieldSlotId, string | null>): string[] {
  return FIELD_SLOT_ORDER.map((s) => {
    const id = slots[s];
    return id && String(id).trim().length > 0 ? String(id).trim() : '';
  });
}

/** Bank = Kader minus aktuelle Feldspieler; optional gespeicherte Bank-Reihenfolge beibehalten. */
export function getBenchPlayers(
  squadPlayerIds: string[],
  onFieldPlayerIds: string[],
  preferredBenchOrder?: readonly string[],
): string[] {
  const on = new Set(onFieldPlayerIds.map((id) => String(id ?? '').trim()).filter(Boolean));
  const bench = squadPlayerIds
    .map((id) => String(id ?? '').trim())
    .filter((id) => id.length > 0 && !on.has(id));
  if (!preferredBenchOrder?.length) return bench;

  const remaining = new Set(bench);
  const ordered: string[] = [];
  for (const raw of preferredBenchOrder) {
    const id = String(raw ?? '').trim();
    if (id && remaining.has(id)) {
      ordered.push(id);
      remaining.delete(id);
    }
  }
  for (const id of bench) {
    if (remaining.has(id)) ordered.push(id);
  }
  return ordered;
}

/** Füllt nur leere Slots aus Fallback — überschreibt keine belegten Replay-Slots (FairPlay-sicher). */
export function fillEmptyFieldSlotsFromFallback(
  replay: Record<FieldSlotId, string | null>,
  fallback: Record<FieldSlotId, string | null>,
): Record<FieldSlotId, string | null> {
  const next = { ...replay } as Record<FieldSlotId, string | null>;
  for (const s of FIELD_SLOT_ORDER) {
    if (!String(next[s] ?? '').trim() && String(fallback[s] ?? '').trim()) {
      next[s] = fallback[s];
    }
  }
  return dedupeFieldSlotMap(next);
}

/** Tauscht nur die Belegung zweier Slots (beide müssen Spieler haben). */
export function swapTwoOccupiedFieldSlots(
  slots: Record<FieldSlotId, string | null>,
  slotA: FieldSlotId,
  slotB: FieldSlotId,
): Record<FieldSlotId, string | null> | null {
  if (slotA === slotB) return null;
  const a = String(slots[slotA] ?? '').trim();
  const b = String(slots[slotB] ?? '').trim();
  if (!a || !b || a === b) return null;
  const next = { ...slots };
  next[slotA] = b;
  next[slotB] = a;
  return dedupeFieldSlotMap(next);
}

function normFairPlayAnchorSlot(raw: unknown): FieldSlotId | null {
  const s = String(raw ?? '').trim().toUpperCase();
  return FIELD_SLOT_ORDER.includes(s as FieldSlotId) ? (s as FieldSlotId) : null;
}

/** FairPlay-Zusatzspieler tauscht nur die Anzeige-Position mit einem Slot-Spieler (kein Bank-Wechsel). */
export function isFairPlayPositionSwapEvent(
  e: MatchEngineEvent,
  fairPlayExtraId: string | null | undefined,
): boolean {
  if (e.type !== 'position_swap') return false;
  if (e.fairPlayPositionSwap) return true;
  const extra = String(fairPlayExtraId ?? '').trim();
  if (!extra) return false;
  const a = String(e.playerId ?? '').trim();
  const b = String(e.swapWithPlayerId ?? '').trim();
  return a === extra || b === extra;
}

export function deriveFairPlayVisualPosition(
  fairPlayExtraId: string | null,
  slotsBySlot: Record<FieldSlotId, string | null>,
  eventsAsc: MatchEngineEvent[],
  finalSecond: number,
): { anchorSlot: FieldSlotId | null; partnerPlayerId: string | null } {
  const extra = fairPlayExtraId?.trim();
  if (!extra) return { anchorSlot: null, partnerPlayerId: null };
  let anchorSlot: FieldSlotId | null = null;
  let partnerPlayerId: string | null = null;
  const capped = clampEffectiveMatchSeconds(finalSecond);
  for (const e of eventsAsc) {
    const t = eventMatchSecondOrNull(e);
    if (t == null || t > capped) continue;
    if (!isFairPlayPositionSwapEvent(e, extra)) continue;
    const extraAtEv = fairPlayExtraPlayerIdAtSecond(eventsAsc, t);
    if (extraAtEv !== extra) continue;
    const a = String(e.playerId ?? '').trim();
    const b = String(e.swapWithPlayerId ?? '').trim();
    const partner = a === extra ? b : b === extra ? a : null;
    if (!partner) continue;
    const anchor =
      normFairPlayAnchorSlot(e.fairPlayAnchorSlot) ??
      FIELD_SLOT_ORDER.find((s) => String(slotsBySlot[s] ?? '').trim() === partner) ??
      null;
    if (anchor) {
      anchorSlot = anchor;
      partnerPlayerId = partner;
    }
  }
  return { anchorSlot, partnerPlayerId };
}

function applyPositionSwapByPlayerIds(
  slots: Record<FieldSlotId, string | null>,
  playerA: string,
  playerB: string,
): Record<FieldSlotId, string | null> {
  const a = String(playerA ?? '').trim();
  const b = String(playerB ?? '').trim();
  if (!a || !b || a === b) return slots;
  const slotA = FIELD_SLOT_ORDER.find((s) => slots[s] === a) ?? null;
  const slotB = FIELD_SLOT_ORDER.find((s) => slots[s] === b) ?? null;
  if (!slotA || !slotB || slotA === slotB) return slots;
  const next = { ...slots };
  next[slotA] = b;
  next[slotB] = a;
  return dedupeFieldSlotMap(next);
}

function sortSubEventsForSlotReplay(subs: MatchEngineEvent[]): MatchEngineEvent[] {
  return [...subs].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    const ca = a.createdAt ?? '';
    const cb = b.createdAt ?? '';
    if (ca !== cb) return ca.localeCompare(cb);
    if (a.type !== b.type) return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    return a.id.localeCompare(b.id);
  });
}

function dupIdsInList(ids: string[]): string[] {
  const m = new Map<string, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()].filter(([, n]) => n > 1).map(([id]) => id);
}

export type LiveSubReplayStepDebug = {
  step: number;
  kind: 'pair' | 'orphan_in' | 'orphan_out';
  outPlayerId: string | null;
  inPlayerId: string | null;
  fieldBySlot: Record<FieldSlotId, string | null>;
  benchIds: string[];
  duplicatesField: string[];
  duplicatesBench: string[];
  playersInBoth: string[];
};

export type LiveSubReplayResult = {
  slots: Record<FieldSlotId, string | null>;
  hadOrphanIn: boolean;
  orphanOutRemaining: number;
  orphanInIgnored: number;
  orphanOutIgnored: number;
  steps?: LiveSubReplayStepDebug[];
};

/** Kickoff-Basis für Event-Replay (immer Snapshot, nicht End-DB-Lineup). */
export function pickKickoffLineupBaseForReplay(
  kickoffStartingPlayerIds: string[],
  fallbackStartingPlayerIds?: string[],
): string[] {
  const kick = kickoffStartingPlayerIds.slice(0, 7);
  if (kick.some((id) => String(id ?? '').trim().length > 0)) return kick;
  return (fallbackStartingPlayerIds ?? []).slice(0, 7);
}

function mergeFieldSlotsPreferReplay(
  replay: Record<FieldSlotId, string | null>,
  fallback: Record<FieldSlotId, string | null>,
): Record<FieldSlotId, string | null> {
  const replayFp = String(replay.FP ?? '').trim();
  if (replayFp) {
    return fillEmptyFieldSlotsFromFallback(replay, fallback);
  }

  const coreSlots = FIELD_SLOT_ORDER.filter((s) => s !== 'FP');
  const replayCoreSet = new Set(
    coreSlots.map((s) => String(replay[s] ?? '').trim()).filter(Boolean),
  );
  const fallbackCoreSet = new Set(
    coreSlots.map((s) => String(fallback[s] ?? '').trim()).filter(Boolean),
  );
  const coreDiff =
    [...fallbackCoreSet].some((id) => !replayCoreSet.has(id)) ||
    [...replayCoreSet].some((id) => !fallbackCoreSet.has(id));

  if (coreDiff) {
    const next = { ...fallback } as Record<FieldSlotId, string | null>;
    if (replayFp && !String(next.FP ?? '').trim()) {
      next.FP = replayFp;
    }
    return dedupeFieldSlotMap(next);
  }

  return fillEmptyFieldSlotsFromFallback(replay, fallback);
}

/**
 * Legacy sub_out/sub_in → atomare substitution-Events; unvollständige Paare verwerfen.
 * Atomare substitution bleibt unverändert.
 */
export function canonicalSubstitutionEventsForReplay(
  events: MatchEngineEvent[],
  atMatchSecond: number,
): { canonical: MatchEngineEvent[]; orphanInIgnored: number; orphanOutIgnored: number } {
  const t = Math.max(0, atMatchSecond);
  const sorted = sortMatchEventsChronologically(events).filter((e) => e.timestamp <= t);
  const canonical: MatchEngineEvent[] = [];
  const pendingOut: MatchEngineEvent[] = [];
  let orphanInIgnored = 0;
  let orphanOutIgnored = 0;

  for (const e of sorted) {
    if (e.type === 'position_swap') {
      orphanOutIgnored += pendingOut.length;
      pendingOut.length = 0;
      canonical.push(e);
      continue;
    }
    if (e.type === 'substitution') {
      orphanOutIgnored += pendingOut.length;
      pendingOut.length = 0;
      const outId = String(e.playerId ?? '').trim();
      const inId = String(e.swapWithPlayerId ?? '').trim();
      if (outId && inId && outId !== inId) canonical.push(e);
      continue;
    }
    if (e.type === 'sub_out') {
      const outId = String(e.playerId ?? '').trim();
      if (outId) pendingOut.push(e);
      continue;
    }
    if (e.type === 'sub_in') {
      const inId = String(e.playerId ?? '').trim();
      if (!inId) continue;
      const outEv = pendingOut.shift();
      if (!outEv) {
        orphanInIgnored += 1;
        continue;
      }
      const outId = String(outEv.playerId ?? '').trim();
      if (!outId || outId === inId) {
        orphanOutIgnored += 1;
        orphanInIgnored += 1;
        continue;
      }
      canonical.push({
        id: `replaypair_${outEv.id}_${e.id}`,
        type: 'substitution',
        timestamp: Math.max(outEv.timestamp, e.timestamp),
        playerId: outId,
        swapWithPlayerId: inId,
        createdAt: e.createdAt ?? outEv.createdAt,
      });
    }
  }
  orphanOutIgnored += pendingOut.length;
  return { canonical, orphanInIgnored, orphanOutIgnored };
}

/** FairPlay: Zusatzspieler im FP-Slot; Ende entfernt FP oder überträgt Slot. */
export function applyExtraPlayerOnToSlots(
  slots: Record<FieldSlotId, string | null>,
  extraId: string,
): Record<FieldSlotId, string | null> {
  const extra = String(extraId ?? '').trim();
  if (!extra) return slots;
  const next = { ...slots } as Record<FieldSlotId, string | null>;
  next.FP = extra;
  for (const s of FIELD_SLOT_ORDER) {
    if (s !== 'FP' && String(next[s] ?? '').trim() === extra) {
      next[s] = null;
    }
  }
  return dedupeFieldSlotMap(next);
}

export function applyExtraPlayerOffToSlots(
  slots: Record<FieldSlotId, string | null>,
  removed: string | null,
  extraId: string | null,
): Record<FieldSlotId, string | null> {
  let next = { ...slots } as Record<FieldSlotId, string | null>;
  if (extraId) {
    for (const s of FIELD_SLOT_ORDER) {
      if (String(next[s] ?? '').trim() === extraId) {
        next[s] = null;
      }
    }
  }
  next.FP = null;
  if (!removed) return dedupeFieldSlotMap(next);
  if (extraId && removed === extraId) return dedupeFieldSlotMap(next);
  if (!extraId) return dedupeFieldSlotMap(next);

  let placed = false;
  for (const s of FIELD_SLOT_ORDER) {
    if (String(next[s] ?? '').trim() === removed) {
      next[s] = extraId;
      placed = true;
      break;
    }
  }
  if (!placed) {
    for (const s of FIELD_SLOT_ORDER) {
      if (!String(next[s] ?? '').trim()) {
        next[s] = extraId;
        placed = true;
        break;
      }
    }
  }
  return dedupeFieldSlotMap(next);
}

/**
 * Wendet valide Wechsel + Positionswechsel auf Kickoff-Slots an.
 * Kein halbes Legacy-Wechseln: keine orphan_in/orphan_out-Feldänderung.
 */
export function replaySubstitutionEventsOnSlots(
  kickoffStartingPlayerIds: string[],
  events: MatchEngineEvent[],
  atMatchSecond: number,
  opts?: {
    squadPlayerIds?: string[];
    collectSteps?: boolean;
    /** Letzte valide DB-Aufstellung: füllt leere Slots nach fehlerhaftem Replay. */
    fallbackSlotMap?: Record<FieldSlotId, string | null>;
  },
): LiveSubReplayResult {
  const t = Math.max(0, atMatchSecond);
  const kickoffBase = pickKickoffLineupBaseForReplay(
    kickoffStartingPlayerIds,
    opts?.fallbackSlotMap
      ? fieldSlotMapToStartingIds(opts.fallbackSlotMap)
      : undefined,
  );
  let slots = dedupeFieldSlotMap(startingLineupToSlotMap(kickoffBase));

  const { canonical, orphanInIgnored, orphanOutIgnored } = canonicalSubstitutionEventsForReplay(events, t);
  const subs = sortSubEventsForSlotReplay(
    canonical.filter(
      (e) =>
        e.type === 'substitution' ||
        e.type === 'position_swap' ||
        e.type === 'extra_player_on' ||
        e.type === 'extra_player_off',
    ),
  );

  const steps: LiveSubReplayStepDebug[] = [];
  let stepIdx = 0;

  const pushStep = (
    kind: LiveSubReplayStepDebug['kind'],
    outPlayerId: string | null,
    inPlayerId: string | null,
  ) => {
    if (!opts?.collectSteps) return;
    const squad = opts.squadPlayerIds ?? [];
    const fieldIds = getOnFieldIdsInSlotOrder(slots);
    const benchIds = getBenchPlayers(squad, fieldIds);
    const fieldSet = new Set(fieldIds);
    stepIdx += 1;
    steps.push({
      step: stepIdx,
      kind,
      outPlayerId,
      inPlayerId,
      fieldBySlot: { ...slots },
      benchIds,
      duplicatesField: dupIdsInList(fieldIds),
      duplicatesBench: dupIdsInList(benchIds),
      playersInBoth: benchIds.filter((id) => fieldSet.has(id)),
    });
  };

  for (const e of subs) {
    if (e.type === 'extra_player_on') {
      const extraId = String(e.playerId ?? '').trim();
      if (extraId) {
        slots = applyExtraPlayerOnToSlots(slots, extraId);
        pushStep('pair', null, extraId);
      }
      continue;
    }
    if (e.type === 'extra_player_off') {
      const removed = fairPlayRemovedPlayerIdFromEvent(e);
      const extraId = fairPlayExtraPlayerIdFromOffEvent(e);
      slots = applyExtraPlayerOffToSlots(slots, removed, extraId);
      pushStep('pair', removed, extraId);
      continue;
    }
    if (e.type === 'position_swap') {
      const a = String(e.playerId ?? '').trim();
      const b = String(e.swapWithPlayerId ?? '').trim();
      if (!a || !b) continue;
      const slotA = FIELD_SLOT_ORDER.find((s) => String(slots[s] ?? '').trim() === a);
      const slotB = FIELD_SLOT_ORDER.find((s) => String(slots[s] ?? '').trim() === b);
      if ((slotA && !slotB) || (!slotA && slotB)) continue;
      slots = applyPositionSwapByPlayerIds(slots, a, b);
      continue;
    }
    if (e.type === 'substitution') {
      const out = String(e.playerId ?? '').trim();
      const inn = String(e.swapWithPlayerId ?? '').trim();
      if (!out || !inn || out === inn) continue;
      const applied = applySubstitutionToSlots(slots, out, inn);
      if (applied.outSlot) {
        slots = applied.slots;
        pushStep('pair', out, inn);
      }
    }
  }

  if (opts?.fallbackSlotMap) {
    slots = mergeFieldSlotsPreferReplay(slots, opts.fallbackSlotMap);
  }

  const fieldCount = getOnFieldIdsInSlotOrder(slots).length;
  const minFieldCount = String(slots.FP ?? '').trim() ? 8 : 7;
  if (fieldCount < minFieldCount && opts?.fallbackSlotMap) {
    slots = mergeFieldSlotsPreferReplay(slots, opts.fallbackSlotMap);
  }

  slots = dedupeFieldSlotMap(slots);

  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && (orphanInIgnored > 0 || orphanOutIgnored > 0)) {
    console.warn('[matchEngine] substitution replay: unpaired legacy sub_out/sub_in ignored', {
      orphanInIgnored,
      orphanOutIgnored,
      fieldCountAfter: getOnFieldIdsInSlotOrder(slots).length,
    });
  }

  return {
    slots,
    hadOrphanIn: orphanInIgnored > 0,
    orphanOutRemaining: orphanOutIgnored,
    orphanInIgnored,
    orphanOutIgnored,
    steps: opts?.collectSteps ? steps : undefined,
  };
}

/** Höchste Spielsekunde in Events (ohne End-Sonderfall). */
export function maxEventSecondFromEvents(events: MatchEngineEvent[]): number {
  let maxEv = 0;
  for (const e of events) {
    if (e.timestamp == null || !Number.isFinite(e.timestamp)) continue;
    maxEv = Math.max(maxEv, clampEffectiveMatchSeconds(e.timestamp));
  }
  return clampEffectiveMatchSeconds(maxEv);
}

/** Effektive End-Spielsekunde für Replay (End-Event, sonst cap aus Events/Uhr). */
export function resolveReplayAtMatchSecond(
  events: MatchEngineEvent[],
  liveElapsedSeconds: number | null | undefined,
): number {
  const sorted = sortMatchEventsChronologically(events);
  let endSec = -1;
  for (const e of sorted) {
    if (e.type === 'end') endSec = Math.max(endSec, e.timestamp);
  }
  if (endSec >= 0) return clampEffectiveMatchSeconds(endSec);
  const maxEv = maxEventSecondFromEvents(sorted);
  const elapsed = clampEffectiveMatchSeconds(Number(liveElapsedSeconds ?? 0) || 0);
  return clampEffectiveMatchSeconds(Math.max(elapsed, maxEv));
}

/**
 * Cap für Spielzeit-Rekonstruktion: nie unter Event-Fortschritt oder persistierter Uhr fallen
 * (Pause, Reload, FairPlay, veraltete `live_elapsed_seconds`).
 */
export function resolvePlaytimeFinalMatchSecond(params: {
  events: MatchEngineEvent[];
  currentMatchSeconds: number;
  liveElapsedSeconds?: number | null;
  isFinished: boolean;
}): number {
  const clock = clampEffectiveMatchSeconds(params.currentMatchSeconds);
  const stored = clampEffectiveMatchSeconds(Number(params.liveElapsedSeconds ?? 0) || 0);
  const maxEv = maxEventSecondFromEvents(params.events);
  const eventCap = resolveReplayAtMatchSecond(
    params.events,
    Math.max(clock, stored, maxEv),
  );
  if (params.isFinished) {
    return clampEffectiveMatchSeconds(Math.max(eventCap, maxEv, stored));
  }
  return clampEffectiveMatchSeconds(Math.max(clock, stored, maxEv, eventCap));
}

export type LiveMatchReplayDiagnostics = {
  warnings: string[];
  maxEventSecond: number;
  finalSecond: number;
  orphanInIgnored: number;
  orphanOutIgnored: number;
};

export type LiveMatchReplayState = {
  slotsBySlot: Record<FieldSlotId, string | null>;
  onFieldPlayerIds: string[];
  activePlayerIds: string[];
  benchPlayerIds: string[];
  fairPlayExtraPlayerId: string | null;
  playtimeSecondsByPlayerId: PlayerPlaytimeMap;
  diagnostics: LiveMatchReplayDiagnostics;
};

export type DeriveLiveMatchReplayParams = {
  /** Kickoff-Snapshot (Replay-Basis für Slots). */
  kickoffLineup: string[];
  squadPlayerIds: string[];
  events: MatchEngineEvent[];
  finalSecond: number;
  fallbackStartingPlayerIds?: string[];
  /** Kickoff nur für Spielzeit (falls abweichend von `kickoffLineup`). */
  kickoffLineupForPlaytime?: string[];
  previousPlaytimesByPlayerId?: PlayerPlaytimeMap;
  /** Optional: Bank-Reihenfolge aus DB (nur Sortierung, keine Mitgliedschaft). */
  savedBenchPlayerIds?: readonly string[];
  /** DEV: Warnung wenn aktive Menge leer bei laufender Spielzeit. */
  isLiveMatchRunning?: boolean;
};

function warnLiveReplayDevtools(message: string, detail?: Record<string, unknown>): void {
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return;
  console.warn(`[liveReplay] ${message}`, detail ?? {});
}

/**
 * Zentrale Live-Wahrheit: Feld-Slots, Bank, FairPlay, aktive Spieler, Spielzeiten — ein Replay-Pfad.
 */
export function deriveLiveMatchReplayState(params: DeriveLiveMatchReplayParams): LiveMatchReplayState {
  const warnings: string[] = [];
  const eventsAsc = sortMatchEventsChronologically(params.events);
  const finalSecond = clampEffectiveMatchSeconds(params.finalSecond);
  const maxEventSecond = maxEventSecondFromEvents(eventsAsc);

  if (finalSecond < maxEventSecond) {
    warnings.push('finalSecond_below_maxEvent');
    warnLiveReplayDevtools('finalSecond < maxEventSecond', { finalSecond, maxEventSecond });
  }

  const kickoff = params.kickoffLineup.slice(0, 7);
  const fallback = (params.fallbackStartingPlayerIds ?? kickoff).slice(0, FIELD_SLOT_ORDER.length);
  const kickoffPlaytime = (params.kickoffLineupForPlaytime ?? kickoff).slice(0, 7);
  const squad = params.squadPlayerIds;
  const squadSet = new Set(squad.map((id) => String(id ?? '').trim()).filter(Boolean));

  const fallbackSlotMap = fallback.some((id) => String(id ?? '').trim())
    ? startingLineupToSlotMap(fallback)
    : undefined;

  const replayResult = replaySubstitutionEventsOnSlots(kickoff, eventsAsc, finalSecond, {
    squadPlayerIds: squad,
    fallbackSlotMap,
  });

  let slotsBySlot = dedupeFieldSlotMap(replayResult.slots);

  const eventsUpToFinal = eventsAsc.filter((e) => (eventMatchSecondOrNull(e) ?? 0) <= finalSecond);
  let fairPlayExtraPlayerId =
    String(slotsBySlot.FP ?? '').trim() ||
    fairPlayExtraPlayerIdFromSortedEvents(eventsUpToFinal);

  if (fairPlayExtraPlayerId && String(slotsBySlot.FP ?? '').trim() !== fairPlayExtraPlayerId) {
    slotsBySlot = applyExtraPlayerOnToSlots(slotsBySlot, fairPlayExtraPlayerId);
  }

  const onFieldPlayerIds = getOnFieldIdsInSlotOrder(slotsBySlot);
  const activePlayerIds = [...onFieldPlayerIds];
  const benchPlayerIds = getBenchPlayers(squad, activePlayerIds, params.savedBenchPlayerIds);

  const playtimeRaw = computePlayerPlaytimeFromEvents({
    kickoffStartingPlayerIds: kickoffPlaytime,
    fallbackStartingPlayerIds: fallback,
    squadPlayerIds: squad,
    events: eventsAsc,
    finalMatchSecond: finalSecond,
  });

  const playtimeSecondsByPlayerId: PlayerPlaytimeMap = { ...playtimeRaw };
  const prev = params.previousPlaytimesByPlayerId;
  if (prev) {
    for (const [pid, sec] of Object.entries(playtimeSecondsByPlayerId)) {
      const p = prev[pid] ?? 0;
      if (sec < p - 1) {
        warnings.push(`playtime_drop:${pid}`);
        warnLiveReplayDevtools('Spielzeit sinkt gegenüber letzter Berechnung', { pid, prev: p, next: sec });
        playtimeSecondsByPlayerId[pid] = p;
      }
    }
  }

  const extra = fairPlayExtraPlayerId?.trim();
  const fieldSet = new Set(onFieldPlayerIds);
  const benchSet = new Set(benchPlayerIds);
  const playersInBoth = onFieldPlayerIds.filter((id) => benchSet.has(id));
  if (playersInBoth.length > 0) {
    warnings.push('player_in_field_and_bench');
    warnLiveReplayDevtools('Spieler doppelt Feld/Bank', { playersInBoth });
  }

  if (extra && benchSet.has(extra)) {
    warnings.push('fairplay_extra_on_bench');
    warnLiveReplayDevtools('FairPlay-Zusatzspieler in benchPlayerIds', { extra });
  }

  if (extra && !activePlayerIds.includes(extra)) {
    warnings.push('fairplay_extra_not_in_active');
    warnLiveReplayDevtools('fairPlayExtraPlayerId nicht in activePlayerIds', { extra });
  }

  if (extra) {
    if (playtimeSecondsByPlayerId[extra] == null && !Object.prototype.hasOwnProperty.call(playtimeRaw, extra)) {
      playtimeSecondsByPlayerId[extra] = 0;
    }
    if (finalSecond > 0 && (playtimeSecondsByPlayerId[extra] ?? 0) <= 0 && params.isLiveMatchRunning) {
      const hasOn = eventsUpToFinal.some((e) => e.type === 'extra_player_on' && String(e.playerId ?? '').trim() === extra);
      if (hasOn) {
        warnings.push('fairplay_extra_playtime_zero');
        warnLiveReplayDevtools('FairPlay-Extra aktiv aber playtimeSeconds fehlt/0', {
          extra,
          finalSecond,
        });
      }
    }
  }

  if (extra && benchSet.has(extra) && fieldSet.has(extra)) {
    warnings.push('extra_in_field_and_bench');
    warnLiveReplayDevtools('Zusatzspieler gleichzeitig Feld-Slot und Bank', { extra });
  }

  for (const slot of FIELD_SLOT_ORDER) {
    const pid = String(slotsBySlot[slot] ?? '').trim();
    if (pid && !squadSet.has(pid)) {
      warnings.push(`unknown_slot_player:${slot}`);
      warnLiveReplayDevtools('Slot mit unbekanntem Spieler (nicht im Kader)', { slot, pid });
    }
  }

  if (params.isLiveMatchRunning && activePlayerIds.length === 0 && finalSecond > 0) {
    warnings.push('active_set_empty');
    warnLiveReplayDevtools('activePlayerSet leer bei laufendem Spiel', { finalSecond });
  }

  if (replayResult.orphanInIgnored > 0 || replayResult.orphanOutIgnored > 0) {
    warnings.push('orphan_legacy_subs');
  }

  return {
    slotsBySlot,
    onFieldPlayerIds,
    activePlayerIds,
    benchPlayerIds,
    fairPlayExtraPlayerId: extra ?? null,
    playtimeSecondsByPlayerId,
    diagnostics: {
      warnings,
      maxEventSecond,
      finalSecond,
      orphanInIgnored: replayResult.orphanInIgnored,
      orphanOutIgnored: replayResult.orphanOutIgnored,
    },
  };
}

/** Alle Spieler-IDs für Live-Statistik / Listen (Kader ∪ Replay ∪ Spielzeiten). */
export function collectLiveStatPlayerIds(
  state: Pick<
    LiveMatchReplayState,
    'onFieldPlayerIds' | 'benchPlayerIds' | 'activePlayerIds' | 'fairPlayExtraPlayerId' | 'playtimeSecondsByPlayerId'
  >,
  squadPlayerIds: string[],
): string[] {
  const ids = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const id = String(raw ?? '').trim();
    if (id) ids.add(id);
  };
  for (const id of squadPlayerIds) add(id);
  for (const id of state.onFieldPlayerIds) add(id);
  for (const id of state.benchPlayerIds) add(id);
  for (const id of state.activePlayerIds) add(id);
  add(state.fairPlayExtraPlayerId);
  for (const id of Object.keys(state.playtimeSecondsByPlayerId)) add(id);
  return [...ids];
}

/** Sortier-Rang: 0 = aktiv (inkl. FairPlay-Extra), 1 = Bank, 2 = übrig. */
export function liveStatPlayerSortRank(
  playerId: string,
  state: Pick<LiveMatchReplayState, 'activePlayerIds' | 'benchPlayerIds'>,
): number {
  const id = String(playerId).trim();
  if (state.activePlayerIds.includes(id)) return 0;
  if (state.benchPlayerIds.includes(id)) return 1;
  return 2;
}

/**
 * Aktuelle Belegung pro Slot: **Kickoff-Aufstellung** + alle Wechsel chronologisch
 * (FIFO-Paarung sub_out → sub_in bei gleicher Spielsekunde über `createdAt` / Typ / id).
 */
export function getCurrentOnFieldBySlot(
  startingPlayerIds: string[],
  events: MatchEngineEvent[],
  atMatchSecond: number,
): Record<FieldSlotId, string | null> {
  return replaySubstitutionEventsOnSlots(startingPlayerIds, events, atMatchSecond).slots;
}

/** Aktuelle Feldspieler-IDs = gleiche Quelle wie `getCurrentOnFieldBySlot`, Reihenfolge GK…ST. */
export function getCurrentOnFieldPlayers(
  startingPlayerIds: string[],
  events: MatchEngineEvent[],
  atMatchSecond: number,
): string[] {
  return getOnFieldIdsInSlotOrder(getCurrentOnFieldBySlot(startingPlayerIds, events, atMatchSecond));
}

export type PlayerPlaytimeMap = Record<string, number>;

export type ComputePlayerPlaytimeParams = {
  kickoffStartingPlayerIds: string[];
  /** Wenn Kickoff-Snapshot leer: aktuelle Startelf / DB-Fallback. */
  fallbackStartingPlayerIds?: string[];
  squadPlayerIds: string[];
  events: MatchEngineEvent[];
  /** Effektive End-Spielsekunde (End-Event, Uhr oder `resolveReplayAtMatchSecond`). */
  finalMatchSecond: number;
};

const CLOCK_EVENT_TYPES = new Set<MatchEventType>(['start', 'pause', 'resume', 'end']);
const LINEUP_PLAYTIME_EVENT_TYPES = new Set<MatchEventType>([
  'substitution',
  'sub_out',
  'sub_in',
  'extra_player_on',
  'extra_player_off',
]);

function isDevPlaytimeWarn(): boolean {
  return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
}

function eventMatchSecondOrNull(e: MatchEngineEvent): number | null {
  if (e.timestamp == null || !Number.isFinite(e.timestamp)) return null;
  return clampEffectiveMatchSeconds(e.timestamp);
}

function fairPlayExtraPlayerIdAtSecond(sortedAsc: MatchEngineEvent[], atSec: number): string | null {
  const t = Math.max(0, atSec);
  const sub = sortedAsc.filter((e) => (eventMatchSecondOrNull(e) ?? 0) <= t);
  return fairPlayExtraPlayerIdFromSortedEvents(sub);
}

function activePlayerIdsAtSecond(
  kickoff: string[],
  sortedAsc: MatchEngineEvent[],
  atSec: number,
): Set<string> {
  const t = Math.max(0, atSec);
  const onField = getCurrentOnFieldPlayers(kickoff, sortedAsc, t);
  const active = new Set(onField.map((id) => String(id).trim()).filter(Boolean));
  const extra = fairPlayExtraPlayerIdAtSecond(sortedAsc, t);
  if (extra) active.add(extra);
  return active;
}

/** Effektive Laufsegmente [a,b) innerhalb [0,cap] — Pausen ausgeschlossen. */
function buildEffectiveRunningSegments(sortedAsc: MatchEngineEvent[], cap: number): Array<[number, number]> {
  const capN = clampEffectiveMatchSeconds(cap);
  if (capN <= 0) return [];

  const hasClock = sortedAsc.some((e) => CLOCK_EVENT_TYPES.has(e.type));
  if (!hasClock) return [[0, capN]];

  const hasStart = sortedAsc.some((e) => e.type === 'start');
  const cuts = new Set<number>([0, capN]);
  for (const e of sortedAsc) {
    if (!CLOCK_EVENT_TYPES.has(e.type)) continue;
    const t = eventMatchSecondOrNull(e);
    if (t == null || t < 0 || t > capN) continue;
    cuts.add(t);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: Array<[number, number]> = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (b <= a) continue;
    const running = hasStart
      ? clockStateAfterEvents(sortedAsc.filter((e) => (eventMatchSecondOrNull(e) ?? 0) <= a)).running
      : isClockRunningAtImplicitStart(a, sortedAsc);
    if (running) segments.push([a, b]);
  }
  return segments;
}

function collectPlaytimePlayerIds(
  kickoff: string[],
  squadPlayerIds: string[],
  sortedAsc: MatchEngineEvent[],
): Set<string> {
  const ids = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const id = String(raw ?? '').trim();
    if (id) ids.add(id);
  };
  for (const id of squadPlayerIds) add(id);
  for (const id of kickoff) add(id);
  for (const e of sortedAsc) {
    add(e.playerId);
    add(e.swapWithPlayerId);
  }
  return ids;
}

function warnPlaytimeDevtools(sortedAsc: MatchEngineEvent[]): void {
  if (!isDevPlaytimeWarn()) return;

  for (const e of sortedAsc) {
    if (eventMatchSecondOrNull(e) == null) {
      console.warn('[playtime] Event ohne gültige Spielsekunde', { id: e.id, type: e.type });
    }
    if (e.type === 'substitution') {
      const outId = String(e.playerId ?? '').trim();
      const inId = String(e.swapWithPlayerId ?? '').trim();
      if (!outId || !inId) {
        console.warn('[playtime] substitution ohne playerOut/playerIn', { id: e.id, outId, inId });
      }
    }
  }

  const { orphanInIgnored, orphanOutIgnored } = canonicalSubstitutionEventsForReplay(
    sortedAsc,
    U11_MATCH_CLOCK_MAX_SECONDS,
  );
  if (orphanInIgnored > 0 || orphanOutIgnored > 0) {
    console.warn('[playtime] Legacy-Wechsel unvollständig (ignoriert)', { orphanInIgnored, orphanOutIgnored });
  }

  let extraActive: string | null = null;
  for (const e of sortedAsc) {
    if (e.type === 'extra_player_off') {
      const offId = String(e.playerId ?? '').trim();
      if (!extraActive) {
        console.warn('[playtime] extra_player_off ohne aktiven Zusatzspieler', { id: e.id, offId });
      } else if (offId && offId !== extraActive) {
        console.warn('[playtime] extra_player_off für anderen Spieler', {
          id: e.id,
          expected: extraActive,
          got: offId,
        });
      }
      extraActive = null;
    } else if (e.type === 'extra_player_on') {
      const onId = String(e.playerId ?? '').trim();
      if (extraActive && onId && onId !== extraActive) {
        console.warn('[playtime] Zusatzspieler doppelt aktiv (überlappende on-Events)', {
          prev: extraActive,
          next: onId,
        });
      }
      if (onId) extraActive = onId;
    }
  }
}

/**
 * Spielzeit pro Spieler aus Events rekonstruieren (Kickoff, Wechsel, FairPlay, Uhr ohne Pausen).
 */
export function computePlayerPlaytimeFromEvents(params: ComputePlayerPlaytimeParams): PlayerPlaytimeMap {
  const sorted = sortMatchEventsChronologically(params.events);
  const cap = clampEffectiveMatchSeconds(params.finalMatchSecond);
  const kickoff = pickKickoffLineupBaseForReplay(
    params.kickoffStartingPlayerIds,
    params.fallbackStartingPlayerIds ?? params.kickoffStartingPlayerIds,
  );

  if (isDevPlaytimeWarn()) {
    const kickoffEmpty = !kickoff.some((id) => String(id ?? '').trim().length > 0);
    const squadHasPlayers = params.squadPlayerIds.some((id) => String(id ?? '').trim().length > 0);
    if (kickoffEmpty && squadHasPlayers) {
      console.warn('[playtime] Kickoff-Lineup leer obwohl Kader/Lineup vorhanden', {
        kickoffLen: params.kickoffStartingPlayerIds.length,
        fallbackLen: params.fallbackStartingPlayerIds?.length ?? 0,
      });
    }
  }

  warnPlaytimeDevtools(sorted);

  const seconds: PlayerPlaytimeMap = {};
  const trackIds = collectPlaytimePlayerIds(kickoff, params.squadPlayerIds, sorted);
  for (const id of trackIds) seconds[id] = 0;

  const runningSegments = buildEffectiveRunningSegments(sorted, cap);

  for (const [runA, runB] of runningSegments) {
    const subCuts = new Set<number>([runA, runB]);
    for (const e of sorted) {
      if (!LINEUP_PLAYTIME_EVENT_TYPES.has(e.type)) continue;
      const t = eventMatchSecondOrNull(e);
      if (t == null || t < runA || t > runB) continue;
      subCuts.add(t);
    }
    const points = [...subCuts].sort((a, b) => a - b);

    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const dur = b - a;
      if (dur <= 0) {
        if (dur < 0 && isDevPlaytimeWarn()) {
          console.warn('[playtime] negative Segmentdauer', { a, b, dur });
        }
        continue;
      }

      const active = activePlayerIdsAtSecond(kickoff, sorted, a);
      if (isDevPlaytimeWarn() && active.size === 0 && cap > 0) {
        console.warn('[playtime] activePlayerSet leer obwohl Match-Zeit läuft', { at: a, cap });
      }
      if (isDevPlaytimeWarn() && active.size > 8) {
        console.warn('[playtime] ungewöhnlich viele aktive Feldspieler', { at: a, count: active.size });
      }

      for (const pid of active) {
        const prev = seconds[pid] ?? 0;
        seconds[pid] = prev + dur;
        if (isDevPlaytimeWarn() && seconds[pid] < prev) {
          console.warn('[playtime] Spielzeit würde sinken', { pid, prev, next: seconds[pid] });
          seconds[pid] = prev;
        }
      }
    }
  }

  for (const id of Object.keys(seconds)) {
    if (seconds[id] < 0) seconds[id] = 0;
  }
  return seconds;
}

/** DB-Zeile (Statistik/Reports) → Engine-Event. */
export function statsMatchEventRowToEngine(row: {
  id?: string;
  match_id?: string;
  type?: string;
  minute?: number | null;
  player_id?: string | null;
  payload?: unknown;
  created_at?: string;
}): MatchEngineEvent | null {
  const id = String(row.id ?? `stat_${row.match_id ?? 'm'}_${row.type ?? 'ev'}_${row.minute ?? 0}`).trim();
  const createdAt = row.created_at ?? undefined;
  const minute = row.minute != null ? clampEffectiveMatchSeconds(Number(row.minute)) : 0;
  const type = String(row.type ?? '').trim();

  if (type === 'kickoff') {
    return { id, type: 'start', timestamp: minute, createdAt };
  }
  if (type === 'final_whistle') {
    return { id, type: 'end', timestamp: minute, createdAt };
  }
  if (type === 'period_start') {
    return { id, type: 'resume', timestamp: minute, createdAt };
  }
  if (type === 'period_end') {
    return { id, type: 'pause', timestamp: minute, createdAt };
  }
  if (type === 'substitution') {
    const p = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
    const playerIn =
      typeof p.player_in_id === 'string' && p.player_in_id.trim().length > 0 ? p.player_in_id.trim() : '';
    const outId = String(row.player_id ?? '').trim();
    return {
      id,
      type: 'substitution',
      timestamp: minute,
      playerId: outId || undefined,
      swapWithPlayerId: playerIn || undefined,
      createdAt,
    };
  }
  if (type === 'substitution_out') {
    return { id, type: 'sub_out', timestamp: minute, playerId: row.player_id ?? undefined, createdAt };
  }
  if (type === 'substitution_in') {
    return { id, type: 'sub_in', timestamp: minute, playerId: row.player_id ?? undefined, createdAt };
  }
  if (type === 'extra_player_on') {
    return {
      id,
      type: 'extra_player_on',
      timestamp: minute,
      playerId: row.player_id ?? undefined,
      createdAt,
    };
  }
  if (type === 'extra_player_off') {
    const p = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
    const removedRaw =
      typeof p.removed_player_id === 'string' && p.removed_player_id.trim().length > 0
        ? p.removed_player_id.trim()
        : '';
    const extraId = String(row.player_id ?? '').trim();
    return {
      id,
      type: 'extra_player_off',
      timestamp: minute,
      playerId: extraId || undefined,
      fairPlayRemovedPlayerId: removedRaw || extraId || undefined,
      createdAt,
    };
  }
  if (
    type === 'start' ||
    type === 'pause' ||
    type === 'resume' ||
    type === 'end' ||
    type === 'sub_out' ||
    type === 'sub_in' ||
    type === 'goal' ||
    type === 'goal_away'
  ) {
    return {
      id,
      type: type as MatchEventType,
      timestamp: minute,
      playerId: row.player_id ?? undefined,
      createdAt,
    };
  }
  return null;
}

/** @deprecated Alias — nutze `computePlayerPlaytimeFromEvents`. */
export function calculatePlayerPlaytimes(
  startingPlayerIds: string[],
  squadPlayerIds: string[],
  events: MatchEngineEvent[],
  currentMatchSeconds: number,
): PlayerPlaytimeMap {
  return computePlayerPlaytimeFromEvents({
    kickoffStartingPlayerIds: startingPlayerIds,
    squadPlayerIds,
    events,
    finalMatchSecond: currentMatchSeconds,
  });
}

export type PlaytimeAmpel = 'red' | 'yellow' | 'green';

/**
 * Soll grob: faire Verteilung der 7 Feldplätze auf den Kader über die bisherige Matchzeit.
 * Anteil gespielt = secondsPlayed / fairShare; Ampel nach Schwellen 40 % / 70 %.
 */
export function getPlaytimeStatus(
  secondsPlayed: number,
  currentMatchSeconds: number,
  squadSize: number,
): PlaytimeAmpel {
  const n = Math.max(1, squadSize);
  const fair = (Math.max(0, currentMatchSeconds) * 7) / n;
  if (fair <= 0) return 'green';
  const ratio = secondsPlayed / fair;
  if (ratio < 0.4) return 'red';
  if (ratio < 0.7) return 'yellow';
  return 'green';
}

export type SubstitutionResult =
  | { ok: true; events: MatchEngineEvent[] }
  | { ok: false; reason: string };

export function handleSubstitution(args: {
  outgoingPlayerId: string;
  incomingPlayerId: string;
  currentTimestamp: number;
  events: MatchEngineEvent[];
  currentOnFieldPlayerIds: string[];
  generateId: () => string;
}): SubstitutionResult {
  const { outgoingPlayerId, incomingPlayerId, currentTimestamp, currentOnFieldPlayerIds, generateId } =
    args;

  if (!outgoingPlayerId || !incomingPlayerId) {
    return { ok: false, reason: 'Raus und Rein müssen gewählt sein.' };
  }
  if (outgoingPlayerId === incomingPlayerId) {
    return { ok: false, reason: 'Derselbe Spieler kann nicht gewechselt werden.' };
  }

  const onField = new Set(currentOnFieldPlayerIds);
  if (!onField.has(outgoingPlayerId)) {
    return { ok: false, reason: 'Auswechselnder ist nicht am Feld.' };
  }
  if (onField.has(incomingPlayerId)) {
    return { ok: false, reason: 'Einwechselnder steht bereits am Feld.' };
  }

  const ts = Math.max(0, currentTimestamp);
  const outEv: MatchEngineEvent = {
    id: generateId(),
    type: 'sub_out',
    timestamp: ts,
    playerId: outgoingPlayerId,
  };
  const inEv: MatchEngineEvent = {
    id: generateId(),
    type: 'sub_in',
    timestamp: ts,
    playerId: incomingPlayerId,
  };

  return { ok: true, events: [outEv, inEv] };
}

type ScorePair = { h: number; a: number };

function scoreSub(a: ScorePair, b: ScorePair): ScorePair {
  return { h: a.h - b.h, a: a.a - b.a };
}

function formatPeriodSegment(pair: ScorePair, started: boolean): string {
  if (!started) return '-:-';
  return `${pair.h}:${pair.a}`;
}

/**
 * Abschnittsergebnisse nur aus Toren + Pausen (nicht aus Spielminuten):
 * Drittel 1 bis zur 1. Pause, Drittel 2 bis zur 2. Pause, Drittel 3 bis Spielende.
 * Gesamtstand bleibt separat (score_home / score_away) — hier nur die Klammer-Zeile.
 */
export function buildPauseDelimitedPeriodScoreLine(events: MatchEngineEvent[], matchFinished: boolean): string {
  const sorted = sortMatchEventsChronologically(events);
  let cum: ScorePair = { h: 0, a: 0 };
  const pauseSnaps: ScorePair[] = [];
  let endSnap: ScorePair | null = null;

  for (const e of sorted) {
    if (e.type === 'goal') {
      cum = { h: cum.h + 1, a: cum.a };
    } else if (e.type === 'goal_away') {
      cum = { h: cum.h, a: cum.a + 1 };
    } else if (e.type === 'pause') {
      pauseSnaps.push({ ...cum });
    } else if (e.type === 'end') {
      endSnap = { ...cum };
    }
  }

  const current = matchFinished && endSnap ? endSnap : cum;
  const z: ScorePair = { h: 0, a: 0 };

  if (pauseSnaps.length === 0) {
    const s1 = current;
    const st1 = s1.h + s1.a > 0;
    return `(${formatPeriodSegment(s1, st1)} | -:- | -:-)`;
  }

  if (pauseSnaps.length === 1) {
    const p1 = pauseSnaps[0];
    const s1 = scoreSub(p1, z);
    const s2 = scoreSub(current, p1);
    return `(${formatPeriodSegment(s1, true)} | ${formatPeriodSegment(s2, true)} | -:-)`;
  }

  const p1 = pauseSnaps[0];
  const p2 = pauseSnaps[1];
  const s1 = scoreSub(p1, z);
  const s2 = scoreSub(p2, p1);
  const s3 = scoreSub(current, p2);
  return `(${formatPeriodSegment(s1, true)} | ${formatPeriodSegment(s2, true)} | ${formatPeriodSegment(s3, true)})`;
}
