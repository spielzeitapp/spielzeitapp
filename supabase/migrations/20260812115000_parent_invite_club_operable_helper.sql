-- PARENT-INVITE live helper: clubs.status + club_is_operable
-- Required by 20260812120000 / 20260812140000.
-- Additive and idempotent. No admin RPCs, no club seeds, no test data.

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.clubs
SET status = 'active'
WHERE status IS NULL OR btrim(status) = '';

ALTER TABLE public.clubs
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.clubs
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clubs_status_check'
      AND conrelid = 'public.clubs'::regclass
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_status_check
      CHECK (status IN ('active', 'archived'));
  END IF;
END $$;

COMMENT ON COLUMN public.clubs.status IS
  'active | archived. Archivierte Vereine bleiben historisch lesbar, sind aber nicht operativ nutzbar.';

CREATE OR REPLACE FUNCTION public.club_is_operable(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clubs c
    WHERE c.id = p_club_id
      AND c.status = 'active'
  );
$$;

COMMENT ON FUNCTION public.club_is_operable(uuid) IS
  'True wenn der Verein existiert und status=active (operative Nutzung erlaubt).';

REVOKE ALL ON FUNCTION public.club_is_operable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_is_operable(uuid) TO authenticated;
