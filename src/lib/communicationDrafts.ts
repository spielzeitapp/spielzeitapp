import { supabase } from './supabaseClient';
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
