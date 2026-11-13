/** Internal training only. No matches, feed posts or league statistics are created. */
export type HallTeam = { name: string; playerIds: string[] };
export type HallGoal = { team: number; second: number; ownGoal?: boolean; timeUnknown?: boolean; scorerId?: string; scorerName?: string };
export type HallGame = { participation?: Record<string, HallParticipation>; seconds?: number; home: number; away: number; status: 'pending' | 'running' | 'paused' | 'finished'; elapsed: number; runningSince: number | null; goals: HallGoal[] };
export type HallDay = { version: 1; teams: HallTeam[]; format: 2 | 3 | 4; total: number; pause: number; target: number; cycles: number; seconds: number; buffer: number; games: HallGame[] };
export const HALL_COLORS = ['#fb425c', '#419cff', '#facc15', '#4ade80'];
export const HALL_NAMES = ['Rot', 'Blau', 'Gelb', 'Grün'];
export function isHallTraining(title: string, location?: string | null) {
  return /hallen?[-\s]?training|turnsaal|turnhalle|sporthalle/i.test(`${title} ${location ?? ''}`);
}
/** Complete round-robin cycles only; never truncate a cycle to fill the time. */
export function calculateHallSchedule(count: number, total: number, pause: number, target = 480, requestedCycles?: number) {
  if (![3, 4].includes(count) || !Number.isInteger(total) || total < 900 || total > 10800 || !Number.isInteger(pause) || pause < 0 || pause > 300 || !Number.isInteger(target) || target < 120 || target > 1200) throw new Error('Bitte 3 oder 4 Teams, 15–180 Minuten und gültige Pausen wählen.');
  const pairs: [number, number][] = count === 3 ? [[0, 1], [0, 2], [1, 2]] : [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
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
export function createHallDay(count = 3, format: 2 | 3 | 4 = 3, total = 3600, pause = 120, target = 480, cycles?: number): HallDay {
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
 for (const g of day.games) {
  if (g.status === 'pending') continue;
  if (!g.participation) { untracked++; continue; }
  const end = hallElapsed(g, hallGameSeconds(day, g), now);
  for (const p of Object.values(g.participation)) p.stints.forEach((stint, i) => {
   const duration = Math.max(0, Math.min(end, p.stints[i + 1]?.second ?? end) - stint.second);
   stint.on.forEach(id => totals.set(id, (totals.get(id) ?? 0) + duration));
  });
 }
 return { players: [...totals].map(([id, seconds]) => ({ id, seconds })).sort((a,b) => a.seconds-b.seconds || a.id.localeCompare(b.id)), untracked };
}
export function prepareHallPlayers(day: HallDay, index: number): HallDay {
 const next = structuredClone(day), game = next.games[index];
 if (!game || game.status !== 'pending') throw new Error('Aufstellung nur vor Anpfiff vorbereiten.');
 if (game.participation) return next;
 const times = new Map(hallPlayerTimes(day).players.map(p => [p.id, p.seconds]));
 game.participation = {};
 for (const team of [game.home,game.away]) {
  const roster = [...day.teams[team].playerIds];
  const on = [...roster].sort((a,b) => (times.get(a) ?? 0)-(times.get(b) ?? 0)).slice(0,day.format);
  game.participation[team] = { roster, stints: [{ second: 0, on }] };
 }
 return next;
}
export function changeHallPlayers(day: HallDay, index: number, team: number, on: string[], now = Date.now()): HallDay {
 const next = structuredClone(day), game = next.games[index], p = game?.participation?.[team];
 if (!game || !p || ![game.home,game.away].includes(team) || !['pending','running','paused'].includes(game.status)) throw new Error('Wechsel für dieses Spiel nicht möglich.');
 if (new Set(on).size !== on.length || on.length < day.format || on.length > day.format+1 || on.some(id => !p.roster.includes(id))) throw new Error('Bitte vollständige Aufstellung wählen (höchstens ein Zusatzspieler).');
 const second = game.status === 'pending' ? 0 : hallElapsed(game,hallGameSeconds(day,game),now);
 if (second >= hallGameSeconds(day,game)) throw new Error('Spielzeit abgelaufen.');
 if (p.stints.at(-1)!.second === second) p.stints[p.stints.length-1] = {second,on:[...on]};
 else p.stints.push({second,on:[...on]});
 return next;
}
