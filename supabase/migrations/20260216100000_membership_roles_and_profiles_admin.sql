-- Data model: memberships.role = team roles only; system admin = profiles.is_admin (no recursion).
--
-- 1) memberships.role: Postgres enum (fan, parent, player, trainer, co_trainer, head_coach)
-- 2) profiles table + is_admin boolean (if not exists)
-- 3) is_admin() reads profiles.is_admin only; memberships SELECT policy uses it for admin override
--
-- Apply after 20260216000000_memberships_rls_no_recursion.sql so insert/update/delete policies exist.

-- ---------------------------------------------------------------------------
-- 1) memberships.role: Postgres enum (fan, parent, player, trainer, co_trainer, head_coach)
-- ---------------------------------------------------------------------------

-- Drop existing check constraint on role (name may vary)
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_role_check;

-- Create enum for team roles only (system admin lives in profiles, not here)
DO $$
BEGIN
  CREATE TYPE public.membership_role AS ENUM (
    'fan',
    'parent',
    'player',
    'trainer',
    'co_trainer',
    'head_coach'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ensure column is text so we can cast to enum (no-op if already text)
ALTER TABLE public.memberships
  ALTER COLUMN role TYPE text USING role::text;

-- Now set type to enum; map any unknown value (e.g. old 'admin' in memberships) to 'fan'
ALTER TABLE public.memberships
  ALTER COLUMN role TYPE public.membership_role
  USING (
    CASE role::text
      WHEN 'fan' THEN 'fan'::public.membership_role
      WHEN 'parent' THEN 'parent'::public.membership_role
      WHEN 'player' THEN 'player'::public.membership_role
      WHEN 'trainer' THEN 'trainer'::public.membership_role
      WHEN 'co_trainer' THEN 'co_trainer'::public.membership_role
      WHEN 'head_coach' THEN 'head_coach'::public.membership_role
      ELSE 'fan'::public.membership_role
    END
  );

ALTER TABLE public.memberships
  ALTER COLUMN role SET DEFAULT 'fan'::public.membership_role;

-- ---------------------------------------------------------------------------
-- 2) profiles table and is_admin (system admin outside memberships)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS 'System-level admin; separate from memberships.role (team roles only).';

-- Optional: RLS on profiles so users can read their own row (and admins via service role)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Insert/update often via trigger or service role; minimal policy for "own row" update
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 3) is_admin() from profiles (no memberships read → no recursion), and RLS example
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS 'True if current user is system admin (profiles.is_admin). Do not read memberships here.';

-- Example: memberships SELECT policy with admin override (no recursion; is_admin reads profiles only)
-- Run only if you want admin to see all rows; otherwise keep simple auth.uid() = user_id only.

DROP POLICY IF EXISTS memberships_select_own ON public.memberships;
CREATE POLICY memberships_select_own ON public.memberships
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Reminder: keep insert/update/delete as own-row only (no admin override for write, or add with is_admin() if desired)
-- INSERT/UPDATE/DELETE policies unchanged from previous migration (own row only).
