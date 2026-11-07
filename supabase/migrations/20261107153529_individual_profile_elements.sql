CREATE OR REPLACE FUNCTION public.valid_club_profile_design(v jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; e jsonb;
BEGIN
 IF v IS NULL THEN RETURN true;END IF;
 IF jsonb_typeof(v)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(v))<>4 THEN RETURN false;END IF;
 FOREACH k IN ARRAY ARRAY['name','number','logo','team'] LOOP
 e:=v->k;
 IF e IS NULL OR jsonb_typeof(e)<>'object' OR NOT (e ?& ARRAY['visible','x','y','size','color','opacity','align']) OR (SELECT count(*) FROM jsonb_object_keys(e-'showName'-'showSeason'))<>7 OR (e ? 'showName' AND jsonb_typeof(e->'showName')<>'boolean') OR (e ? 'showSeason' AND jsonb_typeof(e->'showSeason')<>'boolean') THEN RETURN false;END IF;
 IF jsonb_typeof(e->'visible')<>'boolean' OR jsonb_typeof(e->'x')<>'number' OR jsonb_typeof(e->'y')<>'number' OR jsonb_typeof(e->'size')<>'number' OR jsonb_typeof(e->'opacity')<>'number' THEN RETURN false;END IF;
 IF NOT coalesce((e->>'x')::numeric BETWEEN 0 AND 100 AND (e->>'y')::numeric BETWEEN 0 AND 100 AND (e->>'size')::numeric BETWEEN 2 AND 50 AND (e->>'opacity')::numeric BETWEEN 0 AND 100 AND e->>'color' ~ '^#[0-9a-fA-F]{6}$' AND e->>'align' IN ('left','center','right'),false) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
 EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

-- Presentation belongs to a team-season membership, never the shared player identity.
CREATE OR REPLACE FUNCTION public.valid_player_photo_layout(v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT v IS NULL OR coalesce(
 jsonb_typeof(v)='object' AND (SELECT count(*) FROM jsonb_object_keys(v-'numberSize'-'profileDesign'))=9
 AND (NOT v ? 'numberSize' OR (jsonb_typeof(v->'numberSize')='number' AND (v->>'numberSize')::numeric BETWEEN 20 AND 80))
 AND (NOT v ? 'profileDesign' OR (v->'profileDesign'<>'null'::jsonb AND public.valid_club_profile_design(v->'profileDesign')))
 AND v->>'background' IN ('blue-left','blue-right','black','nsg-art') AND v->>'source' IN ('original','cutout')
 AND jsonb_typeof(v->'zoom')='number' AND (v->>'zoom')::numeric BETWEEN 50 AND 180
 AND jsonb_typeof(v->'x')='number' AND (v->>'x')::numeric BETWEEN 0 AND 100
 AND jsonb_typeof(v->'y')='number' AND (v->>'y')::numeric BETWEEN 0 AND 100
 AND jsonb_typeof(v->'nameX')='number' AND (v->>'nameX')::numeric BETWEEN 2 AND 65
 AND jsonb_typeof(v->'nameY')='number' AND (v->>'nameY')::numeric BETWEEN 5 AND 85
 AND jsonb_typeof(v->'numberX')='number' AND (v->>'numberX')::numeric BETWEEN 8 AND 92
 AND jsonb_typeof(v->'numberY')='number' AND (v->>'numberY')::numeric BETWEEN 3 AND 85,false)
$$;

NOTIFY pgrst,'reload schema';
