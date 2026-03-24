-- Eigene Nachrichtenzeilen (read) dürfen Nutzer aktualisieren
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

SELECT pg_notify('pgrst', 'reload schema');
