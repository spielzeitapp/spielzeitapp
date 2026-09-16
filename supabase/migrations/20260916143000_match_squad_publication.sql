-- Matchkader: Trainer speichern zunaechst einen Entwurf und veroeffentlichen ihn bewusst.
-- Die Veroeffentlichung erzeugt einen Feedpost sowie persoenliche Push-/Inbox-Jobs.

CREATE TABLE IF NOT EXISTS public.match_squad_publications (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_season_id uuid NOT NULL REFERENCES public.team_seasons(id) ON DELETE CASCADE,
  selected_player_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_squad_publications_season
  ON public.match_squad_publications (team_season_id, published_at DESC);

ALTER TABLE public.match_squad_publications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.match_squad_publications TO authenticated;

DROP POLICY IF EXISTS match_squad_publications_select_members
  ON public.match_squad_publications;
CREATE POLICY match_squad_publications_select_members
  ON public.match_squad_publications
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships ms
      WHERE ms.team_season_id = match_squad_publications.team_season_id
        AND ms.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.publish_match_squad(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_match record;
  v_event record;
  v_team_id uuid;
  v_team_name text;
  v_selected uuid[] := ARRAY[]::uuid[];
  v_roster uuid[] := ARRAY[]::uuid[];
  v_not_selected uuid[] := ARRAY[]::uuid[];
  v_selected_users uuid[] := ARRAY[]::uuid[];
  v_not_selected_users uuid[] := ARRAY[]::uuid[];
  v_players jsonb := '[]'::jsonb;
  v_version integer := 1;
  v_opponent text;
  v_link text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT m.id, m.team_season_id, m.opponent, m.status
  INTO v_match
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'match_not_found');
  END IF;

  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships ms
      WHERE ms.team_season_id = v_match.team_season_id
        AND ms.user_id = v_uid
        AND lower(ms.role::text) IN ('trainer', 'co_trainer', 'head_coach', 'admin')
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT e.id, e.starts_at, e.is_home
  INTO v_event
  FROM public.events e
  WHERE e.match_id = p_match_id
  ORDER BY e.starts_at ASC
  LIMIT 1;

  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  SELECT ts.team_id, t.name
  INTO v_team_id, v_team_name
  FROM public.team_seasons ts
  JOIN public.teams t ON t.id = ts.team_id
  WHERE ts.id = v_match.team_season_id;

  SELECT coalesce(array_agg(DISTINCT q.player_id), ARRAY[]::uuid[])
  INTO v_selected
  FROM (
    SELECT ml.player_id FROM public.match_lineup ml
    WHERE ml.match_id = p_match_id AND ml.player_id IS NOT NULL
    UNION
    SELECT mb.player_id FROM public.match_bench mb
    WHERE mb.match_id = p_match_id AND mb.player_id IS NOT NULL
  ) q;

  IF coalesce(array_length(v_selected, 1), 0) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_squad');
  END IF;

  -- Saisonkader: neue Join-Tabelle bevorzugen, Legacy players.team_season_id als Fallback.
  SELECT coalesce(array_agg(DISTINCT q.player_id), ARRAY[]::uuid[])
  INTO v_roster
  FROM (
    SELECT tsp.player_id
    FROM public.team_season_players tsp
    WHERE tsp.team_season_id = v_match.team_season_id
      AND coalesce(tsp.is_active, true)
    UNION
    SELECT p.id
    FROM public.players p
    WHERE p.team_season_id = v_match.team_season_id
      AND coalesce(p.is_active, true)
  ) q;

  SELECT coalesce(array_agg(pid), ARRAY[]::uuid[])
  INTO v_not_selected
  FROM unnest(v_roster) pid
  WHERE NOT (pid = ANY(v_selected));

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'player_id', p.id,
      'name', coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Spieler'),
      'jersey_number', coalesce(tsp.jersey_number, p.jersey_number)
    ) ORDER BY coalesce(tsp.jersey_number, p.jersey_number, 999), p.last_name, p.first_name
  ), '[]'::jsonb)
  INTO v_players
  FROM public.players p
  LEFT JOIN public.team_season_players tsp
    ON tsp.player_id = p.id AND tsp.team_season_id = v_match.team_season_id
  WHERE p.id = ANY(v_selected);

  INSERT INTO public.match_squad_publications (
    match_id, event_id, team_season_id, selected_player_ids,
    version, published_at, published_by, updated_at
  ) VALUES (
    p_match_id, v_event.id, v_match.team_season_id, v_selected,
    1, now(), v_uid, now()
  )
  ON CONFLICT (match_id) DO UPDATE SET
    event_id = EXCLUDED.event_id,
    selected_player_ids = EXCLUDED.selected_player_ids,
    version = match_squad_publications.version + 1,
    published_at = now(),
    published_by = v_uid,
    updated_at = now()
  RETURNING version INTO v_version;

  v_opponent := coalesce(nullif(btrim(v_match.opponent), ''), 'den Gegner');
  v_link := '/app/events/' || v_event.id::text;

  INSERT INTO public.team_feed_posts (
    team_season_id, team_id, event_id, post_kind, caption, payload,
    dedupe_key, media_type, media_url, thumbnail_url, duration_seconds, created_by
  ) VALUES (
    v_match.team_season_id,
    v_team_id,
    v_event.id,
    'squad_published',
    'Unser Kader für das Spiel gegen ' || v_opponent || ' steht fest.',
    jsonb_build_object(
      'match_id', p_match_id,
      'event_id', v_event.id,
      'team_season_id', v_match.team_season_id,
      'our_team_name', coalesce(nullif(btrim(v_team_name), ''), 'Unser Team'),
      'opponent_name', v_opponent,
      'is_home', v_event.is_home,
      'starts_at', v_event.starts_at,
      'deep_link', v_link,
      'players', v_players,
      'version', v_version
    ),
    'squad_feed:' || p_match_id::text,
    'squad',
    NULL,
    NULL,
    NULL,
    v_uid
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    caption = EXCLUDED.caption,
    payload = EXCLUDED.payload,
    updated_at = now(),
    created_by = v_uid;

  SELECT coalesce(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
  INTO v_selected_users
  FROM (
    SELECT pg.user_id FROM public.player_guardians pg WHERE pg.player_id = ANY(v_selected)
    UNION
    SELECT pu.user_id FROM public.player_users pu WHERE pu.player_id = ANY(v_selected)
  ) recipients;

  SELECT coalesce(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
  INTO v_not_selected_users
  FROM (
    SELECT pg.user_id FROM public.player_guardians pg WHERE pg.player_id = ANY(v_not_selected)
    UNION
    SELECT pu.user_id FROM public.player_users pu WHERE pu.player_id = ANY(v_not_selected)
  ) recipients
  WHERE NOT (user_id = ANY(v_selected_users));

  IF coalesce(array_length(v_selected_users, 1), 0) > 0 THEN
    INSERT INTO public.notification_jobs (
      event_id, team_id, kind, send_at, payload, status, dedupe_key
    ) VALUES (
      v_event.id, v_team_id, 'match', now(),
      jsonb_build_object(
        'automation', 'squad',
        'pushTitle', 'Du bist im Kader',
        'pushBody', 'Der Kader für das Spiel gegen ' || v_opponent || ' wurde veröffentlicht. Du bist dabei!',
        'linkPath', v_link,
        'recipientUserIds', to_jsonb(v_selected_users)
      ),
      'pending',
      'squad-selected:' || p_match_id::text || ':v' || v_version::text
    );
  END IF;

  IF coalesce(array_length(v_not_selected_users, 1), 0) > 0 THEN
    INSERT INTO public.notification_jobs (
      event_id, team_id, kind, send_at, payload, status, dedupe_key
    ) VALUES (
      v_event.id, v_team_id, 'match', now(),
      jsonb_build_object(
        'automation', 'squad',
        'pushTitle', 'Kader veröffentlicht',
        'pushBody', 'Für das Spiel gegen ' || v_opponent || ' bist du diesmal nicht im Kader.',
        'linkPath', v_link,
        'recipientUserIds', to_jsonb(v_not_selected_users)
      ),
      'pending',
      'squad-not-selected:' || p_match_id::text || ':v' || v_version::text
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'version', v_version,
    'published_at', now(),
    'selected_count', coalesce(array_length(v_selected, 1), 0),
    'not_selected_count', coalesce(array_length(v_not_selected, 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_match_squad(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_match_squad(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
