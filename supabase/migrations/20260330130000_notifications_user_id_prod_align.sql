-- PROD-Align: notifications.user_id / event_id / read
--
-- Symptom: App nutzt user_id (Badge, Liste, Reminder, Realtime), Spalte fehlt in PROD
-- → PostgREST: "column notifications.user_id does not exist"
--
-- Ursache: Migration 20260328120000_notifications_user_event_read.sql wurde auf PROD nicht angewendet.
-- Diese Datei ist idempotent (IF NOT EXISTS) und zerstört keine Daten.
--
-- Modell (unverändert zum Repo):
-- - teamweit: user_id IS NULL, team_id gesetzt (z. B. Team-Push)
-- - userbezogen: user_id gesetzt (z. B. Reminder pro Empfänger)

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_id uuid NULL REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.notifications.user_id IS 'Empfänger (optional; NULL = teamweit wie bisher)';
COMMENT ON COLUMN public.notifications.event_id IS 'Bezugstermin';
COMMENT ON COLUMN public.notifications.read IS 'Gelesen (pro User-Zeile)';

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_event_id
  ON public.notifications (event_id)
  WHERE event_id IS NOT NULL;

DROP POLICY IF EXISTS "notifications_select_recipient_own" ON public.notifications;
CREATE POLICY "notifications_select_recipient_own"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

SELECT pg_notify('pgrst', 'reload schema');
