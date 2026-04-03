-- Idempotent: sicherstellen, dass kein DB-Trigger parallel zum Client syncEventReminderJobs
-- notification_jobs schreibt (ältere DBs ohne 20260402160000_reminder_inbox_finalize.sql).

DROP TRIGGER IF EXISTS trg_events_sync_notification_jobs ON public.events;
DROP FUNCTION IF EXISTS public.trg_sync_notification_jobs_for_event();
DROP FUNCTION IF EXISTS public.sync_notification_jobs_for_event(uuid);
