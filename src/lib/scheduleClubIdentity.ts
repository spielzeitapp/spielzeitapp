import {clubNameWithoutAgeGroup} from './seasonLifecycle';
/** Category belongs in the fixture badge, not in the club name. */
export function scheduleClubName(value:string):string {
 const name=clubNameWithoutAgeGroup(value);
 return name.replace(/^(?:KM|Kampfmannschaft)\s+(?:[·–-]\s*)?/i,'').replace(/\s*[·–-]\s*(?:KM|Kampfmannschaft)$/i,'').trim()||name;
}
