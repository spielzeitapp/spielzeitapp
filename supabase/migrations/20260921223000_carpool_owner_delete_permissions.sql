-- Fahrgemeinschaften bleiben im Besitz der beteiligten Familien.
-- Trainer- und Adminrechte duerfen keine fremden Fahrten oder Mitfahrten
-- bearbeiten bzw. loeschen.

DROP POLICY IF EXISTS event_carpool_offers_update_own
  ON public.event_carpool_offers;
CREATE POLICY event_carpool_offers_update_own
  ON public.event_carpool_offers FOR UPDATE TO authenticated
  USING (driver_user_id = auth.uid())
  WITH CHECK (driver_user_id = auth.uid());

DROP POLICY IF EXISTS event_carpool_offers_delete_own
  ON public.event_carpool_offers;
CREATE POLICY event_carpool_offers_delete_own
  ON public.event_carpool_offers FOR DELETE TO authenticated
  USING (driver_user_id = auth.uid());

DROP POLICY IF EXISTS event_carpool_reservations_delete_own_player
  ON public.event_carpool_reservations;
CREATE POLICY event_carpool_reservations_delete_own_player
  ON public.event_carpool_reservations FOR DELETE TO authenticated
  USING (
    reserved_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = event_carpool_reservations.player_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.player_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_carpool_reservations.player_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_carpool_offers o
      WHERE o.id = event_carpool_reservations.offer_id
        AND o.driver_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS event_carpool_requests_delete_own_player
  ON public.event_carpool_requests;
CREATE POLICY event_carpool_requests_delete_own_player
  ON public.event_carpool_requests FOR DELETE TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.player_guardians pg
      WHERE pg.user_id = auth.uid()
        AND pg.player_id = event_carpool_requests.player_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.player_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.player_id = event_carpool_requests.player_id
    )
  );
