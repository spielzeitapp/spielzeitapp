CREATE TABLE IF NOT EXISTS public.team_branding_overrides (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  logo_url text NOT NULL CHECK (logo_url ~ '^/logos/[a-z0-9-]+[.](png|webp|jpg)$'),
  primary_color text NOT NULL CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text NOT NULL CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text NOT NULL CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

ALTER TABLE public.team_branding_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_branding_overrides FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.team_branding_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_branding_overrides TO service_role;

DROP POLICY IF EXISTS team_branding_read_visible_team ON public.team_branding_overrides;
CREATE POLICY team_branding_read_visible_team ON public.team_branding_overrides
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_branding_overrides.team_id));

NOTIFY pgrst, 'reload schema';
