-- FIX: memberships RLS recursion stoppen (alle Policies runter, minimal neu anlegen)

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'memberships'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.memberships;', r.policyname);
  END LOOP;
END $$;

-- Minimal, NICHT rekursiv: User sieht/ändert nur eigene membership-Zeilen
CREATE POLICY memberships_select_own
ON public.memberships
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY memberships_insert_own
ON public.memberships
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY memberships_update_own
ON public.memberships
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY memberships_delete_own
ON public.memberships
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
