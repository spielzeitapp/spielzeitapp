import React, { useMemo } from 'react';

type Props = {
  id?: string;
  value: string;
  onChange: (hhmm: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
};

/** Browser/OS mit 12h-Darstellung (AM/PM) für native time-inputs. */
function localeUses12HourClock(): boolean {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).formatToParts(
      new Date(2020, 0, 1, 15, 0),
    );
    return parts.some((p) => p.type === 'dayPeriod');
  } catch {
    return false;
  }
}

/** Tippen: Ziffern → `HH:mm` (max. 4 Ziffern). */
function draftFromRaw(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * Zeitfeld immer in 24h (`HH:mm`).
 * - Locale ohne AM/PM → natives `type="time"` (iPhone/DE-Desktop)
 * - Locale mit AM/PM (z. B. en-US Windows) → Textfeld, damit kein 05:00 PM
 */
export function TimeInput24h({
  id,
  value,
  onChange,
  className,
  disabled,
  placeholder = '--:--',
}: Props) {
  const useText = useMemo(() => localeUses12HourClock(), []);

  if (!useText) {
    return (
      <input
        id={id}
        type="time"
        lang="de-AT"
        step={60}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    );
  }

  return (
    <input
      id={id}
      type="text"
      lang="de-AT"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      className={className}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(draftFromRaw(e.target.value))}
      onBlur={() => {
        if (!value) return;
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
          onChange('');
        }
      }}
      aria-label="Uhrzeit 24 Stunden"
    />
  );
}
