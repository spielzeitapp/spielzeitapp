import React, { useCallback, useEffect, useState } from 'react';
import { updateMatchRow } from '../../lib/liveMatchService';
import {
  DEFAULT_MINIMUM_PLAYTIME_MINUTES,
  normalizeMinimumPlaytimeMinutes,
} from '../../lib/minimumPlaytime';

type Props = {
  matchId: string;
  enabled: boolean;
  minutes: number;
  onSaved?: (patch: { enabled: boolean; minutes: number }) => void;
  className?: string;
};

const MINUTE_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 60] as const;

/**
 * Toggle + Minuten für Mindestspielzeit (pro Spiel, optional).
 */
export function MinimumPlaytimeMatchSettings({
  matchId,
  enabled: enabledProp,
  minutes: minutesProp,
  onSaved,
  className = '',
}: Props) {
  const [enabled, setEnabled] = useState(enabledProp);
  const [minutes, setMinutes] = useState(() => normalizeMinimumPlaytimeMinutes(minutesProp));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(enabledProp);
    setMinutes(normalizeMinimumPlaytimeMinutes(minutesProp));
  }, [enabledProp, minutesProp, matchId]);

  const persist = useCallback(
    async (nextEnabled: boolean, nextMinutes: number) => {
      const mid = matchId?.trim();
      if (!mid) return;
      setSaving(true);
      setError(null);
      const normMinutes = normalizeMinimumPlaytimeMinutes(nextMinutes);
      const { error: updErr } = await updateMatchRow(mid, {
        minimum_playtime_enabled: nextEnabled,
        minimum_playtime_minutes: normMinutes,
      });
      setSaving(false);
      if (updErr) {
        setError(updErr);
        return;
      }
      setEnabled(nextEnabled);
      setMinutes(normMinutes);
      onSaved?.({ enabled: nextEnabled, minutes: normMinutes });
      setSavedHint('Gespeichert');
      window.setTimeout(() => setSavedHint(null), 2000);
    },
    [matchId, onSaved],
  );

  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 ${className}`.trim()}
    >
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => {
            const next = e.target.checked;
            void persist(next, minutes);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border border-white/25 bg-black/40"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-white/92">Mindestspielzeit beachten</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-white/55">
            Unterstützt den Trainer, blockiert aber keine Aktion.
          </span>
        </span>
      </label>
      {enabled ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-6">
          <label className="text-[12px] font-medium text-white/65" htmlFor={`min-play-${matchId}`}>
            Mindestspielzeit:
          </label>
          <select
            id={`min-play-${matchId}`}
            value={minutes}
            disabled={saving}
            onChange={(e) => {
              const next = normalizeMinimumPlaytimeMinutes(Number(e.target.value));
              setMinutes(next);
              void persist(true, next);
            }}
            className="min-h-[40px] rounded-lg border border-white/15 bg-zinc-950/90 px-2.5 py-1.5 text-[14px] font-semibold text-white"
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} Minuten
              </option>
            ))}
            {!MINUTE_OPTIONS.includes(minutes as (typeof MINUTE_OPTIONS)[number]) ? (
              <option value={minutes}>{minutes} Minuten</option>
            ) : null}
          </select>
        </div>
      ) : (
        <p className="mt-2 pl-6 text-[11px] text-white/40">
          Standard bei Aktivierung: {DEFAULT_MINIMUM_PLAYTIME_MINUTES} Minuten
        </p>
      )}
      {error ? <p className="mt-2 text-[12px] text-red-300/95">{error}</p> : null}
      {savedHint ? <p className="mt-1 text-[11px] text-emerald-300/90">{savedHint}</p> : null}
    </div>
  );
}
