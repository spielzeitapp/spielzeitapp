-- Mehrere Spielorte pro Team (Heim) bzw. Gegner (Auswärts).
-- Adresse/GPS bleiben ausschließlich in public.venues.
-- Gegner heute: Freitext → opponent_key (normalisiert, saisonunabhängig).
-- Später ÖFB: opponent_key matchen; optional team_id wenn echte Teams existieren.

CREATE TABLE IF NOT EXISTS public.team_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams (id) ON DELETE CASCADE,
  opponent_key text,
  opponent_label text,
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_venues_subject_xor CHECK (
    (
      team_id IS NOT NULL
      AND opponent_key IS NULL
    )
    OR (
      team_id IS NULL
      AND opponent_key IS NOT NULL
      AND length(btrim(opponent_key)) > 0
    )
  )
);

COMMENT ON TABLE public.team_venues IS
  'Zuordnung Venue ↔ eigenes Team (Heim) oder Gegner-Key (Auswärts). Mehrere Venues erlaubt; optional ein Default.';

COMMENT ON COLUMN public.team_venues.opponent_key IS
  'Normalisierter Gegnername (lower(btrim(...))), saisonunabhängig. Fallback solange kein opponent_team_id existiert.';

COMMENT ON COLUMN public.team_venues.opponent_label IS
  'Anzeigename des Gegners wie eingegeben (nicht normalisiert).';

CREATE INDEX IF NOT EXISTS idx_team_venues_club_id ON public.team_venues (club_id);
CREATE INDEX IF NOT EXISTS idx_team_venues_team_id ON public.team_venues (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_venues_opponent_key
  ON public.team_venues (club_id, opponent_key) WHERE opponent_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_venues_venue_id ON public.team_venues (venue_id);

-- Gleiches Venue nicht doppelt demselben Team / Gegner zuordnen.
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_venues_team_venue_unique
  ON public.team_venues (club_id, team_id, venue_id)
  WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_venues_opponent_venue_unique
  ON public.team_venues (club_id, opponent_key, venue_id)
  WHERE opponent_key IS NOT NULL;

-- Höchstens ein Default pro Team bzw. Gegner.
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_venues_team_default_unique
  ON public.team_venues (club_id, team_id)
  WHERE team_id IS NOT NULL AND is_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_venues_opponent_default_unique
  ON public.team_venues (club_id, opponent_key)
  WHERE opponent_key IS NOT NULL AND is_default;

CREATE OR REPLACE FUNCTION public.set_team_venues_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_venues_updated_at ON public.team_venues;
CREATE TRIGGER trg_team_venues_updated_at
  BEFORE UPDATE ON public.team_venues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_team_venues_updated_at();

-- opponent_key immer speichern als lower(btrim(...)).
CREATE OR REPLACE FUNCTION public.normalize_team_venues_opponent_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.opponent_key IS NOT NULL THEN
    NEW.opponent_key := lower(btrim(NEW.opponent_key));
    IF NEW.opponent_key = '' THEN
      NEW.opponent_key := NULL;
    END IF;
  END IF;
  IF NEW.opponent_label IS NOT NULL THEN
    NEW.opponent_label := nullif(btrim(NEW.opponent_label), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_venues_normalize_opponent_key ON public.team_venues;
CREATE TRIGGER trg_team_venues_normalize_opponent_key
  BEFORE INSERT OR UPDATE ON public.team_venues
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_team_venues_opponent_key();

ALTER TABLE public.team_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_venues_select ON public.team_venues;
CREATE POLICY team_venues_select ON public.team_venues
  FOR SELECT TO authenticated
  USING (public.can_read_club_venues(club_id));

DROP POLICY IF EXISTS team_venues_insert ON public.team_venues;
CREATE POLICY team_venues_insert ON public.team_venues
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS team_venues_update ON public.team_venues;
CREATE POLICY team_venues_update ON public.team_venues
  FOR UPDATE TO authenticated
  USING (public.can_manage_club_venues(club_id))
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS team_venues_delete ON public.team_venues;
CREATE POLICY team_venues_delete ON public.team_venues
  FOR DELETE TO authenticated
  USING (public.can_manage_club_venues(club_id));
