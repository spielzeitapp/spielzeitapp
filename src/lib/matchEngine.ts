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

/** Anzeige-Spielminute (1…90) aus effektiven Spielsekunden; 0 Sek → 0 (nur Uhr). */
export function displayMatchMinuteFromEffectiveSeconds(sec: number): number {
  const s = clampEffectiveMatchSeconds(sec);
  if (s <= 0) return 0;
  return Math.max(1, Math.min(90, Math.ceil(s / 60)));
}

/** Gleiche Reihenfolge wie DB-/Aufstellung (`match_lineup.slot` / LIVE_FIELD_SLOT_ORDER). */
export const FIELD_SLOT_ORDER: FieldSlotId[] = ['GK', 'LB', 'RB', 'CM', 'LW', 'RW', 'ST'];

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
};

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

export function getBenchPlayers(squadPlayerIds: string[], onFieldPlayerIds: string[]): string[] {
  const on = new Set(onFieldPlayerIds);
  return squadPlayerIds.filter((id) => !on.has(id));
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
  const next = { ...replay } as Record<FieldSlotId, string | null>;
  for (const s of FIELD_SLOT_ORDER) {
    if (!String(next[s] ?? '').trim() && String(fallback[s] ?? '').trim()) {
      next[s] = fallback[s];
    }
  }
  return dedupeFieldSlotMap(next);
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
    canonical.filter((e) => e.type === 'substitution' || e.type === 'position_swap'),
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
    if (e.type === 'position_swap') {
      const a = String(e.playerId ?? '').trim();
      const b = String(e.swapWithPlayerId ?? '').trim();
      if (a && b) slots = applyPositionSwapByPlayerIds(slots, a, b);
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
  if (fieldCount < 7 && opts?.fallbackSlotMap) {
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
  let maxEv = 0;
  for (const e of sorted) maxEv = Math.max(maxEv, e.timestamp);
  const elapsed = clampEffectiveMatchSeconds(Number(liveElapsedSeconds ?? 0) || 0);
  return clampEffectiveMatchSeconds(Math.max(elapsed, maxEv));
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

/**
 * Effektive Spielzeit nur bei laufender Uhr; Pausen zählen nicht.
 * Segment [a,b) mit b = nächster Breakpoint oder aktuelle Spielsekunde.
 */
export function calculatePlayerPlaytimes(
  startingPlayerIds: string[],
  squadPlayerIds: string[],
  events: MatchEngineEvent[],
  currentMatchSeconds: number,
): PlayerPlaytimeMap {
  const sorted = sortMatchEventsChronologically(events);
  const cap = Math.max(0, currentMatchSeconds);
  const hasClockControlEvents = sorted.some(
    (e) => e.type === 'start' || e.type === 'resume' || e.type === 'pause' || e.type === 'end',
  );
  const hasExplicitStart = sorted.some((e) => e.type === 'start');

  const seconds: PlayerPlaytimeMap = {};
  for (const id of squadPlayerIds) seconds[id] = 0;

  const breakpoints = new Set<number>([0, cap]);
  for (const e of sorted) {
    if (e.timestamp >= 0 && e.timestamp <= cap) breakpoints.add(e.timestamp);
  }
  const breaks = [...breakpoints].sort((a, b) => a - b);

  for (let i = 0; i < breaks.length - 1; i++) {
    const a = breaks[i];
    const b = breaks[i + 1];
    const len = b - a;
    if (len <= 0) continue;
    // Fallback: Wenn keine Clock-Control-Events vorhanden sind (DB speichert oft nur Tor/Wechsel),
    // interpretieren wir `currentMatchSeconds` als effektive Spielzeit und zählen [0..cap] durch.
    // Falls Pause/Resume vorhanden sind, aber kein explizites Start-Event, nehmen wir impliziten Start ab 0 an.
    const runningAtA = !hasClockControlEvents
      ? true
      : hasExplicitStart
        ? isClockRunningAt(a, sorted)
        : isClockRunningAtImplicitStart(a, sorted);
    if (!runningAtA) continue;
    const onField = getCurrentOnFieldPlayers(startingPlayerIds, sorted, a);
    for (const pid of onField) {
      if (seconds[pid] !== undefined) seconds[pid] += len;
    }
  }

  for (const id of Object.keys(seconds)) {
    if (seconds[id] < 0) seconds[id] = 0;
  }
  return seconds;
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
