-- Presentation belongs to a team-season membership, never the shared player identity.
CREATE OR REPLACE FUNCTION public.valid_player_photo_layout(v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT v IS NULL OR coalesce(
 jsonb_typeof(v)='object' AND (SELECT count(*) FROM jsonb_object_keys(v-'numberSize'))=9
 AND (NOT v ? 'numberSize' OR (jsonb_typeof(v->'numberSize')='number' AND (v->>'numberSize')::numeric BETWEEN 20 AND 80))
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
