-- Kurz-Spalten (match_enabled, match_second_enabled, …) als Aliase zu *_reminder_*.
-- Viele UIs/Exports zeigen nur die Kurznamen; nur *_reminder_* zu schreiben ließ z. B. match_second_enabled auf false,
-- während match_second_reminder_enabled korrekt war — oder umgekehrt je nach Schema.
-- Trigger hält beide Namensräume bei jedem INSERT/UPDATE identisch (Quelle: *_reminder_*).

ALTER TABLE public.team_notification_settings
  ADD COLUMN IF NOT EXISTS training_enabled boolean,
  ADD COLUMN IF NOT EXISTS training_minutes_before integer,
  ADD COLUMN IF NOT EXISTS match_enabled boolean,
  ADD COLUMN IF NOT EXISTS match_minutes_before integer,
  ADD COLUMN IF NOT EXISTS match_second_enabled boolean,
  ADD COLUMN IF NOT EXISTS match_second_minutes_before integer,
  ADD COLUMN IF NOT EXISTS event_enabled boolean,
  ADD COLUMN IF NOT EXISTS event_minutes_before integer;

UPDATE public.team_notification_settings SET
  training_enabled = training_reminder_enabled,
  training_minutes_before = training_reminder_minutes_before,
  match_enabled = match_reminder_enabled,
  match_minutes_before = match_reminder_minutes_before,
  match_second_enabled = match_second_reminder_enabled,
  match_second_minutes_before = match_second_reminder_minutes_before,
  event_enabled = event_reminder_enabled,
  event_minutes_before = event_reminder_minutes_before;

ALTER TABLE public.team_notification_settings
  ALTER COLUMN training_enabled SET DEFAULT true,
  ALTER COLUMN training_enabled SET NOT NULL,
  ALTER COLUMN training_minutes_before SET DEFAULT 120,
  ALTER COLUMN training_minutes_before SET NOT NULL,
  ALTER COLUMN match_enabled SET DEFAULT true,
  ALTER COLUMN match_enabled SET NOT NULL,
  ALTER COLUMN match_minutes_before SET DEFAULT 1440,
  ALTER COLUMN match_minutes_before SET NOT NULL,
  ALTER COLUMN match_second_enabled SET DEFAULT false,
  ALTER COLUMN match_second_enabled SET NOT NULL,
  ALTER COLUMN match_second_minutes_before SET DEFAULT 120,
  ALTER COLUMN match_second_minutes_before SET NOT NULL,
  ALTER COLUMN event_enabled SET DEFAULT false,
  ALTER COLUMN event_enabled SET NOT NULL,
  ALTER COLUMN event_minutes_before SET DEFAULT 1440,
  ALTER COLUMN event_minutes_before SET NOT NULL;

CREATE OR REPLACE FUNCTION public.team_notification_settings_sync_alias_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.training_enabled := NEW.training_reminder_enabled;
  NEW.training_minutes_before := NEW.training_reminder_minutes_before;
  NEW.match_enabled := NEW.match_reminder_enabled;
  NEW.match_minutes_before := NEW.match_reminder_minutes_before;
  NEW.match_second_enabled := NEW.match_second_reminder_enabled;
  NEW.match_second_minutes_before := NEW.match_second_reminder_minutes_before;
  NEW.event_enabled := NEW.event_reminder_enabled;
  NEW.event_minutes_before := NEW.event_reminder_minutes_before;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_notification_settings_sync_alias_columns ON public.team_notification_settings;
CREATE TRIGGER trg_team_notification_settings_sync_alias_columns
BEFORE INSERT OR UPDATE ON public.team_notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.team_notification_settings_sync_alias_columns();

SELECT pg_notify('pgrst', 'reload schema');
