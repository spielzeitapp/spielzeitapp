import { useEffect, useState } from 'react';
import { useSession } from '../auth/useSession';
import { supabase } from '../lib/supabaseClient';
export const FAVORITES_CHANGED_EVENT = 'spielzeit-favorites-changed';
export type SavedTeamFavorite = { id: string; name: string; ageGroup: string; season: string; logo: string | null };
export function useSavedTeamFavorites() {
  const { user } = useSession();
  const [teams, setTeams] = useState<SavedTeamFavorite[]>([]);
  useEffect(() => {
    let revision = 0;
    let disposed = false;
    const load = async () => {
      const current = ++revision;
      setTeams([]);
      if (!user?.id) return;
      let ids: string[] = [];
      try { const raw = JSON.parse(localStorage.getItem(`spz_discovered_team_favorites_${user.id}`) || '[]'); if (Array.isArray(raw)) ids = raw.filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 30); } catch { return; }
      if (!ids.length) return;
      const { data, error } = await supabase.from('team_seasons').select('id,age_group,teams!inner(name,clubs!inner(status,logo_url)),seasons(name)').in('id', ids).eq('status','active');
      if (disposed || current !== revision || error) return;
      setTeams((data ?? []).flatMap(row => {
        const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
        const club = team && (Array.isArray(team.clubs) ? team.clubs[0] : team.clubs);
        const season = Array.isArray(row.seasons) ? row.seasons[0] : row.seasons;
        return team && club?.status === 'active' ? [{ id: row.id, name: team.name, ageGroup: row.age_group || '', season: season?.name || '', logo: club.logo_url }] : [];
      }));
    };
    void load(); window.addEventListener(FAVORITES_CHANGED_EVENT, load); window.addEventListener('storage', load);
    return () => { disposed = true; window.removeEventListener(FAVORITES_CHANGED_EVENT, load); window.removeEventListener('storage', load); };
  }, [user?.id]);
  return teams;
}

export function useHiddenTeamFavoriteIds() {
  const { user } = useSession();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const load = () => {
      try {
        const raw = user?.id ? JSON.parse(localStorage.getItem(`spz_hidden_team_favorites_${user.id}`) || '[]') : [];
        setIds(Array.isArray(raw) ? raw.filter(id => typeof id === 'string') : []);
      } catch { setIds([]); }
    };
    load(); window.addEventListener(FAVORITES_CHANGED_EVENT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(FAVORITES_CHANGED_EVENT, load); window.removeEventListener('storage', load); };
  }, [user?.id]);
  return ids;
}
