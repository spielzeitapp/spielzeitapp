-- Existing local team crests remain valid. Custom crests use team-scoped Storage paths.
ALTER TABLE public.team_branding_overrides
  ALTER COLUMN logo_url DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS team_branding_overrides_logo_url_check;

ALTER TABLE public.team_branding_overrides
  ADD CONSTRAINT team_branding_overrides_logo_url_check CHECK (
    logo_url IS NULL OR logo_url ~ '^/logos/[a-z0-9-]+[.](png|webp|jpg)$'
    OR logo_url ~ ('^https://[a-z0-9]+[.]supabase[.]co/storage/v1/object/public/team-logos/'
      || team_id::text || '/[0-9a-f-]{36}[.](png|webp|jpg)$')
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('team-logos', 'team-logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS team_appearance_platform_admin_upload ON storage.objects;
CREATE POLICY team_appearance_platform_admin_upload ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'team-logos'
    AND (SELECT public.is_platform_admin())
    AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|webp|jpg)$'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id::text = split_part(storage.objects.name, '/', 1) AND public.club_is_operable(t.club_id)
    )
  );

CREATE OR REPLACE FUNCTION public.admin_set_team_branding(
  p_club_id uuid, p_team_id uuid, p_branding jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_logo text := nullif(btrim(p_branding->>'logo_url'), '');
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_platform_admin(), false) THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.teams
  WHERE id = p_team_id AND club_id = p_club_id FOR UPDATE;
  IF NOT FOUND OR NOT coalesce(public.club_is_operable(p_club_id), false) THEN
    RAISE EXCEPTION 'Mannschaft gehört nicht zu einem aktiven Verein in dieser Auswahl.' USING ERRCODE = '22023';
  END IF;

  IF p_branding IS NULL THEN
    DELETE FROM public.team_branding_overrides WHERE team_id = p_team_id;
    RETURN;
  END IF;

  IF v_logo LIKE 'https://%' AND NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'team-logos'
      AND name = split_part(v_logo, '/team-logos/', 2)
  ) THEN
    RAISE EXCEPTION 'Das hochgeladene Mannschaftslogo wurde nicht gefunden.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.team_branding_overrides (team_id, logo_url, primary_color, secondary_color, accent_color)
  VALUES (p_team_id, v_logo, p_branding->>'primary_color', p_branding->>'secondary_color', p_branding->>'accent_color')
  ON CONFLICT (team_id) DO UPDATE SET
    logo_url = excluded.logo_url,
    primary_color = excluded.primary_color,
    secondary_color = excluded.secondary_color,
    accent_color = excluded.accent_color;
END $$;

REVOKE ALL ON FUNCTION public.admin_set_team_branding(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_team_branding(uuid, uuid, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
