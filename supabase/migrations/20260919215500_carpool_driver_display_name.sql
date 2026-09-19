-- Fahrgemeinschaft: In Angeboten und Nachrichten immer einen erkennbaren
-- Fahrer- bzw. Familiennamen verwenden, auch bei aelteren App-Versionen.

CREATE OR REPLACE FUNCTION public.resolve_event_carpool_driver_name(
  p_user_id uuid,
  p_fallback text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_name text;
  v_person_name text;
  v_fallback text := nullif(btrim(coalesce(p_fallback, '')), '');
BEGIN
  SELECT nullif(btrim(p.last_name), '')
    INTO v_last_name
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_last_name IS NULL THEN
    SELECT nullif(btrim(pl.last_name), '')
      INTO v_last_name
    FROM public.player_guardians pg
    JOIN public.players pl ON pl.id = pg.player_id
    WHERE pg.user_id = p_user_id
      AND nullif(btrim(pl.last_name), '') IS NOT NULL
    ORDER BY pl.id
    LIMIT 1;
  END IF;

  IF v_last_name IS NOT NULL THEN
    RETURN 'Familie ' || v_last_name;
  END IF;

  SELECT coalesce(
      nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
      nullif(btrim(p.full_name), ''),
      nullif(btrim(p.display_name), '')
    )
    INTO v_person_name
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_person_name IS NOT NULL THEN
    RETURN v_person_name;
  END IF;

  IF v_fallback IS NOT NULL AND lower(v_fallback) NOT IN ('familie', 'fahrer') THEN
    RETURN v_fallback;
  END IF;

  RETURN 'Fahrer';
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_event_carpool_driver_name(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_event_carpool_driver_name(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_event_carpool_driver_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF nullif(btrim(NEW.driver_name), '') IS NULL
     OR lower(btrim(NEW.driver_name)) IN ('familie', 'fahrer') THEN
    NEW.driver_name := public.resolve_event_carpool_driver_name(
      NEW.driver_user_id,
      NEW.driver_name
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_carpool_offer_00_driver_name
  ON public.event_carpool_offers;
CREATE TRIGGER trg_event_carpool_offer_00_driver_name
  BEFORE INSERT OR UPDATE OF driver_user_id, driver_name
  ON public.event_carpool_offers
  FOR EACH ROW EXECUTE FUNCTION public.normalize_event_carpool_driver_name();

-- Bestehende generische Angebote ohne zusaetzliche Benachrichtigung reparieren.
ALTER TABLE public.event_carpool_offers
  DISABLE TRIGGER trg_event_carpool_offer_notification;

UPDATE public.event_carpool_offers o
SET driver_name = public.resolve_event_carpool_driver_name(
  o.driver_user_id,
  o.driver_name
)
WHERE lower(btrim(o.driver_name)) IN ('familie', 'fahrer');

ALTER TABLE public.event_carpool_offers
  ENABLE TRIGGER trg_event_carpool_offer_notification;
