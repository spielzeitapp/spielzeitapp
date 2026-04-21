/**
 * Live-Match-Logik: Feld, Bank, Spielzeit, Wechsel.
 * Events: `timestamp` = Spielsekunden seit Anpfiff (nicht Wall-Clock).
 */

export const MATCH_HALF_DURATION_SEC = 25 * 60; // 1500

export type MatchEventType =
  | 'start'
  | 'pause'
  | 'resume'
  | 'end'
  | 'sub_out'
  | 'sub_in'
  | 'goal';

export type MatchEngineEvent = {
  id: string;
  type: MatchEventType;
  timestamp: number;
  playerId?: string;
};

const TYPE_ORDER: Record<MatchEventType, number> = {
  start: 0,
  resume: 1,
  sub_out: 2,
  sub_in: 3,
  goal: 4,
  pause: 5,
  end: 6,
};

/** Aufsteigend nach Spielzeit; bei gleicher Sekunde stabil nach Event-Typ. */
export function sortMatchEventsChronologically(events: MatchEngineEvent[]): MatchEngineEvent[] {
  return [...events].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });
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

/** Startelf ab Sekunde 0; Wechsel bis einschließlich `atMatchSecond` angewendet. */
export function getCurrentOnFieldPlayers(
  startingPlayerIds: string[],
  events: MatchEngineEvent[],
  atMatchSecond: number,
): string[] {
  const sorted = sortMatchEventsChronologically(events);
  const t = Math.max(0, atMatchSecond);
  let field = startingPlayerIds.slice(0, 7);

  const applySub = (type: 'sub_out' | 'sub_in', pid: string | undefined) => {
    if (!pid) return;
    if (type === 'sub_out') {
      field = field.filter((id) => id !== pid);
      return;
    }
    if (!field.includes(pid) && field.length < 7) {
      field = [...field, pid];
    }
  };

  for (const e of sorted) {
    if (e.timestamp > t) break;
    if (e.type === 'sub_out') applySub('sub_out', e.playerId);
    else if (e.type === 'sub_in') applySub('sub_in', e.playerId);
  }
  return field;
}

export function getBenchPlayers(squadPlayerIds: string[], onFieldPlayerIds: string[]): string[] {
  const on = new Set(onFieldPlayerIds);
  return squadPlayerIds.filter((id) => !on.has(id));
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
      if (e.playerId) cum = { h: cum.h + 1, a: cum.a };
      else cum = { h: cum.h, a: cum.a + 1 };
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
