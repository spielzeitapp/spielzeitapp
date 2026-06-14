import { canManageMatches, normalizeRole } from './roles';

export type TrainingParticipationViewerContext = {
  viewerRole: string | null | undefined;
  /** Spieler-Rolle: eigene player_id(s) aus player_users. */
  viewerPlayerIds?: readonly string[] | null;
  /** Eltern-Rolle: verknüpfte Kinder aus player_guardians. */
  linkedChildIds?: readonly string[] | null;
};

/**
 * Darf der Betrachter die Trainingsbeteiligung (Quoten/Details) eines Spielers sehen?
 * Staff: alle. Eltern: nur verknüpfte Kinder. Spieler: nur eigenes Profil. Fan: keine.
 */
export function canViewTrainingParticipationForPlayer(
  ctx: TrainingParticipationViewerContext & { targetPlayerId: string | null | undefined },
): boolean {
  const role = normalizeRole(ctx.viewerRole);
  const target = (ctx.targetPlayerId ?? '').trim();
  if (!target) return false;

  if (canManageMatches(role) || role === 'admin') return true;

  if (role === 'parent') {
    const ids = ctx.linkedChildIds ?? [];
    return ids.some((id) => id === target);
  }

  if (role === 'player') {
    const ids = ctx.viewerPlayerIds ?? [];
    return ids.some((id) => id === target);
  }

  return false;
}

/** Darf die Rolle überhaupt irgendwelche Trainingsbeteiligungs-Daten sehen? */
export function canViewAnyTrainingParticipation(viewerRole: string | null | undefined): boolean {
  const role = normalizeRole(viewerRole);
  if (!role || role === 'fan') return false;
  return canManageMatches(role) || role === 'admin' || role === 'parent' || role === 'player';
}
