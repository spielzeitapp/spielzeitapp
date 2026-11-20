/** Internal training only. No matches, feed posts or league statistics are created. */
export type HallTeam = { name: string; playerIds: string[] };
export type HallGoal = { team: number; second: number; ownGoal?: boolean; timeUnknown?: boolean; scorerId?: string; scorerName?: string };
export type HallGame = { withdrawn?: string[]; reliefTeams?: Record<string, number>; startedAt?: number; finishedAt?: number; originalSeconds?: number; participation?: Record<string, HallParticipation>; seconds?: number; home: number; away: number; status: 'pending' | 'running' | 'paused' | 'finished'; elapsed: number; runningSince: number | null; goals: HallGoal[] };
export type HallExtraPlayer = { id: string; name: string; kind: 'guest' | 'club'; team?: string };
export type HallDay = { extraPlayers?: HallExtraPlayer[]; plannedStartTime?: string; version: 1; teams: HallTeam[]; format: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11; total: number; pause: number; target: number; cycles: number; seconds: number; buffer: number; games: HallGame[] };
export const HALL_COLORS = ['#fb425c', '#419cff', '#facc15', '#4ade80'];
export const HALL_NAMES = ['Rot', 'Blau', 'Gelb', 'Grün'];
export function isHallTraining(title: string, location?: string | null) {
  return /hallen?[-\s]?training|turnsaal|turnhalle|sporthalle/i.test(`${title} ${location ?? ''}`);
}
/** Complete round-robin cycles only; never truncate a cycle to fill the time. */
export function calculateHallSchedule(count: number, total: number, pause: number, target = 480, requestedCycles?: number) {
  if (![2, 3, 4].includes(count) || !Number.isInteger(total) || total < 900 || total > 10800 || !Number.isInteger(pause) || pause < 0 || pause > 300 || !Number.isInteger(target) || target < 120 || target > 1200) throw new Error('Bitte 2, 3 oder 4 Teams, 15–180 Minuten und gültige Pausen wählen.');
  const pairs: [number, number][] = count === 2 ? [[0, 1]] : count === 3 ? [[0, 1], [0, 2], [1, 2]] : [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
  const options = Array.from({ length: 8 }, (_, i) => {
    const cycles = i + 1, n = pairs.length * cycles;
    const seconds = Math.floor((total - (n - 1) * pause) / n / 5) * 5;
    return { cycles, seconds, buffer: total - n * seconds - (n - 1) * pause, count: n };
  }).filter(o => o.seconds >= 60 && o.seconds <= 1800);
  const selected = requestedCycles === undefined ? options.sort((a, b) => Math.abs(a.seconds - target) - Math.abs(b.seconds - target) || a.cycles - b.cycles)[0] : options.find(o => o.cycles === requestedCycles);
  if (!selected) throw new Error('Für diese Dauer und Pausen passt keine vollständige Runde.');
  const games: HallGame[] = Array.from({ length: selected.cycles }, () => pairs).flat().map(([home, away]) => ({ home, away, status: 'pending', elapsed: 0, runningSince: null, goals: [] }));
  return { ...selected, games, gamesPerTeam: selected.cycles * (count - 1), playPerTeam: selected.cycles * (count - 1) * selected.seconds };
}
export function createHallDay(count = 3, format: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 = 3, total = 3600, pause = 120, target = 480, cycles?: number): HallDay {
  const plan = calculateHallSchedule(count, total, pause, target, cycles);
  return { version: 1, teams: HALL_NAMES.slice(0, count).map(name => ({ name, playerIds: [] })), format, total, pause, target, cycles: plan.cycles, seconds: plan.seconds, buffer: plan.buffer, games: plan.games };
}
export function hallElapsed(game: HallGame, seconds: number, now = Date.now()): number {
  return Math.min(seconds, Math.max(0, game.elapsed + (game.status === 'running' && game.runningSince !== null ? (now - game.runningSince) / 1000 : 0)));
}
export function hallScore(game: HallGame, team: number) { return game.goals.filter(goal => goal.team === team).length; }
export function hallReady(day: HallDay, available: readonly string[]) {
  const ids = day.teams.flatMap(t => t.playerIds);
  return day.games.length > 0 && day.teams.every(t => t.name.trim() && t.playerIds.length >= day.format) && ids.length === available.length && ids.length === new Set(ids).size && ids.every(id => available.includes(id));
}
export function hallStandings(day: HallDay) {
  return day.teams.map((team, id) => {
    const finished = day.games.filter(g => g.status === 'finished' && (g.home === id || g.away === id));
    let points = 0, goals = 0, against = 0;
    for (const g of finished) { const a = hallScore(g, id), b = hallScore(g, g.home === id ? g.away : g.home); goals += a; against += b; points += a > b ? 3 : a === b ? 1 : 0; }
    return { id, name: team.name, played: finished.length, points, goals, against };
  }).sort((a, b) => b.points - a.points || (b.goals - b.against) - (a.goals - a.against) || b.goals - a.goals || a.id - b.id);
}
export function hallClock(seconds: number) { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/** Saved days without an individual duration keep the calculated default. */
export function hallGameSeconds(day: HallDay, game: HallGame) { return game.seconds ?? day.seconds; }
export function hallPlanSeconds(day: HallDay) {
  return day.games.reduce((sum, game) => sum + hallGameSeconds(day, game), 0) + Math.max(0, day.games.length - 1) * day.pause;
}
export function withHallGameDuration(day: HallDay, index: number, seconds: number): HallDay {
  if (!Number.isInteger(seconds) || seconds < 60 || seconds > 1800) throw new Error('Bitte eine Spielzeit von 1:00 bis 30:00 Minuten wählen.');
  if (!day.games[index] || day.games[index].status !== 'pending') throw new Error('Die Spielzeit kann nur vor Spielbeginn geändert werden.');
  const next = structuredClone(day);
  next.games[index].seconds = seconds;
  const total = hallPlanSeconds(next);
  if (total > 10800) throw new Error('Der gesamte Spielplan darf höchstens 180 Minuten dauern.');
  next.buffer = Math.max(0, next.total - total);
  return next;
}
export function hallScorers(day: HallDay) {
  const players = new Map<string, { id: string; name: string; goals: number; teams: number[] }>();
  let unassigned = 0;
  for (const game of day.games.filter(g => g.status === 'finished')) for (const goal of game.goals) {
    if (goal.ownGoal) continue;
    if (!goal.scorerId) { unassigned++; continue; }
    const row = players.get(goal.scorerId) ?? { id: goal.scorerId, name: goal.scorerName || 'Spieler', goals: 0, teams: [] };
    row.goals++;
    if (goal.scorerName) row.name = goal.scorerName;
    if (!row.teams.includes(goal.team)) row.teams.push(goal.team);
    players.set(row.id, row);
  }
  const sorted = [...players.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'de-AT'));
  return { unassigned, players: sorted.map((row, index) => ({ ...row, rank: sorted.findIndex(other => other.goals === row.goals) + 1 })) };
}

/** Relabel schedule slots before kickoff; teams, rosters and per-slot times stay intact. */
export function withHallFirstPairing(day: HallDay, home: number, away: number): HallDay {
  const n = day.teams.length;
  if (day.games.some(game => game.status !== 'pending')) throw new Error('Erste Begegnung nur vor dem ersten Anpfiff ändern.');
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home >= n || away >= n || home === away || !day.games.length) throw new Error('Bitte zwei verschiedene Teams wählen.');
  const first = day.games[0];
  const mapping = new Map<number, number>([[first.home, home], [first.away, away]]);
  const remaining = Array.from({ length: n }, (_, i) => i).filter(i => i !== home && i !== away);
  for (let i = 0; i < n; i++) if (!mapping.has(i)) mapping.set(i, remaining.shift()!);
  return { ...day, games: day.games.map(game => ({ ...game, home: mapping.get(game.home)!, away: mapping.get(game.away)! })) };
}

export type HallParticipation = { roster: string[]; stints: { second: number; on: string[] }[] };
/** Snapshot rosters prevent later team edits from rewriting played minutes. */
export function hallPlayerTimes(day: HallDay, now = Date.now()) {
 const ids = new Set(day.teams.flatMap(t => t.playerIds));
 day.games.forEach(g => Object.values(g.participation ?? {}).forEach(p => p.roster.forEach(id => ids.add(id))));
 const totals = new Map([...ids].map(id => [id, 0]));
 let untracked = 0;
 const estimated = new Set<string>(), incomplete = new Set<string>();
 for (const g of day.games) {
  if (g.status === 'pending') continue;
  if (!g.participation) {
   untracked++;
   const duration = hallElapsed(g, hallGameSeconds(day, g), now);
   for (const team of [g.home, g.away]) {
    const roster = day.teams[team]?.playerIds ?? [];
    if (roster.length === day.format && duration > 0) {
     roster.forEach(id => { totals.set(id, (totals.get(id) ?? 0) + duration); estimated.add(id); });
    } else roster.forEach(id => incomplete.add(id));
   }
   continue;
  }
  const end = hallElapsed(g, hallGameSeconds(day, g), now);
  for (const p of Object.values(g.participation)) p.stints.forEach((stint, i) => {
   const duration = Math.max(0, Math.min(end, p.stints[i + 1]?.second ?? end) - stint.second);
   stint.on.forEach(id => totals.set(id, (totals.get(id) ?? 0) + duration));
  });
 }
 return { players: [...totals].map(([id, seconds]) => ({ id, seconds, estimated: estimated.has(id), incomplete: incomplete.has(id) })).sort((a,b) => a.seconds-b.seconds || a.id.localeCompare(b.id)), untracked };
}
export function prepareHallPlayers(day: HallDay, index: number): HallDay {
 const next = structuredClone(day), game = next.games[index];
 if (!game || game.status !== 'pending') throw new Error('Aufstellung nur vor Anpfiff vorbereiten.');
 if (game.participation) return next;
 const times = new Map(hallPlayerTimes(day).players.map(p => [p.id, p.seconds]));
 game.participation = {};
 const withdrawn = new Set(day.games.slice(0, index).flatMap(g => g.withdrawn ?? []));
 for (const team of [game.home,game.away]) {
  const roster = day.teams[team].playerIds.filter(id => !withdrawn.has(id));
  const on = [...roster].sort((a,b) => (times.get(a) ?? 0)-(times.get(b) ?? 0)).slice(0,day.format);
  game.participation[team] = { roster, stints: [{ second: 0, on }] };
 }
 return next;
}
export function changeHallPlayers(day: HallDay, index: number, team: number, on: string[], now = Date.now()): HallDay {
 const next = structuredClone(day), game = next.games[index], p = game?.participation?.[team];
 if (!game || !p || ![game.home,game.away].includes(team) || !['pending','running','paused'].includes(game.status)) throw new Error('Wechsel für dieses Spiel nicht möglich.');
 const minimum = Math.min(day.format, p.stints.at(-1)!.on.length);
 if (new Set(on).size !== on.length || on.length < minimum || on.length > day.format+1 || on.some(id => !p.roster.includes(id) || !hallCanPlay(game, team, id))) throw new Error('Bitte vollständige Aufstellung wählen (höchstens ein Zusatzspieler).');
 const second = game.status === 'pending' ? 0 : hallElapsed(game,hallGameSeconds(day,game),now);
 if (second >= hallGameSeconds(day,game)) throw new Error('Spielzeit abgelaufen.');
 recordHallStint(p, second, on);
 return next;
}

function recordHallStint(participation: HallParticipation, second: number, on: string[]) {
 const last = participation.stints.at(-1)!;
 if (second < last.second) throw new Error('Spieluhr aktualisieren und erneut versuchen.');
 if (last.second === second) participation.stints[participation.stints.length - 1] = { second, on };
 else participation.stints.push({ second, on });
}

export function hallCanPlay(game: HallGame, team: number, playerId: string): boolean {
 return !game.withdrawn?.includes(playerId)
  && (game.reliefTeams?.[playerId] === undefined || game.reliefTeams[playerId] === team);
}

export function hallReliefCandidates(day: HallDay, index: number, destination: number) {
 const game = day.games[index];
 const withdrawn = new Set(day.games.slice(0, index + 1).flatMap(g => g.withdrawn ?? []));
 if (!game?.participation) return [];
 return day.teams.flatMap((team, source) => {
  if (source === destination) return [];
  const participation = game.participation?.[source];
  return (participation?.roster ?? team.playerIds)
   .filter(id => !withdrawn.has(id) && hallCanPlay(game, source, id))
   .map(id => ({ id, source, onField: participation?.stints.at(-1)?.on.includes(id) ?? false }));
 });
}

/** Apply both sides of a relief substitution at one clock position. */
export function relieveHallPlayer(day: HallDay, index: number, team: number, outgoing: string, incoming: string, now = Date.now()): HallDay {
 const game = day.games[index];
 const on = game?.participation?.[team]?.stints.at(-1)?.on;
 if (!game || !on?.includes(outgoing) || !['running', 'paused'].includes(game.status)) throw new Error('Aushilfe ist nur für das laufende Spiel möglich.');
 const candidate = hallReliefCandidates(day, index, team).find(player => player.id === incoming);
 if (!candidate) throw new Error('Dieser Spieler ist für die Aushilfe nicht verfügbar.');
 const duration = hallGameSeconds(day, game);
 const second = hallElapsed(game, duration, now);
 if (second >= duration) throw new Error('Spielzeit abgelaufen.');
 const next = structuredClone(day);
 const match = next.games[index];
 const destination = match.participation![team];
 const source = match.participation![candidate.source];
 if (!destination.roster.includes(incoming)) destination.roster.push(incoming);
 if (candidate.onField && source) {
  recordHallStint(source, second, source.stints.at(-1)!.on.filter(id => id !== incoming));
 }
 recordHallStint(destination, second, on.map(id => id === outgoing ? incoming : id));
 match.withdrawn = [...(match.withdrawn ?? []), outgoing];
 match.reliefTeams = { ...match.reliefTeams, [incoming]: team };
 return next;
}

/** Late clock start: staff confirms that the finished match used its full planned duration. */
export function creditHallFullDuration(day: HallDay, index: number): HallDay {
 const game = day.games[index];
 if (!game || game.status !== 'finished') throw new Error('Nur beendete Spiele können korrigiert werden.');
 const next = structuredClone(day);
 next.games[index].elapsed = hallGameSeconds(day, game);
 return next;
}

/** Indoor rotation: maximize playing time within a short-game limit, using complete rounds. */
export function calculateHallRotation(count: number, total: number, pause = 60, maxGameSeconds = 360) {
 const plans = Array.from({ length: 8 }, (_, i) => {
  try { return calculateHallSchedule(count, total, pause, maxGameSeconds, i + 1); }
  catch { return null; }
 }).filter((p): p is NonNullable<typeof p> => p !== null && p.seconds <= maxGameSeconds);
 const plan = plans.sort((a, b) => b.playPerTeam - a.playPerTeam || a.cycles - b.cycles)[0];
 if (!plan) throw new Error('Für diese Zeitbegrenzung passt keine vollständige Runde. Bitte mehr Spielzeit pro Match erlauben oder die Gesamtzeit verkürzen.');
 let longestWaitSeconds = 0;
 for (let team = 0; team < count; team++) {
  let previous = -1;
  plan.games.forEach((game, index) => {
   if (game.home !== team && game.away !== team) return;
   if (previous >= 0) longestWaitSeconds = Math.max(longestWaitSeconds, (index - previous - 1) * plan.seconds + (index - previous) * pause);
   previous = index;
  });
 }
 return { ...plan, longestWaitSeconds };
}

export function hallTimeMinutes(value: string): number {
 if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
 const [h, m] = value.split(':').map(Number); return h * 60 + m;
}
export function hallTimeAfter(start: string, minutes: number): string {
 const first = hallTimeMinutes(start);
 if (!Number.isFinite(first) || !Number.isFinite(minutes)) return '';
 const end = ((first + minutes) % 1440 + 1440) % 1440;
 return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}
export function hallWindowMinutes(start: string, end: string): number {
 const first = hallTimeMinutes(start), last = hallTimeMinutes(end);
 if (!Number.isFinite(first) || !Number.isFinite(last)) return NaN;
 return (last - first + 1440) % 1440;
}

export function calculateTrainingPlan(count: number, total: number, pause: number, target: number, cycles?: number) {
 if (count === 2) {
  if (total > 1800) throw new Error('Ein Einzelmatch dauert höchstens 30 Minuten. Bitte kürzer planen oder 3 bzw. 4 Teams wählen.');
  return calculateHallSchedule(2, total, 0, Math.min(1200, total), 1);
 }
 return cycles === undefined ? calculateHallRotation(count, total, pause, target) : calculateHallSchedule(count, total, pause, target, cycles);
}

/** Forecast assumes the active/paused game resumes now; elapsed wall-clock pauses are not playing time. */
export function hallTiming(day: HallDay, start: number, now = Date.now()) {
 const deadline = start + day.total * 1000;
 const pending = day.games.filter(g => g.status === 'pending');
 const active = day.games.find(g => g.status === 'running' || g.status === 'paused');
 const finished = day.games.filter(g => g.status === 'finished');
 const lastFinish = finished.reduce((latest, g) => Math.max(latest, g.finishedAt ?? 0), 0);
 const activeRemaining = active ? Math.max(0, hallGameSeconds(day, active) - hallElapsed(active, hallGameSeconds(day, active), now)) : 0;
 const wait = !active && pending.length && finished.length ? Math.max(0, day.pause - (lastFinish ? (now - lastFinish) / 1000 : 0)) : 0;
 const pauses = Math.max(0, pending.length - 1) * day.pause + (active && pending.length ? day.pause : wait);
 const base = Math.max(now, start);
 const remaining = activeRemaining + pauses + pending.reduce((sum, g) => sum + hallGameSeconds(day, g), 0);
 const projectedEnd = active || pending.length ? base + remaining * 1000 : lastFinish || null;
 const budget = Math.floor((deadline - base) / 1000 - activeRemaining - pauses);
 return { deadline, projectedEnd, delay: projectedEnd ? Math.max(0, Math.ceil((projectedEnd - deadline) / 1000)) : 0, pending: pending.length, budget, canFit: pending.length > 0 && budget >= pending.length * 60 };
}
/** Shorten pending slots with a common ceiling. Never extend slots or change played data. */
export function fitHallRemaining(day: HallDay, start: number, now = Date.now()): HallDay {
 const timing = hallTiming(day, start, now);
 if (!timing.canFit) throw new Error('Die verbleibenden Spiele passen selbst mit einer Minute Spielzeit nicht mehr bis zur Endzeit. Bitte Endzeit oder Ablauf manuell anpassen.');
 const pending = day.games.filter(g => g.status === 'pending');
 const budget = timing.budget - Math.min(15, timing.budget - pending.length * 60); // Small handoff buffer after saving.
 let low = 60, high = Math.max(...pending.map(g => hallGameSeconds(day, g)));
 while (low < high) {
  const cap = Math.ceil((low + high) / 2);
  if (pending.reduce((sum, g) => sum + Math.min(cap, hallGameSeconds(day, g)), 0) <= budget) low = cap;
  else high = cap - 1;
 }
 const next = structuredClone(day);
 next.games.forEach(g => { if (g.status === 'pending') { const previous = hallGameSeconds(day, g); const seconds = Math.min(previous, low); if (seconds < previous) { g.originalSeconds ??= previous; g.seconds = seconds; } } });
 next.buffer = Math.max(0, next.total - hallPlanSeconds(next));
 return next;
}
