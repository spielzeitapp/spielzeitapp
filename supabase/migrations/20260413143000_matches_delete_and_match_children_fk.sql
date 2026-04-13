-- Match-Loeschung: Trainer/Co/Admin duerfen matches loeschen.
-- Zusaetzlich FK-Cascades auf match_lineup/match_bench absichern.

DROP POLICY IF EXISTS matches_delete_staff_admin ON public.matches;
CREATE POLICY matches_delete_staff_admin ON public.matches
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.user_id = auth.uid()
        AND ms.team_season_id = matches.team_season_id
        AND ms.role::text IN ('trainer', 'co_trainer', 'head_coach')
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'match_lineup_match_id_fkey'
      AND conrelid = 'public.match_lineup'::regclass
  ) THEN
    ALTER TABLE public.match_lineup
      ADD CONSTRAINT match_lineup_match_id_fkey
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'match_bench_match_id_fkey'
      AND conrelid = 'public.match_bench'::regclass
  ) THEN
    ALTER TABLE public.match_bench
      ADD CONSTRAINT match_bench_match_id_fkey
      FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

