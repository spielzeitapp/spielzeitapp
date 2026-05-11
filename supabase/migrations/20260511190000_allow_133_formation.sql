-- Erweitert erlaubte Werte für U11-Formation um '1-3-3' (CHECK auf matches.u11_formation_id).

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_u11_formation_id_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_u11_formation_id_check
  CHECK (
    u11_formation_id IS NULL
    OR u11_formation_id IN ('1-2-2-2', '1-2-3-1', '1-3-2-1', '1-3-3')
  );
