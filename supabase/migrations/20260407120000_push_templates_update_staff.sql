-- UPDATE für Team-Push-Vorlagen (Bearbeiten statt Duplikat-INSERT)

DROP POLICY IF EXISTS "push_templates_update_staff" ON public.push_templates;
CREATE POLICY "push_templates_update_staff"
  ON public.push_templates
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
      WHERE m.user_id = auth.uid()
        AND ts.team_id = push_templates.team_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
      WHERE m.user_id = auth.uid()
        AND ts.team_id = push_templates.team_id
        AND m.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
