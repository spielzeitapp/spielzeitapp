import React, { useEffect, useId, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../ui/lib/cn';

type Props = {
  id?: string;
  value: string;
  onChange: (hhmm: string) => void;
  className?: string;
  disabled?: boolean;
  /** Nur Anzeige wenn leer — Standard `--:--` */
  placeholder?: string;
  /** Für aria-label, z. B. „Beginn“ / „Treffpunkt“ */
  label?: string;
};

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_5 = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

function parseHHmm(value: string): { hour: string; minute: string } | null {
  const m = HHMM_RE.exec(value.trim());
  if (!m) return null;
  return { hour: m[1], minute: m[2] };
}

function formatHHmm(hour: string, minute: string): string {
  return `${hour}:${minute}`;
}

/** Default-Vorschlag im Picker (nicht speichern, bis Übernehmen). */
function suggestedDraft(): { hour: string; minute: string } {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, '0');
  const snapped = Math.round(now.getMinutes() / 5) * 5;
  const minute = String(snapped === 60 ? 55 : snapped).padStart(2, '0');
  return { hour, minute };
}

function minuteOptionsFor(currentMinute: string): string[] {
  if (MINUTES_5.includes(currentMinute)) return MINUTES_5;
  // Bestehende Nicht-5-Min-Werte weiter anzeigbar/übernehmbar
  return [...MINUTES_5, currentMinute].sort((a, b) => Number(a) - Number(b));
}

const selectClass =
  'min-h-[48px] w-full rounded-xl border border-white/12 bg-white/[0.06] px-3 text-[17px] font-semibold text-white focus:border-red-500/45 focus:outline-none';

/**
 * Einheitlicher 24h-Timepicker (HH:mm).
 * Kein natives AM/PM, kein Pflicht-Tippen — Stunde/Minute per Select + Übernehmen.
 */
export function TimeInput24h({
  id,
  value,
  onChange,
  className,
  disabled,
  placeholder = '--:--',
  label = 'Uhrzeit',
}: Props) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const titleId = `${triggerId}-title`;
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState('00');
  const [draftMinute, setDraftMinute] = useState('00');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hourRef = useRef<HTMLSelectElement>(null);

  const display = parseHHmm(value) ? value : placeholder;
  const hasValue = Boolean(parseHHmm(value));

  const openPicker = () => {
    if (disabled) return;
    const parsed = parseHHmm(value);
    if (parsed) {
      setDraftHour(parsed.hour);
      setDraftMinute(parsed.minute);
    } else {
      const s = suggestedDraft();
      setDraftHour(s.hour);
      setDraftMinute(s.minute);
    }
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const applyPicker = () => {
    onChange(formatHHmm(draftHour, draftMinute));
    closePicker();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
      }
    };
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => hourRef.current?.focus(), 0);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const minuteOpts = minuteOptionsFor(draftMinute);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        disabled={disabled}
        onClick={openPicker}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-left text-[15px] text-white focus:border-red-500/45 focus:outline-none disabled:opacity-50',
          className,
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label} auswählen${hasValue ? `, aktuell ${value}` : ', noch offen'}`}
      >
        <span className={cn('font-semibold tabular-nums', !hasValue && 'text-white/40')}>
          {display}
        </span>
        <Clock className="h-5 w-5 shrink-0 text-white/50" aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePicker();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-t-2xl border border-white/12 bg-[#12151c] p-4 shadow-xl sm:rounded-2xl"
          >
            <h3 id={titleId} className="text-[15px] font-bold text-white">
              {label} wählen
            </h3>
            <p className="mt-1 text-[12px] text-white/45">24-Stunden-Format · HH:mm</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${triggerId}-hour`} className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
                  Stunde
                </label>
                <select
                  ref={hourRef}
                  id={`${triggerId}-hour`}
                  className={selectClass}
                  value={draftHour}
                  onChange={(e) => setDraftHour(e.target.value)}
                  aria-label="Stunde"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${triggerId}-minute`} className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
                  Minute
                </label>
                <select
                  id={`${triggerId}-minute`}
                  className={selectClass}
                  value={draftMinute}
                  onChange={(e) => setDraftMinute(e.target.value)}
                  aria-label="Minute"
                >
                  {minuteOpts.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-3 text-center text-[22px] font-bold tabular-nums tracking-wide text-white">
              {formatHHmm(draftHour, draftMinute)}
            </p>

            <div className="mt-4 flex gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-3 text-[15px] font-semibold text-white/90 active:bg-white/[0.1]"
                onClick={closePicker}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-red-500/40 bg-red-600 px-3 text-[15px] font-semibold text-white active:bg-red-500"
                onClick={applyPicker}
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
