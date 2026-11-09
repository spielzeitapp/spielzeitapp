import {setupSteps,type SetupKey,type SetupStep,type SetupSnapshot} from '../../lib/managerSetupModel';
/** Uses the actual Manager's eleven checks; the prototype's eight-check total is not copied. */
export type ReferenceStep=Omit<SetupStep,'key'|'state'> & {key:SetupKey|'photo';state:SetupStep['state']|'unknown';to:string};
export function referenceSteps(snapshot:SetupSnapshot|null,photo:boolean|null,clubId:string|null,seasonId:string|null,canReviewClub=false):ReferenceStep[]{
 const setup=canReviewClub&&clubId&&seasonId?`/manager/vereine/${encodeURIComponent(clubId)}?setupSeason=${encodeURIComponent(seasonId)}`:'/manager/saisons';
 const rows=setupSteps(snapshot??{club_ready:false,team_ready:false,season_ready:false,staff:0,players:0,jerseys_missing:0,access:0,venues:0,matches:0,trainings:0,checks:{},updated_at:null});
 const targets:Record<string,string>={club:setup,team:'/manager/teams',season:'/manager/saisons',staff:canReviewClub&&seasonId?`/manager/saisons/${seasonId}/zugaenge`:'/manager/team?tab=trainers',roster:canReviewClub&&seasonId?`/manager/saisons/${seasonId}/kader`:'/manager/spieler',access:'/manager/mehr/parent-access',venues:'/manager/platzbelegung',matches:'/manager/spiele',training:'/manager/training/einheiten',review:'/manager/home'};
 const steps:ReferenceStep[]=rows.map(r=>({...r,detail:snapshot?r.detail:'Daten im zugehörigen Bereich prüfen.',state:snapshot?r.state:'unknown',to:targets[r.key]}));
 steps.splice(3,0,{key:'photo',title:'Mannschaftsfoto',detail:'Foto der Mannschaft prüfen.',present:photo===true,optional:false,state:photo===null?'unknown':photo?'done':'missing',to:canReviewClub&&clubId&&seasonId?setup+'&setupStep=photo#manager-setup-checklist':'/manager/team'});
 return steps;
}
