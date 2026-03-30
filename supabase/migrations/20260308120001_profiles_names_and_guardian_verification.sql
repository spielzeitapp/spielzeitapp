-- Parent account identity: profiles first/last name; player_guardians verification (optional for trainer/admin).
-- Multiple guardians per child: unique on (user_id, player_id) only (no unique on player_id).

-- 1) profiles: first_name, last_name for parent display
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

COMMENT ON COLUMN public.profiles.first_name IS 'Display first name (e.g. from registration).';
COMMENT ON COLUMN public.profiles.last_name IS 'Display last name (e.g. from registration).';

-- Allow app to create own profile row (e.g. after magic-link signup when we upsert with name)
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- 2) player_guardians: ensure table exists with (user_id, player_id); allow multiple guardians per player.
-- If your DB already has player_guardians, this block is idempotent (CREATE IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS public.player_guardians (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, player_id)
);

-- Optional: verified_at for trainer/admin to mark parent-child link as verified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_guardians' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE public.player_guardians
      ADD COLUMN verified_at timestamptz NULL,
      ADD COLUMN verified_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.player_guardians.verified_at IS 'Set by trainer/admin when parent-child link is verified.';
COMMENT ON COLUMN public.player_guardians.verified_by IS 'User (trainer/admin) who verified the link.';

-- Ensure unique is only (user_id, player_id) so multiple rows per player_id (different user_id) are allowed.
-- If an old constraint exists that limits one guardian per player, drop it (not created here; table may pre-exist).
CREATE UNIQUE INDEX IF NOT EXISTS player_guardians_user_player_key
  ON public.player_guardians (user_id, player_id);

-- RLS for player_guardians if not already enabled
ALTER TABLE public.player_guardians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_guardians_select_own ON public.player_guardians;
CREATE POLICY player_guardians_select_own ON public.player_guardians
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS player_guardians_insert_own ON public.player_guardians;
CREATE POLICY player_guardians_insert_own ON public.player_guardians
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Trainer/admin may need to SELECT all guardian links for verification UI (optional)
-- For now, staff see via team/players context; add a policy later if you add an admin "verify guardians" page.

SELECT pg_notify('pgrst', 'reload schema');
