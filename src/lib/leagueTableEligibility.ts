/** Youth tables start at U13; senior categories may also have a linked league table. */
export function supportsLeagueTable(ageGroup?:string|null):boolean {
 const category=(ageGroup??'').trim().toUpperCase();
 if(['KM','KAMPFMANNSCHAFT','RES','RESERVE','HERREN','FRAUEN','DAMEN'].includes(category))return true;
 const age=/^U\s*(\d{1,2})(?=$|[\s-]|[A-Z])/.exec(category)?.[1];
 return age!==undefined&&Number(age)>=13;
}
