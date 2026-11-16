/** Favourites and archived seasons must not add clubs to a parent's exchange. */
export function exchangeMemberSeasonIds(memberships: Array<{ team_season_id: string; role: string }>, effectiveRole: string): Set<string> {
  const roles = effectiveRole === 'parent' ? ['parent'] : ['parent', 'trainer', 'head_coach', 'co_trainer', 'admin'];
  return new Set(memberships.filter(m => roles.includes(m.role)).map(m => m.team_season_id));
}
