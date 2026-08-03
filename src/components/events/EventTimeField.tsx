import React from 'react';
import { cn } from '../../ui/lib/cn';
import { EVENT_FORM_INPUT_CLASS } from './eventFormStyles';

type Props = {
  id?: string;
  value: string;
  onChange: (hhmm: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  /** z. B. „Beginn“ / „Treffpunkt“ — aria-label */
  label?: string;
};

/**
 * Uhrzeit wie „Neuer Termin“ / Meisterschaft: natives `type="time"` (iOS-Wheel).
 * Wert intern immer `HH:mm`. Kein eigener Picker-Dialog.
 */
export function EventTimeField({
  id,
  value,
  onChange,
  className,
  disabled,
  required,
  label = 'Uhrzeit',
}: Props) {
  return (
    <input
      id={id}
      type="time"
      lang="de-AT"
      step={60}
      required={required}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(EVENT_FORM_INPUT_CLASS, className)}
      aria-label={label}
    />
  );
}
