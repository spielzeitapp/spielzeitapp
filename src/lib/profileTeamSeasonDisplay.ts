import {
  isSeasonActive,
  resolveTeamSeasonLabelParts,
  type TeamSeasonLabelParts,
} from './seasonLifecycle';

/** Minimale Team-Season-Form für Profil-Labels (Session oder Join). */
export type ProfileTeamSeasonLike = {
  id?: string | null;
  status?: string | null;
  display_name?: string | null;
  age_group?: string | null;
  team?: { name?: string | null } | Array<{ name?: string | null }> | null;
  season?: { name?: string | null } | Array<{ name?: string | null }> | null;
} | null | undefined;

export type ProfileChildSeasonLabel = {
  teamSeasonId: string | null;
  teamLine: string | null;
  seasonLine: string | null;
};

export type ProfileTeamSeasonDisplay = {
  teamLine: string;
  seasonLine: string;
};

function joinName(
  value: { name?: string | null } | Array<{ name?: string | null }> | null | undefined,
): string {
  if (!value) return '';
  const row = Array.isArray(value) ? value[0] : value;
  return (row?.name ?? '').trim();
}

/** Saisonbezogene Anzeige — nie raw teams.name allein, wenn age_group/display_name da sind. */
export function labelPartsFromTeamSeasonLike(ts: ProfileTeamSeasonLike): TeamSeasonLabelParts | null {
  if (!ts) return null;
  const teamName = joinName(ts.team);
  const seasonName = joinName(ts.season);
  if (!teamName && !(ts.display_name ?? '').trim() && !(ts.age_group ?? '').trim()) {
    return null;
  }
  return resolveTeamSeasonLabelParts({
    displayName: ts.display_name,
    ageGroup: ts.age_group,
    teamName: teamName || null,
    seasonName: seasonName || null,
    status: ts.status,
  });
}

/**
 * Profil-Header Team/Saison.
 * Trainer/Spieler: aktive Session-team_season (Labels).
 * Eltern: aktive team_season_players der verknüpften Kinder (IDs), nicht Legacy-Teamstring.
 */
export function resolveProfileHeaderTeamSeason(opts: {
  role: string;
  selectedTeamSeason: ProfileTeamSeasonLike;
  selectedTeamSeasonId?: string | null;
  childrenLoaded: boolean;
  children: ProfileChildSeasonLabel[];
}): ProfileTeamSeasonDisplay {
  const role = (opts.role ?? '').trim().toLowerCase();
  const sessionParts = labelPartsFromTeamSeasonLike(opts.selectedTeamSeason);
  const empty: ProfileTeamSeasonDisplay = { teamLine: '–', seasonLine: '–' };

  if (role !== 'parent') {
    if (!sessionParts) return empty;
    return {
      teamLine: sessionParts.teamLine || '–',
      seasonLine: sessionParts.seasonLine || '–',
    };
  }

  if (!opts.childrenLoaded) {
    if (!sessionParts) return empty;
    return {
      teamLine: sessionParts.teamLine || '–',
      seasonLine: sessionParts.seasonLine || '–',
    };
  }

  const activeChildren = opts.children.filter(
    (c) => Boolean(c.teamSeasonId) && Boolean((c.teamLine ?? '').trim()),
  );

  // Kein Kind in aktiver Saison → kein automatisches U12 aus Parent-Membership.
  if (activeChildren.length === 0) {
    const selectedActive = isSeasonActive(opts.selectedTeamSeason?.status);
    if (selectedActive) return empty;
    if (!sessionParts) return empty;
    return {
      teamLine: sessionParts.teamLine || '–',
      seasonLine: sessionParts.seasonLine || '–',
    };
  }

  const bySeasonId = new Map<string, ProfileChildSeasonLabel>();
  for (const c of activeChildren) {
    const id = String(c.teamSeasonId);
    if (!bySeasonId.has(id)) bySeasonId.set(id, c);
  }

  const selectedId = opts.selectedTeamSeasonId ? String(opts.selectedTeamSeasonId) : null;
  if (selectedId && bySeasonId.has(selectedId) && sessionParts) {
    return {
      teamLine: sessionParts.teamLine || '–',
      seasonLine: sessionParts.seasonLine || '–',
    };
  }

  if (bySeasonId.size === 1) {
    const only = [...bySeasonId.values()][0];
    return {
      teamLine: (only.teamLine ?? '').trim() || '–',
      seasonLine: (only.seasonLine ?? '').trim() || '–',
    };
  }

  // Mehrere aktive Kind-Saisons: Session-Kontext nur wenn er zu einem Kind passt.
  if (selectedId && bySeasonId.has(selectedId) && sessionParts) {
    return {
      teamLine: sessionParts.teamLine || '–',
      seasonLine: sessionParts.seasonLine || '–',
    };
  }

  return { teamLine: 'Mehrere Teams', seasonLine: '—' };
}
