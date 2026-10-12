export type SourcePlayer = { externalPlayerId: string; name: string };
export type SourceGoal = { external_player_id: string | null; home: number; away: number; own_goal: boolean; minute: number | null };
export type AssignmentReport = { external_id: string; score_home: number; score_away: number; goals: SourceGoal[] };
export type PublicReport = {
 id: string; score: string | null;
 homePlayers: { name: string; externalPlayerId: string | null }[];
 awayPlayers: { name: string; externalPlayerId: string | null }[];
 events: { type: string; player: string; externalPlayerId: string | null; side: string | null; score: string | null; ownGoal: boolean; minute: number | null }[];
};
export function assignmentPreview(report: PublicReport, isHome: boolean): { players: SourcePlayer[]; report: AssignmentReport | null } {
 const ownSide = isHome ? 'home' : 'away';
 const players = new Map<string, SourcePlayer>();
 for (const p of isHome ? report.homePlayers : report.awayPlayers) {
  if (p.externalPlayerId && /^\d{1,10}$/.test(p.externalPlayerId)) players.set(p.externalPlayerId, { externalPlayerId: p.externalPlayerId, name: p.name });
 }
 for (const e of report.events) {
  if (e.side === ownSide && e.externalPlayerId && /^\d{1,10}$/.test(e.externalPlayerId)) players.set(e.externalPlayerId, { externalPlayerId: e.externalPlayerId, name: e.player });
 }
 const score = /^(\d{1,3}):(\d{1,3})$/.exec(report.score ?? '');
 const goals = report.events.filter(e => e.type === 'goal').map(e => {
  const s = /^(\d{1,3}):(\d{1,3})$/.exec(e.score ?? '');
  return s ? { external_player_id: e.externalPlayerId, home: Number(s[1]), away: Number(s[2]), own_goal: e.ownGoal, minute: e.minute } : null;
 });
 if (!score || goals.some(g => !g)) return { players: [...players.values()], report: null };
 const sorted = (goals as SourceGoal[]).sort((a,b) => (a.home+a.away)-(b.home+b.away));
 let home=0,away=0;
 for (const g of sorted) {
  if (!((g.home===home+1 && g.away===away) || (g.home===home && g.away===away+1))) return { players: [...players.values()], report: null };
  home=g.home;away=g.away;
 }
 return { players: [...players.values()], report: home===Number(score[1]) && away===Number(score[2])
  ? { external_id: report.id, score_home: home, score_away: away, goals: sorted } : null };
}
