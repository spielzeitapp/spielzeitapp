import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlayerItem } from './usePlayers';
import type { ChallengeResultRow, ChallengeSessionRow, JugglingChallengePlayerRow } from '../lib/challengeTypes';
import { supabase } from '../lib/supabaseClient';

const JUGGLING_TYPE = 'juggling';
const DEFAULT_TITLE = 'Gaberl-Challenge';

function mapResultRow(raw: Record<string, unknown>): ChallengeResultRow {
  return {
    id: String(raw.id),
    challenge_id: String(raw.challenge_id),
    player_id: String(raw.player_id),
    start_value: Number(raw.start_value) || 0,
    end_value: raw.end_value == null ? null : Number(raw.end_value),
    notes: typeof raw.notes === 'string' ? raw.notes : null,
    recorded_by: raw.recorded_by == null ? null : String(raw.recorded_by),
    updated_at: String(raw.updated_at ?? ''),
  };
}

function mapSessionRow(raw: Record<string, unknown>): ChallengeSessionRow {
  return {
    id: String(raw.id),
    team_season_id: String(raw.team_season_id),
    type: String(raw.type ?? JUGGLING_TYPE),
    title: String(raw.title ?? DEFAULT_TITLE),
    start_date: typeof raw.start_date === 'string' ? raw.start_date : null,
    end_date: typeof raw.end_date === 'string' ? raw.end_date : null,
    status: (raw.status as ChallengeSessionRow['status']) ?? 'active',
    min_start_for_percent: Number(raw.min_start_for_percent) || 3,
    created_by: raw.created_by == null ? null : String(raw.created_by),
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };
}

export function useJugglingChallenge(
  players: PlayerItem[],
  teamSeasonId: string | null,
  enabled = true,
) {
  const [session, setSession] = useState<ChallengeSessionRow | null>(null);
  const [resultsByPlayerId, setResultsByPlayerId] = useState<Map<string, ChallengeResultRow>>(new Map());
  const [loading, setLoading] = useState(false);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activePlayers = useMemo(
    () => players.filter((p) => (p.status ?? 'active') === 'active'),
    [players],
  );

  const load = useCallback(async () => {
    if (!enabled) {
      setSession(null);
      setResultsByPlayerId(new Map());
      setError(null);
      setLoading(false);
      return;
    }

    const sid = (teamSeasonId ?? '').trim();
    if (!sid) {
      setSession(null);
      setResultsByPlayerId(new Map());
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: sessionRows, error: sessionErr } = await supabase
        .from('challenge_sessions')
        .select('*')
        .eq('team_season_id', sid)
        .eq('type', JUGGLING_TYPE)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (sessionErr) throw sessionErr;

      let activeSession = sessionRows?.[0] ? mapSessionRow(sessionRows[0] as Record<string, unknown>) : null;

      if (!activeSession) {
        const { data: authData } = await supabase.auth.getSession();
        const uid = authData.session?.user?.id ?? null;
        const { data: created, error: createErr } = await supabase
          .from('challenge_sessions')
          .insert({
            team_season_id: sid,
            type: JUGGLING_TYPE,
            title: DEFAULT_TITLE,
            status: 'active',
            min_start_for_percent: 3,
            created_by: uid,
          })
          .select('*')
          .single();

        if (createErr) throw createErr;
        activeSession = mapSessionRow(created as Record<string, unknown>);
      }

      setSession(activeSession);

      const { data: resultRows, error: resultsErr } = await supabase
        .from('challenge_results')
        .select('*')
        .eq('challenge_id', activeSession.id);

      if (resultsErr) throw resultsErr;

      const byPlayer = new Map<string, ChallengeResultRow>();
      for (const raw of resultRows ?? []) {
        const row = mapResultRow(raw as Record<string, unknown>);
        byPlayer.set(row.player_id, row);
      }
      setResultsByPlayerId(byPlayer);
    } catch (e) {
      setSession(null);
      setResultsByPlayerId(new Map());
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [teamSeasonId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows: JugglingChallengePlayerRow[] = useMemo(
    () =>
      activePlayers.map((player) => {
        const result = resultsByPlayerId.get(player.id);
        return {
          player,
          resultId: result?.id ?? null,
          startValue: result?.start_value ?? 0,
          endValue: result?.end_value ?? null,
          notes: result?.notes ?? null,
        };
      }),
    [activePlayers, resultsByPlayerId],
  );

  const savePlayerValues = useCallback(
    async (playerId: string, startValue: number, endValue: number | null) => {
      if (!session) return { ok: false as const, error: 'Keine Challenge-Session.' };

      const pid = playerId.trim();
      if (!pid) return { ok: false as const, error: 'Spieler fehlt.' };

      const safeStart = Math.max(0, Math.trunc(startValue));
      const safeEnd = endValue == null ? null : Math.max(0, Math.trunc(endValue));

      setSavingPlayerId(pid);
      setError(null);
      try {
        const { data: authData } = await supabase.auth.getSession();
        const uid = authData.session?.user?.id ?? null;

        const { data, error: upsertErr } = await supabase
          .from('challenge_results')
          .upsert(
            {
              challenge_id: session.id,
              player_id: pid,
              start_value: safeStart,
              end_value: safeEnd,
              recorded_by: uid,
            },
            { onConflict: 'challenge_id,player_id' },
          )
          .select('*')
          .single();

        if (upsertErr) throw upsertErr;

        const saved = mapResultRow(data as Record<string, unknown>);
        setResultsByPlayerId((prev) => {
          const next = new Map(prev);
          next.set(pid, saved);
          return next;
        });
        return { ok: true as const };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        return { ok: false as const, error: message };
      } finally {
        setSavingPlayerId(null);
      }
    },
    [session],
  );

  return {
    session,
    rows,
    loading,
    savingPlayerId,
    error,
    savePlayerValues,
    refetch: load,
  };
}
