-- Turnier-Spielphase (Vorrunde, KO, Platzierung) für Import/Refresh (Step 8).

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS phase text NULL;

COMMENT ON COLUMN public.tournament_matches.phase IS
  'Optional: group | placement | semifinal | final | unknown (offizieller Turnierplan-Import).';

SELECT pg_notify('pgrst', 'reload schema');
