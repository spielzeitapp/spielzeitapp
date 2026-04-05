import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  buildTeamNotificationSettingsPayload,
  DEFAULT_TEAM_NOTIFICATION_SETTINGS,
  mapTeamNotificationSettingsFromDb,
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
    // Nur Minuten auf erlaubte Werte runden; Checkboxen bleiben unverändert.
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
  const [saveError, setSaveError] = useState<string | null>(null);

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
      setRow(normalizeRow(mapTeamNotificationSettingsFromDb(data as Record<string, unknown>, teamSeasonId)));
    } else {
      setRow(normalizeRow({ team_season_id: teamSeasonId, ...DEFAULT_TEAM_NOTIFICATION_SETTINGS }));
    }

    setLoading(false);
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
    setSaveError(null);
  };

  const save = async () => {
    const snapshot = rowRef.current ?? row;
    if (!teamSeasonId || !snapshot) return;

    setSaving(true);
    setSaved(false);
    setSaveError(null);

    const payload = buildTeamNotificationSettingsPayload(snapshot);

    try {
      const { error: upsertError } = await supabase.from('team_notification_settings').upsert(
        {
          team_season_id: teamSeasonId,
          ...payload,
        },
        { onConflict: 'team_season_id' },
      );

      if (upsertError) {
        const msg = upsertError.message || String(upsertError);
        console.error('UPSERT ERROR', upsertError);
        setSaveError(`Speichern fehlgeschlagen: ${msg}`);
        return;
      }

      const { data: fresh, error: freshError } = await supabase
        .from('team_notification_settings')
        .select('*')
        .eq('team_season_id', teamSeasonId)
        .maybeSingle();

      if (freshError) {
        const msg = freshError.message || String(freshError);
        console.error('RELOAD ERROR', freshError);
        setSaveError(`Gespeichert, aber Neuladen fehlgeschlagen: ${msg}`);
        return;
      }

      if (fresh) {
        const normalized = normalizeRow(
          mapTeamNotificationSettingsFromDb(fresh as Record<string, unknown>, teamSeasonId),
        );
        setRow(normalized);
        rowRef.current = normalized;
        setSaved(true);
      } else {
        setSaveError('Nach dem Speichern wurde keine Zeile zurückgeliefert (Berechtigung oder Filter prüfen).');
      }
    } catch (e) {
      console.error('SAVE CATCH ERROR', e);
      setSaveError(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
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

      {saveError && (
        <p className="mt-2 text-xs text-red-300/95" role="alert">
          {saveError}
        </p>
      )}
      {saved && !saveError && <p className="mt-2 text-xs text-emerald-300/90">Gespeichert.</p>}

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
                {m >= 60 ? `${m / 60} h` : `${m} Min`}
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