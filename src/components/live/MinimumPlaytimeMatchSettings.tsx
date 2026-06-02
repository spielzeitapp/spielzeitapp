import React, { useCallback, useEffect, useId, useState } from 'react';
import { updateMatchRow } from '../../lib/liveMatchService';
import {
  DEFAULT_MINIMUM_PLAYTIME_MINUTES,
  DEFAULT_PLANNED_MATCH_MINUTES,
  MINIMUM_PLAYTIME_MINUTE_PRESETS,
  minimumPlaytimeExceedsPlanned,
  normalizeMinimumPlaytimeMinutes,
  normalizePlannedMatchMinutes,
  PLANNED_MATCH_MINUTE_PRESETS,
} from '../../lib/minimumPlaytime';

export type MatchTimeSettingsPatch = {
  plannedMinutes: number;
  enabled: boolean;
  minutes: number;
};

type Props = {
  matchId: string;
  plannedMinutes: number;
  enabled: boolean;
  minutes: number;
  onSaved?: (patch: MatchTimeSettingsPatch) => void;
  className?: string;
};

function minuteSelectOptions(
  presets: readonly number[],
  current: number,
): number[] {
  const set = new Set<number>(presets);
  set.add(current);
  return [...set].sort((a, b) => a - b);
}

/**
 * Geplante Spieldauer + Mindestspielzeit (pro Spiel, optional).
 */
export function MinimumPlaytimeMatchSettings({
  matchId,
  plannedMinutes: plannedProp,
  enabled: enabledProp,
  minutes: minutesProp,
  onSaved,
  className = '',
}: Props) {
  const uid = useId();
  const [plannedMinutes, setPlannedMinutes] = useState(() =>
    normalizePlannedMatchMinutes(plannedProp),
  );
  const [enabled, setEnabled] = useState(enabledProp);
  const [minutes, setMinutes] = useState(() =>
    normalizeMinimumPlaytimeMinutes(minutesProp, plannedProp),
  );
  const [customPlanned, setCustomPlanned] = useState('');
  const [customMinimum, setCustomMinimum] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const exceedsPlanned = minimumPlaytimeExceedsPlanned(minutes, plannedMinutes);

  useEffect(() => {
    const planned = normalizePlannedMatchMinutes(plannedProp);
    setPlannedMinutes(planned);
    setEnabled(enabledProp);
    setMinutes(normalizeMinimumPlaytimeMinutes(minutesProp, planned));
    setCustomPlanned('');
    setCustomMinimum('');
    setValidationError(null);
  }, [plannedProp, enabledProp, minutesProp, matchId]);

  const persist = useCallback(
    async (nextPlanned: number, nextEnabled: boolean, nextMinutes: number) => {
      const mid = matchId?.trim();
      if (!mid) return;

      const normPlanned = normalizePlannedMatchMinutes(nextPlanned);
      if (minimumPlaytimeExceedsPlanned(nextMinutes, normPlanned)) {
        setValidationError('Mindestspielzeit ist höher als die geplante Spieldauer.');
        return;
      }
      const normMinutes = normalizeMinimumPlaytimeMinutes(nextMinutes, normPlanned);

      setSaving(true);
      setError(null);
      setValidationError(null);
      const { error: updErr } = await updateMatchRow(mid, {
        planned_match_minutes: normPlanned,
        minimum_playtime_enabled: nextEnabled,
        minimum_playtime_minutes: normMinutes,
      });
      setSaving(false);
      if (updErr) {
        setError(updErr);
        return;
      }
      setPlannedMinutes(normPlanned);
      setEnabled(nextEnabled);
      setMinutes(normMinutes);
      onSaved?.({ plannedMinutes: normPlanned, enabled: nextEnabled, minutes: normMinutes });
      setSavedHint('Gespeichert');
      window.setTimeout(() => setSavedHint(null), 2000);
    },
    [matchId, onSaved],
  );

  const plannedOptions = minuteSelectOptions(PLANNED_MATCH_MINUTE_PRESETS, plannedMinutes);
  const minimumOptions = minuteSelectOptions(MINIMUM_PLAYTIME_MINUTE_PRESETS, minutes);

  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 ${className}`.trim()}
    >
      <h3 className="text-[14px] font-bold text-white/92">Spielzeit</h3>
      <p className="mt-0.5 text-[12px] leading-snug text-white/55">
        Die Spieldauer steuert Timer-Hinweise und Mindestspielzeit-Warnungen.
      </p>

      <div className="mt-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] font-medium text-white/65" htmlFor={`planned-${uid}`}>
            Geplante Spieldauer:
          </label>
          <select
            id={`planned-${uid}`}
            value={plannedMinutes}
            disabled={saving}
            onChange={(e) => {
              const next = normalizePlannedMatchMinutes(Number(e.target.value));
              setPlannedMinutes(next);
              const clampedMin = normalizeMinimumPlaytimeMinutes(minutes, next);
              setMinutes(clampedMin);
              void persist(next, enabled, clampedMin);
            }}
            className="min-h-[40px] rounded-lg border border-white/15 bg-zinc-950/90 px-2.5 py-1.5 text-[14px] font-semibold text-white"
          >
            {plannedOptions.map((m) => (
              <option key={m} value={m}>
                {m} Minuten
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-0">
          <label className="text-[11px] text-white/50" htmlFor={`planned-custom-${uid}`}>
            Eigene Minuten:
          </label>
          <input
            id={`planned-custom-${uid}`}
            type="number"
            min={15}
            max={120}
            inputMode="numeric"
            placeholder="z. B. 45"
            value={customPlanned}
            disabled={saving}
            onChange={(e) => setCustomPlanned(e.target.value)}
            onBlur={() => {
              const raw = customPlanned.trim();
              if (!raw) return;
              const next = normalizePlannedMatchMinutes(Number(raw));
              setCustomPlanned('');
              setPlannedMinutes(next);
              const clampedMin = normalizeMinimumPlaytimeMinutes(minutes, next);
              setMinutes(clampedMin);
              void persist(next, enabled, clampedMin);
            }}
            className="w-20 min-h-[36px] rounded-lg border border-white/15 bg-zinc-950/90 px-2 py-1 text-[13px] font-semibold text-white"
          />
        </div>
      </div>

      <div className="mt-3 border-t border-white/10 pt-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(e) => {
              const next = e.target.checked;
              void persist(plannedMinutes, next, minutes);
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
          <div className="mt-2.5 space-y-2 pl-6">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[12px] font-medium text-white/65" htmlFor={`min-play-${uid}`}>
                Mindestspielzeit:
              </label>
              <select
                id={`min-play-${uid}`}
                value={minutes}
                disabled={saving}
                onChange={(e) => {
                  const next = normalizeMinimumPlaytimeMinutes(Number(e.target.value), plannedMinutes);
                  setMinutes(next);
                  void persist(plannedMinutes, true, next);
                }}
                className="min-h-[40px] rounded-lg border border-white/15 bg-zinc-950/90 px-2.5 py-1.5 text-[14px] font-semibold text-white"
              >
                {minimumOptions.map((m) => (
                  <option key={m} value={m} disabled={m > plannedMinutes}>
                    {m} Minuten{m > plannedMinutes ? ' (zu hoch)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-white/50" htmlFor={`min-custom-${uid}`}>
                Eigene Minuten:
              </label>
              <input
                id={`min-custom-${uid}`}
                type="number"
                min={1}
                max={plannedMinutes}
                inputMode="numeric"
                placeholder="z. B. 22"
                value={customMinimum}
                disabled={saving}
                onChange={(e) => setCustomMinimum(e.target.value)}
                onBlur={() => {
                  const raw = customMinimum.trim();
                  if (!raw) return;
                  const next = normalizeMinimumPlaytimeMinutes(Number(raw), plannedMinutes);
                  setCustomMinimum('');
                  setMinutes(next);
                  void persist(plannedMinutes, true, next);
                }}
                className="w-20 min-h-[36px] rounded-lg border border-white/15 bg-zinc-950/90 px-2 py-1 text-[13px] font-semibold text-white"
              />
            </div>
          </div>
        ) : (
          <p className="mt-2 pl-6 text-[11px] text-white/40">
            Standard bei Aktivierung: {DEFAULT_MINIMUM_PLAYTIME_MINUTES} Minuten (max. Spieldauer)
          </p>
        )}
      </div>

      {exceedsPlanned ? (
        <p className="mt-2 text-[12px] font-medium text-amber-300/95">
          Mindestspielzeit ist höher als die geplante Spieldauer.
        </p>
      ) : null}
      {validationError ? <p className="mt-2 text-[12px] text-amber-300/95">{validationError}</p> : null}
      {error ? <p className="mt-2 text-[12px] text-red-300/95">{error}</p> : null}
      {savedHint ? <p className="mt-1 text-[11px] text-emerald-300/90">{savedHint}</p> : null}
    </div>
  );
}
