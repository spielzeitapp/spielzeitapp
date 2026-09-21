-- Repariert alte Fahrangebote, deren sichtbarer Familienname und gespeicherter
-- Besitzer durch die fruehere Trainerfunktion auseinandergeraten sind.
-- Eine Umschreibung erfolgt nur, wenn im Team genau ein passendes Elternkonto
-- mit demselben Nachnamen existiert.

ALTER TABLE public.event_carpool_offers
  DISABLE TRIGGER trg_event_carpool_offer_notification;

WITH mismatched_offers AS (
  SELECT
    o.id,
    e.team_season_id,
    lower(btrim(regexp_replace(o.driver_name, '^Familie\s+', '', 'i'))) AS family_name
  FROM public.event_carpool_offers o
  JOIN public.events e ON e.id = o.event_id
  LEFT JOIN public.profiles owner_profile ON owner_profile.id = o.driver_user_id
  WHERE o.driver_name ~* '^Familie\s+'
    AND lower(btrim(coalesce(owner_profile.last_name, ''))) IS DISTINCT FROM
        lower(btrim(regexp_replace(o.driver_name, '^Familie\s+', '', 'i')))
),
owner_candidates AS (
  SELECT DISTINCT
    mismatch.id AS offer_id,
    profile.id AS user_id
  FROM mismatched_offers mismatch
  JOIN public.profiles profile
    ON lower(btrim(coalesce(profile.last_name, ''))) = mismatch.family_name
  WHERE EXISTS (
      SELECT 1
      FROM public.memberships membership
      WHERE membership.user_id = profile.id
        AND membership.team_season_id = mismatch.team_season_id
    )
  UNION
  SELECT DISTINCT
    mismatch.id AS offer_id,
    guardian.user_id
  FROM mismatched_offers mismatch
  JOIN public.player_guardians guardian
    ON public.player_in_team_season(guardian.player_id, mismatch.team_season_id)
  JOIN public.players player ON player.id = guardian.player_id
  WHERE lower(btrim(coalesce(player.last_name, ''))) = mismatch.family_name
),
unique_candidates AS (
  SELECT offer_id, min(user_id::text)::uuid AS user_id
  FROM owner_candidates
  GROUP BY offer_id
  HAVING count(*) = 1
)
UPDATE public.event_carpool_offers offer
SET driver_user_id = candidate.user_id
FROM unique_candidates candidate
WHERE offer.id = candidate.offer_id
  AND offer.driver_user_id IS DISTINCT FROM candidate.user_id;

ALTER TABLE public.event_carpool_offers
  ENABLE TRIGGER trg_event_carpool_offer_notification;

-- Neue Angebote erhalten den Familiennamen immer aus dem eingeloggten Konto.
-- Dadurch kann eine fremde Bezeichnung nie wieder mit der eigenen Benutzer-ID
-- gespeichert werden.
CREATE OR REPLACE FUNCTION public.normalize_event_carpool_driver_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.driver_name := public.resolve_event_carpool_driver_name(
    NEW.driver_user_id,
    NEW.driver_name
  );
  RETURN NEW;
END;
$$;
