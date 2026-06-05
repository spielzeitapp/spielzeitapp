import React, { useCallback, useEffect, useId, useState } from 'react';
import { updateMatchRow } from '../../lib/liveMatchService';
import { dsSectionLabelClass } from '../../lib/premiumDesignSystem';

type Props = {
  matchId: string;
  enabled: boolean;
  onSaved?: (enabled: boolean) => void;
  className?: string;
};

/** Pro Spiel: automatischen Matchday-Feed-Post ein-/ausschalten. */
export function MatchdayFeedAutomationSettings({
  matchId,
  enabled: enabledProp,
  onSaved,
  className = '',
}: Props) {
  const uid = useId();
  const [enabled, setEnabled] = useState(enabledProp);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(enabledProp);
    setError(null);
  }, [enabledProp, matchId]);

  const persist = useCallback(
    async (nextEnabled: boolean) => {
      const mid = matchId?.trim();
      if (!mid) return;

      setSaving(true);
      setError(null);
      const { error: saveErr } = await updateMatchRow(mid, {
        auto_matchday_feed_enabled: nextEnabled,
      });
      setSaving(false);

      if (saveErr) {
        setEnabled(enabledProp);
        setError(saveErr);
        return;
      }

      setEnabled(nextEnabled);
      onSaved?.(nextEnabled);
    },
    [matchId, enabledProp, onSaved],
  );

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-[rgba(12,12,16,0.92)] px-4 py-4 ${className}`}
    >
      <h2 className={dsSectionLabelClass()}>Feed Automatisierung</h2>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5" htmlFor={`matchday-feed-auto-${uid}`}>
        <input
          id={`matchday-feed-auto-${uid}`}
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={saving}
          onChange={(e) => {
            void persist(e.target.checked);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border border-white/25 bg-black/40"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-white/92">
            Automatischen Matchday-Post erstellen
          </span>
          <span className="mt-1 block text-[12px] leading-snug text-white/55">
            Wenn deaktiviert, wird kein automatischer Matchday-Post im Feed erstellt und die
            Spieltag-Hero-Karte auf Home ausgeblendet. Aufstellung, Live-Updates und Ergebnis
            bleiben aktiv.
          </span>
        </span>
      </label>
      {error ? <p className="mt-2 text-[12px] text-red-400">{error}</p> : null}
    </section>
  );
}
