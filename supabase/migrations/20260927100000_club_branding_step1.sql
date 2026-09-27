-- Step 1: club branding. Existing clubs retain the SpielzeitApp default until configured.
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS accent_color text;

ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_branding_colors_check CHECK (
    (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$') AND
    (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$') AND
    (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$')
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('club-logos', 'club-logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY club_logos_public_read ON storage.objects FOR SELECT TO public
USING (bucket_id = 'club-logos');
CREATE POLICY club_logos_admin_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'club-logos' AND public.is_admin());
CREATE POLICY club_logos_admin_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'club-logos' AND public.is_admin())
WITH CHECK (bucket_id = 'club-logos' AND public.is_admin());

CREATE FUNCTION public.admin_get_club_branding(p_club_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_club public.clubs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_club FROM public.clubs WHERE id = p_club_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verein nicht gefunden' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('logo_url', v_club.logo_url,
    'primary_color', v_club.primary_color, 'secondary_color', v_club.secondary_color,
    'accent_color', v_club.accent_color);
END $$;
REVOKE ALL ON FUNCTION public.admin_get_club_branding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_club_branding(uuid) TO authenticated;

CREATE FUNCTION public.admin_set_club_branding(
  p_club_id uuid, p_logo_url text, p_primary_color text,
  p_secondary_color text, p_accent_color text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_logo text := nullif(btrim(coalesce(p_logo_url, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE = '42501';
  END IF;
  IF v_logo IS NOT NULL AND v_logo !~ ('^https://[^/]+/storage/v1/object/public/club-logos/' || p_club_id::text || '/[a-zA-Z0-9._-]+$') THEN
    RAISE EXCEPTION 'Ungültiger Logo-Pfad' USING ERRCODE = '22023';
  END IF;
  UPDATE public.clubs SET logo_url = v_logo,
    primary_color = p_primary_color, secondary_color = p_secondary_color,
    accent_color = p_accent_color, updated_at = now()
  WHERE id = p_club_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verein nicht gefunden' USING ERRCODE = 'P0002'; END IF;
  RETURN public.admin_get_club_branding(p_club_id);
END $$;
REVOKE ALL ON FUNCTION public.admin_set_club_branding(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_club_branding(uuid, text, text, text, text) TO authenticated;
