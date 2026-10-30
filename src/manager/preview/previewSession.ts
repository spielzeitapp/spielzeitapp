import type { SessionContextValue, SessionTeamSeasonItem } from '../../auth/useSession';
export function previewSession(userId: string, season: SessionTeamSeasonItem): SessionContextValue {
  const noop = () => {};
  const membership = { id: 'preview-only', team_season_id: season.id, role: 'fan' };
  return {
    user: { id: userId, name: 'App-Vorschau', role: 'fan' }, role: 'fan', effectiveRole: 'fan',
    backendRole: '', globalRole: '', membershipRole: 'fan', previewRole: null,
    selectedTeamId: String(season.team.id), teamSeasons: [season],
    selectedTeamSeasonId: season.id, selectedTeamSeason: season,
    viewTeamSeasonId: season.id, viewTeamSeason: season, activeTeamSeasonId: season.id,
    teamViewFilter: null, filteredTeamSeasonIds: [season.id],
    memberships: [membership], selectedMembership: membership,
    loading: false, membershipError: null, hasPendingPlayerRequest: false,
    playerAccessMode: null, isViewOnlyPlayer: true, canAccess: () => false,
    setRole: noop, setSelectedTeamId: noop, setTeamViewFilter: noop,
    setSelectedTeamSeasonId: noop, setViewTeamSeasonId: noop, setPreviewRole: noop,
    signOut: async () => {}, reloadSessionTeamSeasons: async () => {},
  };
}
/** Fail closed: preview reads only. These RPCs were reviewed as read operations. */
export function previewRequestAllowed(url: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  const path = new URL(url, 'https://preview.invalid').pathname;
  if (method === 'POST' && path.endsWith('/auth/v1/token')) return true;
  return method === 'POST' && [
    'admin_get_club', 'admin_get_club_branding', 'manager_list_my_club_admin_team_seasons',
    'club_effective_modules',
  ].some(name => path.endsWith('/rest/v1/rpc/' + name));
}

export function createPreviewFetch(fetcher: typeof fetch): typeof fetch {
  return (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!previewRequestAllowed(url, method)) return Promise.resolve(new Response(JSON.stringify({message:'In der App-Vorschau sind Änderungen gesperrt.'}), {status:403,headers:{'Content-Type':'application/json'}}));
    return fetcher(input, init);
  };
}
