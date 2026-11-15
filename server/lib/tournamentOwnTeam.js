const key = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g,' ');
export function resolveTournamentOwnTeam(teams, knownNames) {
 const names=new Set(knownNames.map(key));
 if(names.has('spg rohrbach') || names.has('nsg rohrbach')) {names.add('spg rohrbach');names.add('nsg rohrbach');}
 const found=[...new Set((teams ?? []).filter(t=>names.has(key(t.teamName))).map(t=>t.teamName))];
 return found.length===1 ? found[0] : null;
}
