-- Trainer koennen die beiden persoenlichen Kadernachrichten vor dem Versand anpassen.
-- Die bestehende Ein-Parameter-Funktion bleibt als kompatibler Kern bestehen.

CREATE OR REPLACE FUNCTION public.publish_match_squad(
  p_match_id uuid,
  p_selected_message text,
  p_not_selected_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_version integer;
  v_selected_message text;
  v_not_selected_message text;
BEGIN
  v_result := public.publish_match_squad(p_match_id);

  IF coalesce((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  v_version := coalesce((v_result ->> 'version')::integer, 1);
  v_selected_message := nullif(left(btrim(p_selected_message), 500), '');
  v_not_selected_message := nullif(left(btrim(p_not_selected_message), 500), '');

  IF v_selected_message IS NOT NULL THEN
    UPDATE public.notification_jobs
    SET payload = jsonb_set(payload, '{pushBody}', to_jsonb(v_selected_message), true)
    WHERE dedupe_key = 'squad-selected:' || p_match_id::text || ':v' || v_version::text
      AND status = 'pending';
  END IF;

  IF v_not_selected_message IS NOT NULL THEN
    UPDATE public.notification_jobs
    SET payload = jsonb_set(payload, '{pushBody}', to_jsonb(v_not_selected_message), true)
    WHERE dedupe_key = 'squad-not-selected:' || p_match_id::text || ':v' || v_version::text
      AND status = 'pending';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_match_squad(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_match_squad(uuid, text, text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
