-- Reminder-Dispatch: pro User-Zeilen in public.notifications (Service Role)

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_id uuid NULL REFERENCES public.events(id) ON DELETE CASCADE,
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

-- Empfänger sieht eigene Reminder-Zeilen (zusätzlich zu teamweiten Policies)
DROP POLICY IF EXISTS "notifications_select_recipient_own" ON public.notifications;
CREATE POLICY "notifications_select_recipient_own"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

SELECT pg_notify('pgrst', 'reload schema');
