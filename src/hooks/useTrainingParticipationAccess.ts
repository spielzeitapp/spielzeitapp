import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  canViewTrainingParticipationForPlayer,
  canViewAnyTrainingParticipation,
} from '../lib/trainingParticipationAccess';
import { canManageMatches, normalizeRole } from '../lib/roles';
import { supabase } from '../lib/supabaseClient';

/**
 * Lädt Eltern-/Spieler-Verknüpfungen und prüft Sichtbarkeit von Trainingsbeteiligung.
 */
export function useTrainingParticipationAccess(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  const isStaff = canManageMatches(normalizedRole) || normalizedRole === 'admin';

  const [linkedChildIds, setLinkedChildIds] = useState<string[]>([]);
  const [viewerPlayerIds, setViewerPlayerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setError(null);

      if (isStaff || !canViewAnyTrainingParticipation(role)) {
        if (alive) {
          setLinkedChildIds([]);
          setViewerPlayerIds([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        if (alive) {
          setLinkedChildIds([]);
          setViewerPlayerIds([]);
          setLoading(false);
        }
        return;
      }

      if (normalizedRole === 'parent') {
        const res = await supabase.from('player_guardians').select('player_id').eq('user_id', user.id);
        if (!alive) return;
        if (res.error) {
          setError(res.error.message);
          setLinkedChildIds([]);
        } else {
          setLinkedChildIds((res.data ?? []).map((r: { player_id: string }) => r.player_id));
        }
        setViewerPlayerIds([]);
        setLoading(false);
        return;
      }

      if (normalizedRole === 'player') {
        const res = await supabase.from('player_users').select('player_id').eq('user_id', user.id);
        if (!alive) return;
        if (res.error) {
          setError(res.error.message);
          setViewerPlayerIds([]);
        } else {
          setViewerPlayerIds((res.data ?? []).map((r: { player_id: string }) => r.player_id));
        }
        setLinkedChildIds([]);
        setLoading(false);
        return;
      }

      if (alive) {
        setLinkedChildIds([]);
        setViewerPlayerIds([]);
        setLoading(false);
      }
    }

    void load().catch((e) => {
      if (!alive) return;
      setError(e instanceof Error ? e.message : String(e));
      setLinkedChildIds([]);
      setViewerPlayerIds([]);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [role, normalizedRole, isStaff]);

  const canViewForPlayer = useCallback(
    (targetPlayerId: string) =>
      canViewTrainingParticipationForPlayer({
        viewerRole: role,
        linkedChildIds,
        viewerPlayerIds,
        targetPlayerId,
      }),
    [role, linkedChildIds, viewerPlayerIds],
  );

  const canViewAny = useMemo(() => canViewAnyTrainingParticipation(role), [role]);

  return { canViewForPlayer, canViewAny, isStaff, linkedChildIds, viewerPlayerIds, loading, error };
}
