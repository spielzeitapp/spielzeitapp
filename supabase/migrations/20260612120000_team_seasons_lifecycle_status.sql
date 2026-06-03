-- STEP 1 Saisonwechsel: Lifecycle-Felder auf team_seasons vorbereiten.
-- Kein Archivieren bestehender Saisons; keine Änderungen an players/events/matches/memberships.

ALTER TABLE public.team_seasons
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.team_seasons
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE public.team_seasons
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.team_seasons
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.team_seasons
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.team_seasons
  ADD COLUMN IF NOT EXISTS prepared_from_team_season_id uuid;

ALTER TABLE public.team_seasons
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.team_seasons
  ADD COLUMN IF NOT EXISTS age_group text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'team_seasons_prepared_from_team_season_id_fkey'
      AND conrelid = 'public.team_seasons'::regclass
  ) THEN
    ALTER TABLE public.team_seasons
      ADD CONSTRAINT team_seasons_prepared_from_team_season_id_fkey
      FOREIGN KEY (prepared_from_team_season_id)
      REFERENCES public.team_seasons (id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.team_seasons
  DROP CONSTRAINT IF EXISTS team_seasons_status_check;

ALTER TABLE public.team_seasons
  ADD CONSTRAINT team_seasons_status_check
  CHECK (status IN ('active', 'draft', 'archived'));

COMMENT ON COLUMN public.team_seasons.status IS
  'Lifecycle: active (laufend), draft (Vorbereitung nächste Saison), archived (abgeschlossen).';

COMMENT ON COLUMN public.team_seasons.archived_at IS
  'Zeitpunkt der Archivierung; NULL solange nicht archiviert.';

COMMENT ON COLUMN public.team_seasons.prepared_from_team_season_id IS
  'Bei draft: Quell-team_season (z. B. U11-Saison für U12-Vorbereitung).';

COMMENT ON COLUMN public.team_seasons.display_name IS
  'Optionaler Anzeigename für Team-Saison (z. B. Entwurf U12 …).';

COMMENT ON COLUMN public.team_seasons.age_group IS
  'Optionale Altersklasse pro Team-Saison (Snapshot, unabhängig von teams.age_group).';

-- Legacy is_archived/is_active auf team_seasons: nicht duplizieren, nur dokumentieren.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_seasons'
      AND column_name = 'is_archived'
  ) THEN
    COMMENT ON COLUMN public.team_seasons.is_archived IS
      'Legacy-Flag; neue Logik nutzt status und archived_at. Bestehende Zeilen bleiben unverändert.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_seasons'
      AND column_name = 'is_active'
  ) THEN
    COMMENT ON COLUMN public.team_seasons.is_active IS
      'Legacy-Flag; neue Logik nutzt status. Bestehende Zeilen bleiben unverändert.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_team_seasons_status
  ON public.team_seasons (status);

CREATE INDEX IF NOT EXISTS idx_team_seasons_prepared_from
  ON public.team_seasons (prepared_from_team_season_id)
  WHERE prepared_from_team_season_id IS NOT NULL;

SELECT pg_notify('pgrst', 'reload schema');
