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

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!teamSeasonId) {
      setRow(null);
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from('team_notification_settings')
        .select('*')
        .eq('team_season_id', teamSeasonId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (qErr) {
        console.warn('[TeamReminderSettings]', qErr.message ?? qErr);
      }

      if (data) {
        setRow(normalizeRow(data as TeamNotificationSettingsRow));
      } else {
        setRow(normalizeRow({ team_season_id: teamSeasonId, ...DEFAULT_TEAM_NOTIFICATION_SETTINGS }));
      }
    } catch (e) {
      console.warn('[TeamReminderSettings] load', e);
      setRow(normalizeRow({ team_season_id: teamSeasonId, ...DEFAULT_TEAM_NOTIFICATION_SETTINGS }));
    } finally {
      setLoading(false);
    }
  }, [teamSeasonId]);

  useEffect(() => {
    void load();
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
    try {
      console.info('[TeamReminderSettings] save click', {
        team_season_id: teamSeasonId,
        values_before_save: row,
      });
      const fields = {
        training_enabled: row.training_enabled,
        training_minutes_before: row.training_minutes_before,
        match_enabled: row.match_enabled,
        match_minutes_before: row.match_minutes_before,
        match_second_enabled: row.match_second_enabled,
        match_second_minutes_before: row.match_second_minutes_before,
        event_enabled: row.event_enabled,
        event_minutes_before: row.event_minutes_before,
      };
      const payload = {
        team_season_id: teamSeasonId,
        ...fields,
      };
      console.info('[TeamReminderSettings] save payload', payload);
      const { data: upsertData, error: upsertErr } = await supabase
        .from('team_notification_settings')
        .upsert(payload, { onConflict: 'team_season_id' })
        .select('*');

      console.info('[TeamReminderSettings] save result', { data: upsertData, error: upsertErr });
      if (upsertErr) {
        console.warn('[TeamReminderSettings] save', upsertErr);
        return;
      }
      setSaved(true);
      await load({ silent: true });
      console.info('[TeamReminderSettings] values after reload', { row_after_reload: rowRef.current });
    } catch (e) {
      console.warn('[TeamReminderSettings] save', e);
    } finally {
      setSaving(false);
    }
  };

  if (!teamSeasonId) return null;
  if (loading || !row) {
    return (
      <div
        className={
          embedded
            ? 'mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60'
            : 'mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60'
        }
      >
        Erinnerungen laden…
      </div>
    );
  }

  const shell = embedded
    ? 'mt-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-white'
    : 'mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-white';

  return (
    <div className={shell}>
      {!embedded && (
        <>
          <h3 className="text-sm font-semibold text-white/95">Erinnerungen</h3>
          <p className="mt-1 text-xs text-white/55">Globale Regeln für dieses Team (automatische Termin-Erinnerungen).</p>
        </>
      )}

      {saved && <p className="mt-2 text-xs text-emerald-300/90">Gespeichert.</p>}

      <div className="mt-3 space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.training_enabled}
            onChange={(e) => update('training_enabled', e.target.checked)}
            className="rounded border-white/20"
          />
          <span>Training erinnern</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="text-white/60">Vorher</span>
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm"
            value={row.training_minutes_before}
            onChange={(e) => update('training_minutes_before', Number(e.target.value))}
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
            checked={row.match_enabled}
            onChange={(e) => update('match_enabled', e.target.checked)}
            className="rounded border-white/20"
          />
          <span>Spiel erinnern</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="text-white/60">Vorher</span>
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm"
            value={row.match_minutes_before}
            onChange={(e) => update('match_minutes_before', Number(e.target.value))}
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
            checked={row.match_second_enabled}
            onChange={(e) => update('match_second_enabled', e.target.checked)}
            className="rounded border-white/20"
          />
          <span>Zweite Spiel-Erinnerung</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="text-white/60">Vorher</span>
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm"
            value={row.match_second_minutes_before}
            onChange={(e) => update('match_second_minutes_before', Number(e.target.value))}
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
            checked={row.event_enabled}
            onChange={(e) => update('event_enabled', e.target.checked)}
            className="rounded border-white/20"
          />
          <span>Event erinnern</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className="text-white/60">Vorher</span>
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm"
            value={row.event_minutes_before}
            onChange={(e) => update('event_minutes_before', Number(e.target.value))}
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
