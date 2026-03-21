-- Log für versendete Reminder (keine Doppel-Sends)
-- Typen: training_reminder, game_reminder

CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('training_reminder', 'game_reminder')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id, notification_type)
);

CREATE INDEX IF NOT EXISTS notification_log_user_id_idx ON public.notification_log (user_id);
CREATE INDEX IF NOT EXISTS notification_log_event_id_idx ON public.notification_log (event_id);
CREATE INDEX IF NOT EXISTS notification_log_created_at_idx ON public.notification_log (created_at DESC);

COMMENT ON TABLE public.notification_log IS 'Erinnerungen (Web Push); UNIQUE verhindert Duplikate pro User/Event/Typ.';

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Kein direkter Client-Zugriff; nur Service Role (Dispatch-API)
CREATE POLICY "notification_log_no_client"
  ON public.notification_log
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
