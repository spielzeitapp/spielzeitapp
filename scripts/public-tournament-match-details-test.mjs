import assert from 'node:assert/strict';
import {buildPublicTournamentMatchDetails} from '../server/lib/publicTournamentMatchDetails.js';
import {assertPublicDtoSafe} from '../server/lib/publicTeamTournamentLogic.js';
const input={matches:[{id:'own',status:'finished',u11_formation_id:'1-2-2',live_elapsed_seconds:720}],roster:[{player_id:'a',players:{first_name:'Daniel',last_name:'Baumann'}}],currentRows:[{match_id:'own',player_id:'a',slot:'GK'}],kickoffRows:[{match_id:'own',player_id:'a',slot:'GK'}],benchRows:[],events:[{match_id:'foreign',type:'goal',minute:1,player_id:'a'},{match_id:'own',type:'kickoff',minute:0,payload:{notes:'PRIVATE'}},{match_id:'own',type:'goal',minute:360,player_id:'a',payload:{email:'PRIVATE'}}]};
const [detail]=buildPublicTournamentMatchDetails(input);
assert.equal(detail.formation,'1-2-2');assert.equal(detail.events.length,2);assert.equal(detail.events[1].second,360);assert.equal(detail.events[1].playerName,'Daniel Baumann');assert.equal(detail.timingAvailable,true);assertPublicDtoSafe({matchDetails:[detail]});assert(!JSON.stringify(detail).includes('PRIVATE'));
assert.equal(buildPublicTournamentMatchDetails({...input,kickoffRows:[]})[0].timingAvailable,false);
assert.equal(buildPublicTournamentMatchDetails({...input,unavailable:true})[0].timingAvailable,false);
console.log('Public match details: own matches, kickoff snapshot, event seconds and private-payload exclusion OK');
