/** Public match view: own-team names and sporting data, never raw private payloads. */
export function buildPublicTournamentMatchDetails({matches, roster, events, currentRows, kickoffRows, benchRows, unavailable = false}) {
  const names = new Map(roster.map(row => [row.player_id, [row.players?.first_name,row.players?.last_name].filter(Boolean).join(' ')]));
  const slots = new Set(['GK','LB','RB','CM','LW','RW','ST','FP']);
  const kinds = {kickoff:'start',start:'start',period_start:'resume',resume:'resume',period_end:'pause',pause:'pause',final_whistle:'end',end:'end',goal:'goal',goal_away:'goal_away',substitution:'substitution',substitution_in:'sub_in',substitution_out:'sub_out',sub_in:'sub_in',sub_out:'sub_out',extra_player_on:'extra_player_on',extra_player_off:'extra_player_off'};
  return matches.map(match => {
    const kickoff = kickoffRows.filter(row => row.match_id === match.id);
    const source = kickoff.length ? kickoff : currentRows.filter(row => row.match_id === match.id);
    const startingPlayers = source.filter(row => slots.has(row.slot) && names.get(row.player_id)).map(row => ({name:names.get(row.player_id),position:row.slot}));
    const seen = new Set();
    const starters = startingPlayers.filter(row => {if(seen.has(row.name))return false;seen.add(row.name);return true;});
    const changes = events.filter(row => row.match_id === match.id && kinds[row.type]).map((row,index) => {
      const data = row.payload && typeof row.payload === 'object' ? row.payload : {};
      return {id:String(index),type:kinds[row.type],second:Math.max(0,Math.min(5400,Number(row.minute) || 0)),playerName:names.get(row.player_id) || null,otherPlayerName:names.get(data.player_in_id) || null,removedPlayerName:names.get(data.removed_player_id) || names.get(row.player_id) || null};
    });
    let elapsedSeconds = Math.max(0,Number(match.live_elapsed_seconds) || 0);
    if(match.status === 'live' && match.live_is_running && match.live_started_at) {
      const delta = Math.floor((Date.now()-Date.parse(match.live_started_at))/1000);
      if(Number.isFinite(delta)) elapsedSeconds += Math.max(0,delta);
    }
    elapsedSeconds = Math.min(5400,Math.max(elapsedSeconds,...changes.map(row=>row.second),0));
    return {id:match.id,formation:/^1-(?:\d+-?){1,4}$/.test(match.u11_formation_id || '')?match.u11_formation_id:null,startingPlayers:starters,benchPlayers:[...new Set(benchRows.filter(row=>row.match_id===match.id).map(row=>names.get(row.player_id)).filter(name=>name&&!seen.has(name)))],events:changes,elapsedSeconds,timingAvailable:!unavailable&&kickoff.length>0&&changes.some(row=>row.type==='start')&&elapsedSeconds>0,unavailable};
  });
}
