-- STEP 7B.5A: Saisonphase Herbst/Frühjahr auf team_seasons.
-- Eine Saison (z. B. 2026/27) bleibt eine Saison; Phase kennzeichnet Halbjahr.
-- NICHT automatisch anwenden — manuell auf Staging ausführen.

ALTER TABLE public.team_seasons
  ADD COLUMN IF NOT EXISTS season_phase text;

ALTER TABLE public.team_seasons
  DROP CONSTRAINT IF EXISTS team_seasons_season_phase_check;

ALTER TABLE public.team_seasons
  ADD CONSTRAINT team_seasons_season_phase_check
  CHECK (
    season_phase IS NULL
    OR season_phase IN ('autumn', 'spring', 'full')
  );

COMMENT ON COLUMN public.team_seasons.season_phase IS
  'Saisonphase der Mannschaftssaison: autumn (Herbst), spring (Frühjahr), full (Gesamt) oder NULL. Keine zweite Saison wegen Halbjahr.';
