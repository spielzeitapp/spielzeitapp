import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  DEFAULT_TEAM_NOTIFICATION_SETTINGS,
  type TeamNotificationSettingsRow,
} from '../lib/notifications/teamSettings';

const TRAINING_MIN = [60, 120, 180, 360] as const;
const MATCH_MIN = [360, 720, 1440] as const;
const MATCH2_MIN = [60, 120, 180] as const;
const EVENT_MIN = [720, 1440] as const;

type Props = { teamSeasonId: string | null };

export const TeamReminderSettingsPanel: React.FC<Props> = ({ teamSeasonId }) => {
  const [row, setRow] = useState<TeamNotificationSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!teamSeasonId) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('team_notification_settings')
        .select('*')
        .eq('team_season_id', teamSeasonId)
        .maybeSingle();
      if (qErr) {
        setError('Einstellungen konnten nicht geladen werden.');
        setRow({ team_season_id: teamSeasonId, ...DEFAULT_TEAM_NOTIFICATION_SETTINGS });
        return;
      }
      if (data) {
        setRow(data as TeamNotificationSettingsRow);
      } else {
        setRow({ team_season_id: teamSeasonId, ...DEFAULT_TEAM_NOTIFICATION_SETTINGS });
      }
    } catch {
      setError('Einstellungen konnten nicht geladen werden.');
      setRow({ team_season_id: teamSeasonId, ...DEFAULT_TEAM_NOTIFICATION_SETTINGS });
    } finally {
      setLoading(false);
    }
  }, [teamSeasonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof TeamNotificationSettingsRow>(key: K, value: TeamNotificationSettingsRow[K]) => {
    setRow((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const save = async () => {
    if (!teamSeasonId || !row) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = {
        team_season_id: teamSeasonId,
        training_reminder_enabled: row.training_reminder_enabled,
        training_reminder_minutes_before: row.training_reminder_minutes_before,
        match_reminder_enabled: row.match_reminder_enabled,
        match_reminder_minutes_before: row.match_reminder_minutes_before,
        match_second_reminder_enabled: row.match_second_reminder_enabled,
        match_second_reminder_minutes_before: row.match_second_reminder_minutes_before,
        event_reminder_enabled: row.event_reminder_enabled,
        event_reminder_minutes_before: row.event_reminder_minutes_before,
      };
      const { error: uErr } = await supabase.from('team_notification_settings').upsert(payload, {
        onConflict: 'team_season_id',
      });
      if (uErr) {
        setError('Speichern fehlgeschlagen.');
        return;
      }
      setSaved(true);
    } catch {
      setError('Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  if (!teamSeasonId) return null;
  if (loading || !row) {
    return (
      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/60">Erinnerungen laden…</div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-white">
      <h3 className="text-sm font-semibold text-white/95">Erinnerungen</h3>
      <p className="mt-1 text-xs text-white/55">Globale Regeln für dieses Team (automatische Termin-Erinnerungen).</p>

      {error && <p className="mt-2 text-xs text-amber-200/90">{error}</p>}
      {saved && <p className="mt-2 text-xs text-emerald-300/90">Gespeichert.</p>}

      <div className="mt-3 space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.training_reminder_enabled}
            onChange={(e) => update('training_reminder_enabled', e.target.checked)}
            className="rounded border-white/20"
          />
          <span>Training erinnern</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="text-white/60">Vorher</span>
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm"
            value={row.training_reminder_minutes_before}
            onChange={(e) => update('training_reminder_minutes_before', Number(e.target.value))}
          >
            {TRAINING_MIN.map((m) => (
              <option key={m} value={m}>
                {m} Min
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.match_reminder_enabled}
            onChange={(e) => update('match_reminder_enabled', e.target.checked)}
            className="rounded border-white/20"
          />
          <span>Spiel erinnern</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="text-white/60">Vorher</span>
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm"
            value={row.match_reminder_minutes_before}
            onChange={(e) => update('match_reminder_minutes_before', Number(e.target.value))}
          >
            {MATCH_MIN.map((m) => (
              <option key={m} value={m}>
                {m >= 60 ? `${m / 60} h` : `${m} Min`}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.match_second_reminder_enabled}
            onChange={(e) => update('match_second_reminder_enabled', e.target.checked)}
            className="rounded border-white/20"
          />
          <span>Zweite Spiel-Erinnerung</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="text-white/60">Vorher</span>
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm"
            value={row.match_second_reminder_minutes_before}
            onChange={(e) => update('match_second_reminder_minutes_before', Number(e.target.value))}
          >
            {MATCH2_MIN.map((m) => (
              <option key={m} value={m}>
                {m} Min
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.event_reminder_enabled}
            onChange={(e) => update('event_reminder_enabled', e.target.checked)}
            className="rounded border-white/20"
          />
          <span>Event erinnern</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="text-white/60">Vorher</span>
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm"
            value={row.event_reminder_minutes_before}
            onChange={(e) => update('event_reminder_minutes_before', Number(e.target.value))}
          >
            {EVENT_MIN.map((m) => (
              <option key={m} value={m}>
                {m / 60} h
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-4 w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
      >
        {saving ? 'Speichern…' : 'Speichern'}
      </button>
    </div>
  );
};
