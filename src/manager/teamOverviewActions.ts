export type TeamQuickAction = 'photo' | 'staff' | 'appearance' | 'roster' | 'matches' | 'table' | 'training';

export function teamOverviewActionUrl(clubId: string, season: string, overviewClub: string, action?: TeamQuickAction) {
  const query = new URLSearchParams({ setupSeason: season });
  if (clubId !== overviewClub) query.set('overviewClub', overviewClub);
  if (action === 'photo') query.set('setupStep', 'photo');
  const anchor = action === 'staff' ? 'club-trainer-setup' : action === 'appearance' ? 'club-team-appearance'
    : action === 'photo' ? 'manager-setup-checklist' : action ? 'club-team-action-' + action : 'manager-setup-checklist';
  return '/manager/vereine/' + encodeURIComponent(clubId) + '?' + query + '#' + anchor;
}

export function teamQuickWorkspace(hash: string, seasonId: string) {
  const base = '/manager/saisons/' + encodeURIComponent(seasonId);
  switch (hash) {
    case '#club-team-action-roster': return base + '/kader';
    case '#club-team-action-matches': return base + '/oefb-import#oefb-schedule-settings';
    case '#club-team-action-table': return base + '/oefb-import#oefb-table-settings';
    case '#club-team-action-training': return '/manager/termine';
    default: return null;
  }
}

export function teamOverviewReturnUrl(clubId: string, seasonId: string, overviewClub: string | null) {
  const previous = overviewClub && /^[0-9a-f-]{36}$/i.test(overviewClub) ? overviewClub : null;
  const query = previous && previous !== clubId ? '' : '?setupSeason=' + encodeURIComponent(seasonId);
  return '/manager/vereine/' + encodeURIComponent(previous ?? clubId) + query + '#club-team-overview';
}
