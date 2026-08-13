import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth/AuthProvider';
import { useSession } from '../../auth/useSession';
import { isSeasonActive } from '../../lib/seasonLifecycle';
import { labelPartsFromTeamSeasonLike } from '../../lib/profileTeamSeasonDisplay';

type ParentChildOption = {
  id: string;
  name: string;
  teamSeasonId: string | null;
  teamLine: string | null;
  seasonLine: string | null;
};

const LOCAL_STORAGE_KEY_SELECTED_CHILD_ID = 'spz_selected_parent_child_id';

export const ParentChildrenSwitcher: React.FC = () => {
  const { user: authUser } = useAuth();
  const {
    selectedTeamSeasonId,
    setSelectedTeamSeasonId,
  } = useSession();

  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<ParentChildOption[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setChildren([]);

      const uid = authUser?.id;
      if (!uid) {
        setLoading(false);
        return;
      }

      const { data: guardianRows, error: guardianError } = await supabase
        .from('player_guardians')
        .select('player_id')
        .eq('user_id', uid);

      if (!alive) return;

      if (guardianError) {
        console.warn('[ParentChildrenSwitcher] guardian load failed', guardianError.message ?? guardianError);
        setLoading(false);
        return;
      }

      const playerIds = Array.from(
        new Set((guardianRows ?? []).map((r: { player_id?: string }) => r.player_id).filter(Boolean)),
      ) as string[];

      if (playerIds.length === 0) {
        setChildren([]);
        setLoading(false);
        return;
      }

      const { data: playerRows, error: playerError } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .in('id', playerIds);

      if (!alive) return;

      if (playerError) {
        console.warn('[ParentChildrenSwitcher] player load failed', playerError.message ?? playerError);
        setChildren([]);
        setLoading(false);
        return;
      }

      const childrenBase: ParentChildOption[] = (playerRows ?? [])
        .map((row: { id?: string; first_name?: string; last_name?: string }) => {
          const first = (row.first_name ?? '').toString().trim();
          const last = (row.last_name ?? '').toString().trim();
          return {
            id: String(row.id ?? ''),
            name: `${first} ${last}`.trim() || 'Spieler',
            teamSeasonId: null,
            teamLine: null,
            seasonLine: null,
          };
        })
        .filter((c) => c.id.length > 0);

      if (childrenBase.length === 0) {
        setChildren([]);
        setLoading(false);
        return;
      }

      const { data: tspRows, error: tspError } = await supabase
        .from('team_season_players')
        .select(
          `
            player_id,
            status,
            team_seasons:team_seasons (
              id,
              status,
              display_name,
              age_group,
              teams:teams ( id, name ),
              seasons:seasons ( id, name )
            )
          `,
        )
        .in('player_id', childrenBase.map((c) => c.id))
        .eq('status', 'active');

      if (!alive) return;

      if (tspError) {
        // Kinder ohne Saison-Labels (Header fällt dann auf Session/Resolver zurück).
        setChildren(childrenBase);
        setLoading(false);
        return;
      }

      type TspRow = {
        player_id?: string;
        team_seasons?: any;
      };

      const activeByPlayer = new Map<string, ParentChildOption>();
      for (const row of (tspRows ?? []) as TspRow[]) {
        const pid = String(row.player_id ?? '');
        if (!pid || activeByPlayer.has(pid)) continue;

        const rawTs = Array.isArray(row.team_seasons) ? row.team_seasons[0] : row.team_seasons;
        if (!rawTs || !isSeasonActive(rawTs.status)) continue;

        const parts = labelPartsFromTeamSeasonLike({
          id: rawTs.id,
          status: rawTs.status,
          display_name: rawTs.display_name,
          age_group: rawTs.age_group,
          team: rawTs.teams,
          season: rawTs.seasons,
        });
        if (!parts) continue;

        activeByPlayer.set(pid, {
          id: pid,
          name: childrenBase.find((c) => c.id === pid)?.name ?? 'Spieler',
          teamSeasonId: rawTs.id ? String(rawTs.id) : null,
          teamLine: parts.teamLine,
          seasonLine: parts.seasonLine,
        });
      }

      const merged = childrenBase.map((c) => activeByPlayer.get(c.id) ?? c);
      setChildren(merged);
      setLoading(false);
    }

    void load();

    return () => {
      alive = false;
    };
  }, [authUser?.id]);

  const visibleChildren = useMemo(() => children.filter((c) => Boolean(c.teamSeasonId)), [children]);

  // Auswahl: persistierter Child -> Session.selectedTeamSeasonId
  useEffect(() => {
    if (loading) return;

    const storedId = (() => {
      try {
        return window.localStorage.getItem(LOCAL_STORAGE_KEY_SELECTED_CHILD_ID);
      } catch {
        return null;
      }
    })();

    const stored = storedId ? visibleChildren.find((c) => c.id === storedId) ?? null : null;
    const bySession = selectedTeamSeasonId
      ? visibleChildren.find((c) => c.teamSeasonId === selectedTeamSeasonId) ?? null
      : null;

    const chosen = stored ?? bySession ?? visibleChildren[0] ?? null;
    if (!chosen?.teamSeasonId) return;

    if (selectedTeamSeasonId !== chosen.teamSeasonId) {
      setSelectedTeamSeasonId(chosen.teamSeasonId);
    }

    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY_SELECTED_CHILD_ID, chosen.id);
    } catch {
      // ignore
    }
  }, [loading, selectedTeamSeasonId, setSelectedTeamSeasonId, visibleChildren]);

  if (loading) return null;
  if (visibleChildren.length <= 1) return null;

  return (
    <select
      value={selectedTeamSeasonId ?? ''}
      onChange={(e) => {
        const nextId = e.target.value;
        if (!nextId) return;
        const nextChild = visibleChildren.find((c) => c.teamSeasonId === nextId);
        if (!nextChild?.teamSeasonId) return;

        setSelectedTeamSeasonId(nextChild.teamSeasonId);
        try {
          window.localStorage.setItem(LOCAL_STORAGE_KEY_SELECTED_CHILD_ID, nextChild.id);
        } catch {
          // ignore
        }
      }}
      aria-label="Kind wechseln"
      className="inline-flex max-w-[min(42vw,9.5rem)] min-w-0 appearance-none truncate rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-medium text-white/90 sm:max-w-[11rem] sm:text-[11px]"
    >
      {visibleChildren.map((c) => (
        <option key={c.id} value={c.teamSeasonId ?? ''}>
          {c.teamLine ? `${c.name} · ${c.teamLine}` : c.name}
        </option>
      ))}
    </select>
  );
};

