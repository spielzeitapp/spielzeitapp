-- Reminder + Inbox: keine doppelte Job-Erzeugung per DB-Trigger (Client-Sync ist Single Source of Truth)
-- + RLS für notifications.read / DELETE (Inbox)

-- 1) Trigger entfernen, der parallel zu syncEventReminderJobs doppelte notification_jobs erzeugt
DROP TRIGGER IF EXISTS trg_events_sync_notification_jobs ON public.events;
DROP FUNCTION IF EXISTS public.trg_sync_notification_jobs_for_event();
DROP FUNCTION IF EXISTS public.sync_notification_jobs_for_event(uuid);

-- 2) notification_dispatch_log: UNIQUE (user_id, event_id, reminder_key, channel) bereits in 20260323120000

-- 3) notifications: Lesen/Schreiben eigener Zeilen (Reminder pro user_id)
-- Eigenes Postfach: user_id gesetzt → nur dieser User; teamweit (user_id NULL) → Mitglied der Mannschaft
DROP POLICY IF EXISTS "notifications_update_own_or_team_member" ON public.notifications;
CREATE POLICY "notifications_update_own_or_team_member"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (
      user_id IS NULL
      AND team_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships m
        INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
        WHERE m.user_id = auth.uid()
          AND ts.team_id = notifications.team_id
      )
    )
  )
  WITH CHECK (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (
      user_id IS NULL
      AND team_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships m
        INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
        WHERE m.user_id = auth.uid()
          AND ts.team_id = notifications.team_id
      )
    )
  );

DROP POLICY IF EXISTS "notifications_delete_own_or_team_member" ON public.notifications;
CREATE POLICY "notifications_delete_own_or_team_member"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR (
      user_id IS NULL
      AND team_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships m
        INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
        WHERE m.user_id = auth.uid()
          AND ts.team_id = notifications.team_id
      )
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
