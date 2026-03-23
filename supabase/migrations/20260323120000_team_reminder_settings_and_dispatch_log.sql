-- Globale Team-Reminder-Einstellungen + Dispatch-Log (Duplikate vermeiden)
-- messages: reminder_key + Index ersetzt teamweite Unique (pro User/Ereignis/Stufe)

DROP INDEX IF EXISTS public.idx_messages_team_event_type_unique;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reminder_key text NULL;

COMMENT ON COLUMN public.messages.reminder_key IS 'z. B. training_120, match_1440 — eindeutig pro Reminder-Stufe';

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_user_event_reminder_unique
  ON public.messages (user_id, related_event_id, type, reminder_key)
  WHERE user_id IS NOT NULL
    AND related_event_id IS NOT NULL
    AND reminder_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.team_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_season_id uuid NOT NULL UNIQUE REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  training_reminder_enabled boolean NOT NULL DEFAULT true,
  training_reminder_minutes_before integer NOT NULL DEFAULT 120,
  match_reminder_enabled boolean NOT NULL DEFAULT true,
  match_reminder_minutes_before integer NOT NULL DEFAULT 1440,
  match_second_reminder_enabled boolean NOT NULL DEFAULT false,
  match_second_reminder_minutes_before integer NOT NULL DEFAULT 120,
  event_reminder_enabled boolean NOT NULL DEFAULT false,
  event_reminder_minutes_before integer NOT NULL DEFAULT 1440,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_notification_settings_team_season
  ON public.team_notification_settings (team_season_id);

DROP TRIGGER IF EXISTS trg_team_notification_settings_updated_at ON public.team_notification_settings;
CREATE TRIGGER trg_team_notification_settings_updated_at
  BEFORE UPDATE ON public.team_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.team_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_notification_settings_select_members" ON public.team_notification_settings;
CREATE POLICY "team_notification_settings_select_members"
  ON public.team_notification_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id = team_notification_settings.team_season_id
    )
  );

DROP POLICY IF EXISTS "team_notification_settings_write_staff" ON public.team_notification_settings;
CREATE POLICY "team_notification_settings_write_staff"
  ON public.team_notification_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id = team_notification_settings.team_season_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DROP POLICY IF EXISTS "team_notification_settings_update_staff" ON public.team_notification_settings;
CREATE POLICY "team_notification_settings_update_staff"
  ON public.team_notification_settings
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id = team_notification_settings.team_season_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.team_season_id = team_notification_settings.team_season_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

CREATE TABLE IF NOT EXISTS public.notification_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reminder_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('in_app', 'push')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id, reminder_key, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_log_event
  ON public.notification_dispatch_log (event_id);

CREATE INDEX IF NOT EXISTS idx_notification_dispatch_log_user
  ON public.notification_dispatch_log (user_id);

ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;

SELECT pg_notify('pgrst', 'reload schema');
