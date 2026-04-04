-- Inbox strikt pro eingeloggtem User: kein teamweites Lesen/Updaten/Löschen mehr über RLS
-- Hinweis: Zeilen mit user_id IS NULL (z. B. ältere Team-Push-Einträge) sind für authenticated nicht sichtbar;
-- neue Reminder und künftige Einträge sollten user_id setzen.

DROP POLICY IF EXISTS "notifications_select_team_members" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_recipient_own" ON public.notifications;

CREATE POLICY "notifications_select_own_recipient"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own_or_team_member" ON public.notifications;
CREATE POLICY "notifications_update_own_recipient"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (user_id IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own_or_team_member" ON public.notifications;
CREATE POLICY "notifications_delete_own_recipient"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

SELECT pg_notify('pgrst', 'reload schema');
