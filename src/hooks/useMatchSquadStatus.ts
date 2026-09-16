import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type PersonalSquadStatus = 'selected' | 'not_selected';

/** Persönlicher Kaderstatus je Match; erst vorhanden, nachdem der Trainer veröffentlicht hat. */
export function useMatchSquadStatus(matchIds: string[], playerIds: string[]) {
  const [byMatchId, setByMatchId] = useState<Record<string, PersonalSquadStatus>>({});
  const matchKey = useMemo(() => [...new Set(matchIds.filter(Boolean))].sort().join('|'), [matchIds]);
  const playerKey = useMemo(() => [...new Set(playerIds.filter(Boolean))].sort().join('|'), [playerIds]);

  useEffect(() => {
    let cancelled = false;
    const mids = matchKey ? matchKey.split('|') : [];
    const pids = new Set(playerKey ? playerKey.split('|') : []);
    if (mids.length === 0 || pids.size === 0) {
      setByMatchId({});
      return () => { cancelled = true; };
    }
    void supabase
      .from('match_squad_publications')
      .select('match_id, selected_player_ids')
      .in('match_id', mids)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const next: Record<string, PersonalSquadStatus> = {};
        for (const row of (data ?? []) as Array<{ match_id: string; selected_player_ids: string[] | null }>) {
          const selected = new Set(row.selected_player_ids ?? []);
          next[row.match_id] = [...pids].some((id) => selected.has(id)) ? 'selected' : 'not_selected';
        }
        setByMatchId(next);
      });
    return () => { cancelled = true; };
  }, [matchKey, playerKey]);

  return byMatchId;
}
