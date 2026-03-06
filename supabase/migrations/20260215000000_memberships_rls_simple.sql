-- Phase 2 Stabilität: Rekursion in memberships-Policies entfernen.
-- Vorher: Policy referenzierte evtl. memberships selbst (EXISTS/SELECT) → 500 / infinite recursion.
-- Nachher: Nur auth.uid() = user_id, keine Joins/EXISTS auf memberships.

-- 1) Alle bestehenden Policies auf public.memberships droppen (ohne RLS auszuschalten)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'memberships'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.memberships', pol.policyname);
  END LOOP;
END $$;

-- 2) RLS bleibt an (nur sicherstellen)
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- 3) Vier einfache Policies: nur eigene Zeile (auth.uid() = user_id), keine Rekursion
CREATE POLICY memberships_select_own ON public.memberships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY memberships_insert_own ON public.memberships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY memberships_update_own ON public.memberships
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY memberships_delete_own ON public.memberships
  FOR DELETE USING (auth.uid() = user_id);
