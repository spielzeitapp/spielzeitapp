-- Reminder-Pipeline Audit: notification_jobs werden NUR von der App angelegt
-- (src/lib/reminders/syncEventReminderJobs.ts nach Event-Insert/Update).
-- Der alte Trigger auf public.events nutzte ein anderes dedupe_key als der Client → zwei Zeilen
-- pro Reminder. Idempotent entfernen (gleiche DROPs wie 20260402160000 / 20260403120000).

DROP TRIGGER IF EXISTS trg_events_sync_notification_jobs ON public.events;
DROP FUNCTION IF EXISTS public.trg_sync_notification_jobs_for_event();
DROP FUNCTION IF EXISTS public.sync_notification_jobs_for_event(uuid);
