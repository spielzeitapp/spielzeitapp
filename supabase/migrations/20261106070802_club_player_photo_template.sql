-- Card format belongs to the club; individual image coordinates remain on memberships.
ALTER TABLE public.clubs ADD COLUMN player_photo_template text NOT NULL DEFAULT 'wide'
 CHECK(player_photo_template IN ('wide','square'));
UPDATE public.clubs SET player_photo_template='square' WHERE id='f89c97bb-1408-438d-9f93-efec64f51f88';
CREATE FUNCTION public.admin_save_club_photo_template(p_club_id uuid,p_template text,p_expected text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE='42501'; END IF;
 IF p_template IS NULL OR p_template NOT IN ('wide','square') THEN RAISE EXCEPTION 'Ungültige Vorlage'; END IF;
 UPDATE public.clubs SET player_photo_template=p_template
 WHERE id=p_club_id AND status='active' AND player_photo_template=p_expected;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vorlage geändert oder Verein nicht aktiv. Bitte neu laden.' USING ERRCODE='40001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_club_photo_template(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_club_photo_template(uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
