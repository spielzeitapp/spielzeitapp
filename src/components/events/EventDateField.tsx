import React from 'react';
import { cn } from '../../ui/lib/cn';
import { EVENT_FORM_INPUT_CLASS } from './eventFormStyles';

type Props = {
  id?: string;
  value: string;
  onChange: (yyyyMmDd: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
};

/**
 * Datum wie „Neuer Termin“: natives `type="date"` (iOS-Kalender), Wert `YYYY-MM-DD`.
 * Anzeige geschlossen lokalisiert (de-AT), ohne Uhrzeit.
 */
export function EventDateField({
  id,
  value,
  onChange,
  className,
  disabled,
  required,
  'aria-label': ariaLabel = 'Datum',
}: Props) {
  return (
    <input
      id={id}
      type="date"
      lang="de-AT"
      required={required}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(EVENT_FORM_INPUT_CLASS, className)}
      aria-label={ariaLabel}
    />
  );
}
