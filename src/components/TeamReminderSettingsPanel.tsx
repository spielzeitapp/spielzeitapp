import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  DEFAULT_TEAM_NOTIFICATION_SETTINGS,
  type TeamNotificationSettingsRow,
} from '../lib/notifications/teamSettings';

const TRAINING_MIN = [60, 120, 180, 360] as const;
const MATCH_MIN = [180, 360, 720, 1440] as const;
const MATCH2_MIN = [60, 120, 180] as const;
const EVENT_MIN = [180, 720, 1440] as const;

function nearest(allowed: readonly number[], v: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if ((allowed as readonly number[]).includes(n)) return n;
  return allowed.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), allowed[0] ?? fallback);
}

function normalizeRow(raw: TeamNotificationSettingsRow): TeamNotificationSettingsRow {
  return {
    ...raw,
    training_minutes_before: nearest(TRAINING_MIN, raw.training_minutes_before, 120),
    match_minutes_before: nearest(MATCH_MIN, raw.match_minutes_before, 1440),
    match_second_minutes_before: nearest(MATCH2_MIN, raw.match_second_minutes_before, 120),
    event_minutes_before: nearest(EVENT_MIN, raw.event_minutes_before, 1440),
  };
}

type Props = { teamSeasonId: string | null; embedded?: boolean };

export const TeamReminderSettingsPanel: React.FC<Props> = ({ teamSeasonId, embedded }) => {
  const [row, setRow] = useState<TeamNotificationSettingsRow | null>(null);
  const rowRef = useRef<TeamNotificationSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!teamSeasonId) {
      setRow(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('team_notification_settings')
      .select('*')
      .eq('team_season_id', teamSeasonId)
      .maybeSingle();

    if (error) {
      console.error('LOAD ERROR', error);
    }

    if (data) {
      setRow(normalizeRow(data));
    } else {
      setRow(normalizeRow({ team_season_id: teamSeasonId, ...DEFAULT_TEAM_NOTIFICATION_SETTINGS }));
    }

    setLoading(false);
  }, [teamSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    rowRef.current = row;
  }, [row]);

  const update = <K extends keyof TeamNotificationSettingsRow>(key: K, value: TeamNotificationSettingsRow[K]) => {
    setRow((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const save = async () => {
    if (!teamSeasonId || !row) return;

    setSaving(true);
    setSaved(false);

    const payload = {
      team_season_id: teamSeasonId,
      training_enabled: row.training_enabled,
      training_minutes_before: row.training_minutes_before,
      match_enabled: row.match_enabled,
      match_minutes_before: row.match_minutes_before,
      match_second_enabled: row.match_second_enabled,
      match_second_minutes_before: row.match_second_minutes_before,
      event_enabled: row.event_enabled,
      event_minutes_before: row.event_minutes_before,
    };

    console.log('SAVE PAYLOAD', payload);

    const { data, error } = await supabase
      .from('team_notification_settings')
      .upsert(payload, { onConflict: 'team_season_id' })
      .select()
      .single();

    if (error) {
      console.error('SAVE ERROR', error);
      setSaving(false);
      return;
    }

    setRow(normalizeRow(data));
    rowRef.current = normalizeRow(data);
    setSaved(true);
    setSaving(false);
  };

  if (!teamSeasonId) return null;

  if (loading || !row) {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
        Erinnerungen laden…
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
      <h3 className="text-sm font-semibold">Erinnerungen</h3>

      {saved && <p className="mt-2 text-xs text-green-400">Gespeichert</p>}

      <div className="mt-3 space-y-3 text-sm">

        {/* TRAINING */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.training_enabled}
            onChange={(e) => update('training_enabled', e.target.checked)}
          />
          Training erinnern
        </label>

        <select
          value={row.training_minutes_before}
          onChange={(e) => update('training_minutes_before', Number(e.target.value))}
        >
          {TRAINING_MIN.map((m) => (
            <option key={m} value={m}>{m} Min</option>
          ))}
        </select>

        {/* MATCH */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.match_enabled}
            onChange={(e) => update('match_enabled', e.target.checked)}
          />
          Spiel erinnern
        </label>

        <select
          value={row.match_minutes_before}
          onChange={(e) => update('match_minutes_before', Number(e.target.value))}
        >
          {MATCH_MIN.map((m) => (
            <option key={m} value={m}>
              {m >= 60 ? `${m / 60} h` : `${m} Min`}
            </option>
          ))}
        </select>

        {/* SAVE BUTTON */}
        <button
          onClick={save}
          disabled={saving}
          className="mt-3 w-full bg-red-600 rounded-lg py-2"
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </button>

      </div>
    </div>
  );
};