-- Kader-Pushes muessen neben den normalen Match-Erinnerungen existieren koennen.
-- Eine aeltere DB-Constraint `notification_jobs_unique` begrenzt Jobs zu grob
-- (z. B. auf Event + Art) und blockiert deshalb den Kader-Job mit SQLSTATE 23505.
-- Die fachlich richtige Idempotenz bleibt ueber `dedupe_key` erhalten.

ALTER TABLE public.notification_jobs
  DROP CONSTRAINT IF EXISTS notification_jobs_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_jobs_dedupe_key_unique
  ON public.notification_jobs (dedupe_key);

COMMENT ON INDEX public.idx_notification_jobs_dedupe_key_unique IS
  'Erlaubt mehrere Benachrichtigungsarten pro Event; verhindert nur echte Duplikate per dedupe_key.';

