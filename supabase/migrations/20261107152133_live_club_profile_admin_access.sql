-- LIVE clubs has RLS enabled but no direct-access policies. The new invoker
-- commands need SELECT/UPDATE for the same verified platform admins who
-- already manage clubs through existing admin RPCs. No access for fans/trainers.
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY clubs_profile_admin_select ON public.clubs FOR SELECT TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_platform_admin()));
CREATE POLICY clubs_profile_admin_update ON public.clubs FOR UPDATE TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_platform_admin()))
 WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.is_platform_admin()));
NOTIFY pgrst,'reload schema';
