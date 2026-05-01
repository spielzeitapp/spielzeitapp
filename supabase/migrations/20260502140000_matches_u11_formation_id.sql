-- U11-Formation als Single Source of Truth auf dem Match (nullable; CHECK nur für gesetzte Werte).

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS u11_formation_id text;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_u11_formation_id_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_u11_formation_id_check
  CHECK (
    u11_formation_id IS NULL
    OR u11_formation_id IN ('1-2-2-2', '1-2-3-1', '1-3-2-1')
  );

COMMENT ON COLUMN public.matches.u11_formation_id IS
  'U11-System (7er): Darstellung auf dem Pitch; NULL = Client-Fallback.';
