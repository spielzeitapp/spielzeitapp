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

/**
 * Wendet nur Wechsel-Events auf die Kickoff-Slot-Karte an (FIFO: nächster sub_in mit ältestem offenen sub_out).
 * `squadPlayerIds` nur nötig, wenn `collectSteps` true (Bank-Spiegel für DEV).
 */
export function replaySubstitutionEventsOnSlots(
  kickoffStartingPlayerIds: string[],
  events: MatchEngineEvent[],
  atMatchSecond: number,
  opts?: { squadPlayerIds?: string[]; collectSteps?: boolean },
): {
  slots: Record<FieldSlotId, string | null>;
  hadOrphanIn: boolean;
  orphanOutRemaining: number;
  steps?: LiveSubReplayStepDebug[];
} {
  const t = Math.max(0, atMatchSecond);
  let slots = dedupeFieldSlotMap(startingLineupToSlotMap(kickoffStartingPlayerIds.slice(0, 7)));

  const subs = sortSubEventsForSlotReplay(
    sortMatchEventsChronologically(events).filter(
      (e) =>
        e.timestamp <= t &&
        (e.type === 'sub_out' ||
          e.type === 'sub_in' ||
          e.type === 'substitution' ||
          e.type === 'position_swap'),
    ),
  );

  const pendingOut: string[] = [];
  let hadOrphanIn = false;
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
    const dupF = dupIdsInList(fieldIds);
    const dupB = dupIdsInList(benchIds);
    const both = benchIds.filter((id) => fieldSet.has(id));
    stepIdx += 1;
    steps.push({
      step: stepIdx,
      kind,
      outPlayerId,
      inPlayerId,
      fieldBySlot: { ...slots },
      benchIds,
      duplicatesField: dupF,
      duplicatesBench: dupB,
      playersInBoth: both,
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
      if (out && inn) {
        slots = applySubstitutionToSlots(slots, out, inn).slots;
        pushStep('pair', out, inn);
      }
      continue;
    }
    if (e.type === 'sub_out' && e.playerId) {
      const pid = String(e.playerId).trim();
      if (pid) pendingOut.push(pid);
    } else if (e.type === 'sub_in' && e.playerId) {
      const inn = String(e.playerId).trim();
      if (!inn) continue;
      if (pendingOut.length > 0) {
        const out = pendingOut.shift()!;
        slots = applySubstitutionToSlots(slots, out, inn).slots;
        pushStep('pair', out, inn);
      } else {
        hadOrphanIn = true;
        const already = FIELD_SLOT_ORDER.some((s) => slots[s] === inn);
        if (!already) {
          const empty = FIELD_SLOT_ORDER.find((s) => !slots[s]);
          if (empty) slots[empty] = inn;
        }
        slots = dedupeFieldSlotMap(slots);
        pushStep('orphan_in', null, inn);
      }
    }
  }

  let orphanOutRemaining = 0;
  for (const out of pendingOut) {
    orphanOutRemaining += 1;
    const slot = FIELD_SLOT_ORDER.find((s) => slots[s] === out);
    if (slot) slots[slot] = null;
    pushStep('orphan_out', out, null);
  }

  slots = dedupeFieldSlotMap(slots);

  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && (hadOrphanIn || orphanOutRemaining > 0)) {
    console.warn('[matchEngine] substitution replay: unpaired sub_out/sub_in', {
      hadOrphanIn,
      orphanOutRemaining,
    });
  }

  return {
    slots,
    hadOrphanIn,
    orphanOutRemaining,
    steps: opts?.collectSteps ? steps : undefined,
  };
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
