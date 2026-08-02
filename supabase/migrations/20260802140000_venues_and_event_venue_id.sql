-- Zentrale Spielorte (vereinsweit, saisonunabhängig).
-- events.venue_id optional; bestehende location-Texte bleiben kompatibel.

CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs (id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams (id) ON DELETE SET NULL,
  name text NOT NULL,
  address text,
  postal_code text,
  city text,
  latitude numeric,
  longitude numeric,
  is_home boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venues_name_nonempty CHECK (length(btrim(name)) > 0)
);

COMMENT ON TABLE public.venues IS
  'Wiederverwendbare Spielorte (Adresse/GPS). Vereinsweit, nicht saisonabhängig.';

CREATE INDEX IF NOT EXISTS idx_venues_club_id ON public.venues (club_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_venues_team_id ON public.venues (team_id) WHERE is_active;

-- Doppelte aktive Namen pro Club vermeiden (normalisiert).
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_club_name_unique
  ON public.venues (club_id, lower(btrim(name)))
  WHERE club_id IS NOT NULL AND is_active;

CREATE OR REPLACE FUNCTION public.set_venues_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venues_updated_at ON public.venues;
CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_venues_updated_at();

-- Staff darf Venues eines Clubs verwalten, wenn sie Staff einer Team-Saison dieses Clubs sind.
CREATE OR REPLACE FUNCTION public.can_manage_club_venues(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      p_club_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships AS m
        JOIN public.team_seasons AS ts ON ts.id = m.team_season_id
        JOIN public.teams AS t ON t.id = ts.team_id
        WHERE t.club_id = p_club_id
          AND m.user_id = auth.uid()
          AND lower(m.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
      )
    );
$$;

COMMENT ON FUNCTION public.can_manage_club_venues(uuid) IS
  'True if auth.uid() may manage venues for p_club_id (admin or staff of a club team).';

REVOKE ALL ON FUNCTION public.can_manage_club_venues(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_club_venues(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_club_venues(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      p_club_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships AS m
        JOIN public.team_seasons AS ts ON ts.id = m.team_season_id
        JOIN public.teams AS t ON t.id = ts.team_id
        WHERE t.club_id = p_club_id
          AND m.user_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_club_venues(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_club_venues(uuid) TO authenticated;

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venues_select ON public.venues;
CREATE POLICY venues_select ON public.venues
  FOR SELECT TO authenticated
  USING (
    public.can_read_club_venues(club_id)
    OR (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.memberships AS m
        JOIN public.team_seasons AS ts ON ts.id = m.team_season_id
        WHERE ts.team_id = venues.team_id
          AND m.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS venues_insert ON public.venues;
CREATE POLICY venues_insert ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS venues_update ON public.venues;
CREATE POLICY venues_update ON public.venues
  FOR UPDATE TO authenticated
  USING (public.can_manage_club_venues(club_id))
  WITH CHECK (public.can_manage_club_venues(club_id));

DROP POLICY IF EXISTS venues_delete ON public.venues;
CREATE POLICY venues_delete ON public.venues
  FOR DELETE TO authenticated
  USING (public.can_manage_club_venues(club_id));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events (venue_id)
  WHERE venue_id IS NOT NULL;

COMMENT ON COLUMN public.events.venue_id IS
  'Optionaler Verweis auf zentralen Spielort. Wenn gesetzt: Source of Truth für Name/Adresse/GPS.';
