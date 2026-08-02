-- Meisterschafts-Arbeitsliste (ÖFB): Quelltermin vs. vereinbarter Termin.
-- SoT bleibt public.events (kein zweites Fixture-Objekt).
-- open = Arbeitsliste (noch nicht im normalen Spielplan); agreed = vereinbart.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS competition text,
  ADD COLUMN IF NOT EXISTS source_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS fixture_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_fixture_status_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_fixture_status_check
      CHECK (
        fixture_status IS NULL
        OR fixture_status IN ('open', 'agreed')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.events.external_source IS
  'Importquelle, z. B. oefb. NULL = manuell angelegt.';
COMMENT ON COLUMN public.events.external_id IS
  'Stabile externe Match-ID (ÖFB :s=…).';
COMMENT ON COLUMN public.events.external_url IS
  'Link zum ÖFB-Spielbericht / Spielplan-Eintrag.';
COMMENT ON COLUMN public.events.competition IS
  'Bewerb/Liga-Text aus Import (z. B. JHG West Mitte A U12 H).';
COMMENT ON COLUMN public.events.source_starts_at IS
  'ÖFB-Ausgangstermin. Bleibt bei manueller Vereinbarung erhalten.';
COMMENT ON COLUMN public.events.fixture_status IS
  'open = Meisterschafts-Arbeitsliste; agreed = mit Gegner vereinbart; NULL = normales Event.';

-- Reimport-Dedupe: eine Zeile pro ÖFB-Spiel und Team-Saison.
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_team_season_external_unique
  ON public.events (team_season_id, external_source, external_id)
  WHERE external_source IS NOT NULL
    AND external_id IS NOT NULL
    AND length(btrim(external_id)) > 0;

CREATE INDEX IF NOT EXISTS idx_events_fixture_status
  ON public.events (team_season_id, fixture_status)
  WHERE fixture_status IS NOT NULL;
