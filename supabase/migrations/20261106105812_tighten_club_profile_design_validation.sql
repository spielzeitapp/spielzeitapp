CREATE OR REPLACE FUNCTION public.valid_club_profile_design(v jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; e jsonb;
BEGIN
 IF v IS NULL THEN RETURN true;END IF;
 IF jsonb_typeof(v)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(v))<>4 THEN RETURN false;END IF;
 FOREACH k IN ARRAY ARRAY['name','number','logo','team'] LOOP
 e:=v->k;
 IF e IS NULL OR jsonb_typeof(e)<>'object' OR NOT (e ?& ARRAY['visible','x','y','size','color','opacity','align']) OR (SELECT count(*) FROM jsonb_object_keys(e))<>7 THEN RETURN false;END IF;
 IF jsonb_typeof(e->'visible')<>'boolean' OR jsonb_typeof(e->'x')<>'number' OR jsonb_typeof(e->'y')<>'number' OR jsonb_typeof(e->'size')<>'number' OR jsonb_typeof(e->'opacity')<>'number' THEN RETURN false;END IF;
 IF NOT coalesce((e->>'x')::numeric BETWEEN 0 AND 100 AND (e->>'y')::numeric BETWEEN 0 AND 100 AND (e->>'size')::numeric BETWEEN 2 AND 50 AND (e->>'opacity')::numeric BETWEEN 0 AND 100 AND e->>'color' ~ '^#[0-9a-fA-F]{6}$' AND e->>'align' IN ('left','center','right'),false) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
 EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
