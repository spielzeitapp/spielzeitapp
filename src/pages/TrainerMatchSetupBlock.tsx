
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../app/components/ui/Button';
import type { PlayerItem } from '../hooks/usePlayers';
import {
  LIVE_FIELD_SLOT_ORDER,
  persistLiveMatchBegin,
  replaceMatchLineupAndBench,
  saveMatchSquadOnly,
} from '../lib/liveMatchService';
import type { FieldSlotId } from '../types/match';

const MATCH_SETUP_STARTERS_MAX = 7;

function emptyMatchSetupStarters(): Record<FieldSlotId, string | null> {
  const o = {} as Record<FieldSlotId, string | null>;
  for (const s of LIVE_FIELD_SLOT_ORDER) o[s] = null;
  return o;
}

const normalizeId = (id: string | null | undefined): string | null => {
  const v = String(id ?? '').trim();
  return v.length > 0 ? v : null;
};

export function TrainerMatchSetupBlock({
  matchId,
  players,
  attendanceByPlayerId,
}: {
  matchId: string;
  players: PlayerItem[];
  attendanceByPlayerId?: Record<string, 'yes' | 'no'>;
}) {
  const navigate = useNavigate();

  // ✅ FIX 1: normalizeId statt toLowerCase
  const poolPlayers = useMemo(() => {
    const raw = attendanceByPlayerId ?? {};
    const hasRows = Object.keys(raw).length > 0;
    const hasYes = Object.values(raw).some((s) => s === 'yes');
    if (!hasRows || !hasYes) return players;

    return players.filter((p) => {
      const id = normalizeId(p.id);
      return id ? raw[id] === 'yes' : false;
    });
  }, [players, attendanceByPlayerId]);

  const sortedPlayers = useMemo(
    () =>
      [...poolPlayers].sort(
        (a, b) =>
          (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999) ||
          a.display_name.localeCompare(b.display_name, 'de'),
      ),
    [poolPlayers],
  );

  const [squad, setSquad] = useState<Set<string>>(() => new Set());
  const [startersBySlot, setStartersBySlot] = useState<Record<FieldSlotId, string | null>>(emptyMatchSetupStarters);

  // ✅ FIX 2: normalizeId beim Vergleich
  const squadPlayersSorted = useMemo(
    () =>
      sortedPlayers.filter((p) => {
        const id = normalizeId(p.id);
        return id ? squad.has(id) : false;
      }),
    [sortedPlayers, squad],
  );

  return (
    <div>
      <p>Fixed TrainerMatchSetupBlock</p>
      <p>Players in squad: {squadPlayersSorted.length}</p>
    </div>
  );
}
