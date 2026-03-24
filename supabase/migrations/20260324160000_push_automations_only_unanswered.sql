-- Option: nur Empfänger mit offener Zu-/Absage (wie Team-Reminder-Logik)

ALTER TABLE public.push_automations
  ADD COLUMN IF NOT EXISTS only_unanswered boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.push_automations.only_unanswered IS 'true: nur Nutzer, deren Spieler noch nicht alle mit ja/nein beantwortet haben';

SELECT pg_notify('pgrst', 'reload schema');
