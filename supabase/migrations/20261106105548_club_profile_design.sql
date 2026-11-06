CREATE FUNCTION public.valid_club_profile_design(v jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; e jsonb;
BEGIN
 IF v IS NULL THEN RETURN true;END IF;
 IF jsonb_typeof(v)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(v))<>4 THEN RETURN false;END IF;
 FOREACH k IN ARRAY ARRAY['name','number','logo','team'] LOOP
 e:=v->k;
 IF e IS NULL OR jsonb_typeof(e)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(e))<>7 THEN RETURN false;END IF;
 IF jsonb_typeof(e->'visible')<>'boolean' OR jsonb_typeof(e->'x')<>'number' OR jsonb_typeof(e->'y')<>'number' OR jsonb_typeof(e->'size')<>'number' OR jsonb_typeof(e->'opacity')<>'number' THEN RETURN false;END IF;
 IF NOT coalesce((e->>'x')::numeric BETWEEN 0 AND 100 AND (e->>'y')::numeric BETWEEN 0 AND 100 AND (e->>'size')::numeric BETWEEN 2 AND 50 AND (e->>'opacity')::numeric BETWEEN 0 AND 100 AND e->>'color' ~ '^#[0-9a-fA-F]{6}$' AND e->>'align' IN ('left','center','right'),false) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
 EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER TABLE public.clubs ADD COLUMN player_profile_design jsonb CHECK(public.valid_club_profile_design(player_profile_design));
CREATE FUNCTION public.admin_save_club_profile_design(p_club_id uuid,p_template text,p_expected text,p_design jsonb,p_expected_design jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Nur Plattformadmin' USING ERRCODE='42501';END IF;
 IF p_template IS NULL OR p_template NOT IN ('wide','square') OR NOT public.valid_club_profile_design(p_design) THEN RAISE EXCEPTION 'Ungültige Gestaltung';END IF;
 UPDATE public.clubs SET player_photo_template=p_template,player_profile_design=p_design WHERE id=p_club_id AND status='active' AND player_photo_template=p_expected AND player_profile_design IS NOT DISTINCT FROM p_expected_design;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vorlage inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001';END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_club_profile_design(uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_club_profile_design(uuid,text,text,jsonb,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
