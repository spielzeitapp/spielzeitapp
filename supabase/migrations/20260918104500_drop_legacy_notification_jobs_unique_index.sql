-- Einige Bestandsdatenbanken besitzen die alte Eindeutigkeit nicht als
-- Constraint, sondern als gleichnamigen Unique-Index. Dieser blockiert
-- Kader-Pushes neben der regulaeren Matcherinnerung ebenfalls.

ALTER TABLE public.notification_jobs
  DROP CONSTRAINT IF EXISTS notification_jobs_unique;

DROP INDEX IF EXISTS public.notification_jobs_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_jobs_dedupe_key_unique
  ON public.notification_jobs (dedupe_key);

