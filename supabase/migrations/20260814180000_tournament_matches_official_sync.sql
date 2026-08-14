-- Staging: offizielle/fremde Turnierspiele persistieren, ohne volle Live-Matches.
-- Eigene Spiele behalten match_id → public.matches (SpielzeitApp bleibt Source of Truth).

ALTER TABLE public.tournament_matches
  ALTER COLUMN match_id DROP NOT NULL;

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS home_team text NULL,
  ADD COLUMN IF NOT EXISTS away_team text NULL,
  ADD COLUMN IF NOT EXISTS is_own_team boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'spielzeitapp',
  ADD COLUMN IF NOT EXISTS provider text NULL,
  ADD COLUMN IF NOT EXISTS external_match_id text NULL,
  ADD COLUMN IF NOT EXISTS official_status text NULL,
  ADD COLUMN IF NOT EXISTS home_goals integer NULL,
  ADD COLUMN IF NOT EXISTS away_goals integer NULL;

COMMENT ON COLUMN public.tournament_matches.match_id IS
  'Nur eigene spielbare Spiele: Verweis auf public.matches. Fremdspiele bleiben NULL.';
COMMENT ON COLUMN public.tournament_matches.is_own_team IS
  'true = unsere Mannschaft (SpielzeitApp-Match). false = offizielles Fremdspiel.';
COMMENT ON COLUMN public.tournament_matches.source IS
  'spielzeitapp = eigene SoT; official = Turnierplan ist SoT.';
COMMENT ON COLUMN public.tournament_matches.provider IS
  'meinturnierplan | tournament-live';
COMMENT ON COLUMN public.tournament_matches.external_match_id IS
  'Stabile Provider-ID für idempotenten Refresh.';
COMMENT ON COLUMN public.tournament_matches.official_status IS
  'upcoming | live | finished — nur für Fremdspiele / offiziellen Plan.';
COMMENT ON COLUMN public.tournament_matches.home_goals IS
  'Offizielles Heim-Ergebnis. Bei eigenen Spielen nicht als SoT verwenden.';
COMMENT ON COLUMN public.tournament_matches.away_goals IS
  'Offizielles Auswärts-Ergebnis. Bei eigenen Spielen nicht als SoT verwenden.';

CREATE UNIQUE INDEX IF NOT EXISTS tournament_matches_event_external_id_uidx
  ON public.tournament_matches (tournament_event_id, external_match_id)
  WHERE external_match_id IS NOT NULL;

UPDATE public.tournament_matches
SET
  is_own_team = COALESCE(is_own_team, true),
  source = COALESCE(NULLIF(source, ''), 'spielzeitapp')
WHERE match_id IS NOT NULL;

SELECT pg_notify('pgrst', 'reload schema');
