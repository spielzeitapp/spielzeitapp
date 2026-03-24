DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
CREATE POLICY "messages_delete_own"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

SELECT pg_notify('pgrst', 'reload schema');
