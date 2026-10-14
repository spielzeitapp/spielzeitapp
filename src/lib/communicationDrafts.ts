import { supabase } from './supabaseClient';
export async function generateSpeakerTexts(body:{teamSeasonId:string;eventId:string;settings:Record<string,string>;sections:{id:string;title:string;text:string}[]}) {
 const {data,error}=await supabase.functions.invoke('generate-club-communications',{body:{...body,consent:true}});
 if(error){let detail='';try{const context=(error as {context?:Response}).context;if(context)detail=String((await context.json()).error??'');}catch{/* Preserve generic error if response is not JSON. */}throw new Error(detail||'KI-Anfrage nicht verfügbar. Bitte anmelden und erneut versuchen.');}
 if(!data||typeof data!=='object'||!Array.isArray(data.sections)||data.sections.some((s:unknown)=>!s||typeof s!=='object'||typeof (s as {id?:unknown}).id!=='string'||typeof (s as {text?:unknown}).text!=='string'))throw new Error('Ungültige KI-Antwort.');
 return data as {sections:{id:string;text:string}[];generatedAt:string;needsReview:boolean};
}
export type CommunicationDraft = { id: string; title: string; kind: 'media' | 'speaker'; payload: Record<string, unknown>; revision: number; updated_at: string };
export async function listCommunicationDrafts(teamSeasonId: string, kind: 'media' | 'speaker') {
 const { data, error } = await supabase.from('manager_communication_drafts').select('id,title,kind,payload,revision,updated_at').eq('team_season_id',teamSeasonId).eq('kind',kind).order('updated_at',{ascending:false});
 return { data: (data ?? []) as CommunicationDraft[], error: error?.message ?? null };
}
export async function saveCommunicationDraft(teamSeasonId: string, kind: 'media' | 'speaker', title: string, payload: Record<string,unknown>, previous: CommunicationDraft | null) {
 const values = { title: title.trim().slice(0,160) || 'Entwurf', payload };
 const query = previous
  ? supabase.from('manager_communication_drafts').update(values).eq('id',previous.id).eq('team_season_id',teamSeasonId).eq('kind',kind).eq('revision',previous.revision)
  : supabase.from('manager_communication_drafts').insert({...values,team_season_id:teamSeasonId,kind});
 const { data, error } = await query.select('id,title,kind,payload,revision,updated_at').maybeSingle();
 return { data: data as CommunicationDraft | null, error: error?.message ?? (!data ? 'Der Entwurf wurde geändert oder der Zugriff ist nicht mehr verfügbar. Bitte neu laden.' : null) };
}
