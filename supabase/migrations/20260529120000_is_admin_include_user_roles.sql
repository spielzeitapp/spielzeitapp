-- is_admin(): System-Admin auch über public.user_roles (role = admin), wie Frontend/useSession.
-- profiles.is_admin bleibt gültig. Kein memberships-Read (keine RLS-Rekursion).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
      false
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND lower(trim(ur.role)) = 'admin'
    );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True if profiles.is_admin or user_roles.role = admin for auth.uid(). Does not read memberships.';

SELECT pg_notify('pgrst', 'reload schema');
