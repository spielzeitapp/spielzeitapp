import { supabase } from './supabaseClient';

/** Wenn `team` im Session-Join fehlt: team_id aus team_seasons. */
export async function resolveTeamIdFromSeasonId(teamSeasonId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select('team_id')
    .eq('id', teamSeasonId)
    .maybeSingle();
  if (error) {
    console.warn('[resolveTeamIdFromSeasonId]', error.message);
    return null;
  }
  const tid = (data as { team_id?: string } | null)?.team_id;
  return tid != null ? String(tid) : null;
}

export type PushTemplateRow = {
  id: string;
  team_id: string;
  created_by: string | null;
  title: string;
  message: string;
  link: string | null;
  created_at: string;
};

export async function fetchTemplates(teamId: string): Promise<PushTemplateRow[]> {
  const { data, error } = await supabase
    .from('push_templates')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[fetchTemplates]', error.message);
    return [];
  }
  return (data as PushTemplateRow[]) ?? [];
}

export async function createTemplate(opts: {
  teamId: string;
  userId: string;
  title: string;
  message: string;
  link: string | null;
}): Promise<{ ok: boolean; id?: string }> {
  const { data, error } = await supabase
    .from('push_templates')
    .insert({
      team_id: opts.teamId,
      created_by: opts.userId,
      title: opts.title.trim(),
      message: opts.message.trim(),
      link: opts.link?.trim() ? opts.link.trim() : null,
    })
    .select('id')
    .maybeSingle();
  if (error) {
    console.warn('[createTemplate]', error.message);
    return { ok: false };
  }
  return { ok: true, id: (data as { id?: string })?.id };
}

export async function updateTemplate(opts: {
  id: string;
  teamId: string;
  title: string;
  message: string;
  link: string | null;
}): Promise<{ ok: boolean }> {
  const { data, error } = await supabase
    .from('push_templates')
    .update({
      title: opts.title.trim(),
      message: opts.message.trim(),
      link: opts.link?.trim() ? opts.link.trim() : null,
    })
    .eq('id', opts.id)
    .eq('team_id', opts.teamId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.warn('[updateTemplate]', error.message);
    return { ok: false };
  }
  if (!data) {
    console.warn('[updateTemplate] no row updated (id/team mismatch or RLS)');
    return { ok: false };
  }
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const { error } = await supabase.from('push_templates').delete().eq('id', id);
  if (error) {
    console.warn('[deleteTemplate]', error.message);
    return false;
  }
  return true;
}
