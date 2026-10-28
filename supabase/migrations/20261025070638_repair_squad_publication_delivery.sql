-- Preserve the default enabled state when optional event settings do not exist.
-- Existing function body and privileges remain unchanged except for this predicate.
DO $repair$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.publish_match_squad(uuid,text,text)'::regprocedure) INTO definition;
  IF definition LIKE '%IF v_feed_enabled IS NOT TRUE THEN%' THEN
    EXECUTE replace(definition, 'IF v_feed_enabled IS NOT TRUE THEN', 'IF v_feed_enabled IS FALSE THEN');
  ELSIF definition NOT LIKE '%IF v_feed_enabled IS FALSE THEN%' THEN
    RAISE EXCEPTION 'Unexpected squad publication implementation';
  END IF;
END;
$repair$;
SELECT pg_notify('pgrst', 'reload schema');
