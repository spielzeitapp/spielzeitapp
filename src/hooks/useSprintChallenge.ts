import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { assertTeamSeasonWritable } from '../lib/seasonTransition';
import type { SprintAttempts } from '../lib/sprintChallenge';
export type SprintMeasurementMethod = 'hand' | 'light_gate';
export type SprintTest = { id: string; start_date: string | null; event_id: string | null; title: string; measurement_method: SprintMeasurementMethod | null };
export function useSprintChallenge(teamSeasonId: string | null, enabled: boolean, eventId: string | null) {
  const [tests, setTests] = useState<SprintTest[]>([]);
  const [testId, setTestId] = useState('');
  const [results, setResults] = useState<Record<string, SprintAttempts>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const version = ++generation.current;
    setTests([]); setTestId(''); setResults({}); setError(null); setSaving(false);
    if (!enabled || !teamSeasonId) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      const response = await supabase.from('challenge_sessions').select('id,start_date,event_id,title,measurement_method').eq('team_season_id', teamSeasonId).eq('type', 'sprint_16_5').order('start_date', { ascending: false }).order('created_at', { ascending: false });
      if (version !== generation.current) return;
      if (response.error) setError(response.error.message);
      else { const list = (response.data ?? []) as SprintTest[]; setTests(list); setTestId((eventId ? list.find(test => test.event_id === eventId) : list[0])?.id ?? ''); }
      setLoading(false);
    })();
    return () => { generation.current++; };
  }, [teamSeasonId, enabled, eventId]);
  useEffect(() => {
    let current = true;
    setResults({}); setError(null);
    if (!testId || !enabled) return;
    setLoading(true);
    void (async () => {
      const response = await supabase.from('sprint_challenge_results').select('player_id,attempt_1_ms,attempt_2_ms,attempt_3_ms').eq('challenge_id', testId);
      if (!current) return;
      if (response.error) setError(response.error.message);
      else setResults(Object.fromEntries((response.data ?? []).map(row => [row.player_id, [row.attempt_1_ms, row.attempt_2_ms, row.attempt_3_ms] as SprintAttempts])));
      setLoading(false);
    })();
    return () => { current = false; };
  }, [testId, enabled]);
  const createTest = useCallback(async (date: string, method: SprintMeasurementMethod) => {
    if (!teamSeasonId || !enabled || saving) return false;
    const version = generation.current;
    setSaving(true); setError(null);
    try {
      const writable = await assertTeamSeasonWritable(teamSeasonId);
      if (!writable.ok) throw new Error(writable.message);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Bitte erneut anmelden.');
      if (eventId) {
        const { data: event, error: eventError } = await supabase.from('events').select('id,team_season_id,kind').eq('id', eventId).single();
        if (eventError || event?.team_season_id !== teamSeasonId || event.kind !== 'training') throw new Error('Das Training gehört nicht zur gewählten Mannschaft.');
      }
      const response = await supabase.from('challenge_sessions').insert({ team_season_id: teamSeasonId, type: 'sprint_16_5', title: 'Sprint-Challenge · 16,5 m', start_date: date, measurement_method: method, event_id: eventId, status: 'active', created_by: auth.user.id }).select('id,start_date,event_id,title,measurement_method').single();
      if (response.error) throw response.error;
      if (generation.current !== version) return false;
      setTests(previous => [response.data as SprintTest, ...previous]); setTestId(response.data.id); return true;
    } catch (e) { if (generation.current === version) setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { if (generation.current === version) setSaving(false); }
  }, [teamSeasonId, enabled, eventId, saving]);
  const save = useCallback(async (playerId: string, attempts: SprintAttempts) => {
    if (!teamSeasonId || !testId || !enabled || saving) return false;
    const version = generation.current;
    setSaving(true); setError(null);
    try {
      const writable = await assertTeamSeasonWritable(teamSeasonId);
      if (!writable.ok) throw new Error(writable.message);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Bitte erneut anmelden.');
      const response = await supabase.from('sprint_challenge_results').upsert({ challenge_id: testId, player_id: playerId, attempt_1_ms: attempts[0], attempt_2_ms: attempts[1], attempt_3_ms: attempts[2], recorded_by: auth.user.id }, { onConflict: 'challenge_id,player_id' }).select('player_id,attempt_1_ms,attempt_2_ms,attempt_3_ms').single();
      if (response.error) throw response.error;
      if (generation.current !== version) return false;
      setResults(previous => ({ ...previous, [playerId]: [response.data.attempt_1_ms, response.data.attempt_2_ms, response.data.attempt_3_ms] })); return true;
    } catch (e) { if (generation.current === version) setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { if (generation.current === version) setSaving(false); }
  }, [teamSeasonId, testId, enabled, saving]);
  const setMeasurementMethod = useCallback(async (method: SprintMeasurementMethod) => {
    if (!teamSeasonId || !testId || !enabled || saving) return false;
    const version = generation.current;
    setSaving(true); setError(null);
    try {
      const writable = await assertTeamSeasonWritable(teamSeasonId);
      if (!writable.ok) throw new Error(writable.message);
      const response = await supabase.from('challenge_sessions').update({ measurement_method: method })
        .eq('id', testId).eq('team_season_id', teamSeasonId).eq('type', 'sprint_16_5').is('measurement_method', null)
        .select('id,start_date,event_id,title,measurement_method').single();
      if (response.error) throw response.error;
      if (version !== generation.current) return false;
      setTests(previous => previous.map(test => test.id === testId ? response.data as SprintTest : test));
      return true;
    } catch (e) { if (version === generation.current) setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { if (version === generation.current) setSaving(false); }
  }, [teamSeasonId, testId, enabled, saving]);
  return { tests, testId, setTestId, results, loading, saving, error, createTest, setMeasurementMethod, save };
}
