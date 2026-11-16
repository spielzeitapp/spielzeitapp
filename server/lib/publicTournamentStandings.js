/** Combine official standings with completed own ticker results, once per fixture. */
export function publicTournamentStandings(analysis, slots, ownName) {
  const groups = new Map((analysis.groupStandings ?? []).map(g => [String(g.groupLabel ?? 'A'), g]));
  for (const team of analysis.teams ?? []) {
    const label = String(team.groupLabel ?? 'A');
    if (!groups.has(label)) groups.set(label, { groupLabel: label, rows: [] });
  }
  let provisional = false;
  const tables = [...groups].map(([label, group]) => {
    const names = [...new Set([...(group.rows ?? []).map(r => r.teamName), ...(analysis.teams ?? []).filter(t => String(t.groupLabel ?? 'A') === label).map(t => t.teamName)])];
    const games = (analysis.rawMatches ?? []).filter(m => m.phase === 'group' && String(m.groupLabel ?? 'A') === label);
    const own = slots.filter(s => s.match_status === 'finished' && s.phase === 'group' && String(s.group_label ?? 'A') === label);
    const officialRows = group.rows ?? [];
    if (!own.length) return {groupLabel:label, rows:officialRows.length ? officialRows : names.map(teamName => ({teamName,rank:0,played:0,goalsFor:0,goalsAgainst:0,points:0}))};
    const matchesOfficial = own.every(slot => {
      const match = games.find(m => m.externalMatchId === slot.external_match_id);
      if (!match?.hasResult) return false;
      const home = match.homeTeam === ownName;
      return Number(match.homeGoals) === Number(home ? slot.score_home : slot.score_away) && Number(match.awayGoals) === Number(home ? slot.score_away : slot.score_home);
    });
    if (matchesOfficial && officialRows.some(r => Number(r.played)>0)) return {groupLabel:label, rows:officialRows};
    provisional = true;
    const rawResults = games.filter(m => m.hasResult && m.homeGoals != null && m.awayGoals != null);
    // Keep aggregate-only provider results when the provider omits older fixtures.
    const useAggregate = officialRows.reduce((n,r)=>n+Number(r.played || 0),0) > rawResults.length * 2;
    const rows = new Map(names.map(teamName => {
      const base = useAggregate ? officialRows.find(r=>r.teamName===teamName) : null;
      return [teamName,{teamName,rank:0,played:Number(base?.played || 0),goalsFor:Number(base?.goalsFor || 0),goalsAgainst:Number(base?.goalsAgainst || 0),points:Number(base?.points || 0)}];
    }));
    function apply(home, away, hg, ag, sign=1) {
      const h=rows.get(home), a=rows.get(away);
      if (!h || !a || !Number.isInteger(hg) || !Number.isInteger(ag) || hg<0 || ag<0) return;
      h.played+=sign;a.played+=sign;h.goalsFor+=hg*sign;h.goalsAgainst+=ag*sign;a.goalsFor+=ag*sign;a.goalsAgainst+=hg*sign;
      h.points+=(hg>ag?3:hg===ag?1:0)*sign;a.points+=(ag>hg?3:hg===ag?1:0)*sign;
    }
    const seen=new Set();
    const replacements=new Map();
    for (const slot of own) {
      const key=slot.match_id || slot.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const match=games.find(m => slot.external_match_id && m.externalMatchId===slot.external_match_id)
        ?? games.find(m => ((m.homeTeam===ownName && m.awayTeam===slot.opponent_name)||(m.awayTeam===ownName && m.homeTeam===slot.opponent_name)) && (!slot.home_team || m.homeTeam===slot.home_team));
      const home=match?.homeTeam ?? slot.home_team ?? ownName;
      const away=match?.awayTeam ?? slot.away_team ?? slot.opponent_name;
      const ownHome=home===ownName || away===slot.opponent_name;
      const hg=Number(ownHome?slot.score_home:slot.score_away),ag=Number(ownHome?slot.score_away:slot.score_home);
      if (!rows.has(home)||!rows.has(away)) continue;
      if (!match?.hasResult || match.homeGoals!==hg || match.awayGoals!==ag) provisional=true;
      if (useAggregate && match?.hasResult) apply(home,away,Number(match.homeGoals),Number(match.awayGoals),-1);
      if (match) replacements.set(match,{home,away,hg,ag});
      else apply(home,away,hg,ag);
    }
    for (const match of games) {
      const replacement=replacements.get(match);
      if (replacement) apply(replacement.home,replacement.away,replacement.hg,replacement.ag);
      else if (!useAggregate && match.hasResult) apply(match.homeTeam,match.awayTeam,Number(match.homeGoals),Number(match.awayGoals));
    }
    const sorted=[...rows.values()].sort((a,b)=>b.points-a.points || (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst) || b.goalsFor-a.goalsFor || a.teamName.localeCompare(b.teamName,'de'));
    sorted.forEach((r,i)=>{const prev=sorted[i-1];r.rank=prev && prev.points===r.points && prev.goalsFor-prev.goalsAgainst===r.goalsFor-r.goalsAgainst && prev.goalsFor===r.goalsFor ? prev.rank:i+1;});
    return {groupLabel:label,rows:sorted};
  });
  return {tables,provisional};
}
