export type ClubRosterProfile = { id:string; first_name:string; last_name:string; external_ids:string[]; memberships:{id:string;label:string}[] };
const normalize=(s:string)=>s.trim().replace(/\s+/g,' ').toLocaleLowerCase('de');
export function rosterIdentityMatches(profiles:ClubRosterProfile[], first:string,last:string,externalId?:string):ClubRosterProfile[] {
 return profiles.filter(p=>(externalId && p.external_ids.includes(externalId)) || (normalize(p.first_name||'')===normalize(first) && normalize(p.last_name||'')===normalize(last)));
}
export function rosterMembershipLabel(profile:ClubRosterProfile):string {return profile.memberships.map(m=>m.label).join(', ');}
