import {supabase} from '../../lib/supabaseClient';
export type RegistrationPlayer={id:string;firstName:string;lastName:string;birthYear:number|null;birthYearSource?:'app'|'registration'|null;number:number|null};
export type TeamOption={id:string;name:string;ageGroup:string;season:string;logoUrl?:string|null};
export type Registration={id:string;eventId:string;teamName:string;teams:TeamOption[];revision:number;status:string;sourceTeamSeasonId:string|null;contactName:string;contactPhone:string;jerseyColors:string;players:RegistrationPlayer[];logo?:string|null;logoChoice?:string;registrationMode?:'app'|'guest';guestDetails?:{clubName:string;teamName:string}};
export type RegistrationEntry=Registration&{participantId:string;revoked:boolean;expiresAt:string|null};
export const statusLabel:Record<string,string>={not_invited:'Noch nicht eingeladen',invited:'Einladung offen',draft:'Entwurf',submitted:'Meldung prüfen',confirmed:'Bestätigt'};
export async function registrationApi<T>(action:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc('tournament_registration_v4',{p_action:action,p_args:args});
 if(error)throw new Error(error.code==='PGRST202'?'Die Mannschaftsmeldung ist hier noch nicht verfügbar.':error.message);
 return data as T;
}
export const registrationPath=(token:string)=>`/turnier-meldung/${encodeURIComponent(token)}`;
export function validateRegistrationPlayers(players:{id:string;number:unknown}[]):string|null{
 if(!players.length)return 'Bitte mindestens einen Spieler auswählen.';
 if(players.length>40)return 'Bitte maximal 40 Spieler auswählen.';
 if(new Set(players.map(p=>p.id)).size!==players.length)return 'Spieler darf nur einmal ausgewählt sein.';
 if(players.some(p=>!/^\d{1,2}$/.test(String(p.number??''))))return 'Bitte Rückennummern von 0 bis 99 ergänzen.';
 if(new Set(players.map(p=>Number(p.number))).size!==players.length)return 'Jede Rückennummer darf nur einmal vergeben werden.';
 return null;
}

/** Display names may already include age group and season. Add each label only once. */
export function registrationTeamLabel(team:TeamOption):string {
 const parts=String(team.name??'').split(/\s*[·|]\s*/).map(s=>s.trim()).filter(Boolean);
 for(const extra of [team.ageGroup,team.season]){
  if(!extra?.trim())continue;
  const escaped=extra.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(!new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`,'i').test(parts.join(' ')))parts.push(extra.trim());
 }
 return [...new Set(parts)].join(' · ');
}

export function validateRegistrationYears(players:{birthYear:unknown}[],required:boolean):string|null{
 const current=new Date().getFullYear();
 for(const player of players){
  const raw=String(player.birthYear??'');
  if(!raw){if(required)return 'Bitte fehlende Jahrgänge im Turnierkader ergänzen.';continue;}
  if(!/^\d{4}$/.test(raw)||Number(raw)<current-100||Number(raw)>current)return 'Bitte einen gültigen vierstelligen Jahrgang eingeben.';
 }
 return null;
}
