/** Keep identity and age together, including imported names that already start with U12. */
export function marketFullTeamLabel(name:string,age?:string|null){
 const value=name.trim();const group=age?.trim()||value.match(/\bU\s*\d{1,2}(?:-\d+)?\b/i)?.[0];
 if(!group)return value;
 const base=value.replace(/\bU\s*\d{1,2}(?:-\d+)?\b/gi,'').replace(/\s+/g,' ').trim();
 return [base,group].filter(Boolean).join(' ');
}
