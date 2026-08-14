-- DB-GOV.1 / STEP 4 LIVE (DDL only) — Production-safe companion to 20260808170000.
--
-- WICHTIG:
-- - 20260808170000 bleibt unverändert (Staging-Historie / bereits angewendet).
-- - Diese Datei darf NICHT das bereinigende Bulk-UPDATE aus 08170000 enthalten.
-- - Noch NICHT anwenden, bis separat freigegeben (kein db push / kein Live-Deploy hier).
-- - Voraussetzung: höchstens eine active-Saison je team_id (Stand DB-GOV.1: erfüllt).
--
-- Enthalten:
-- - team_seasons.completed_at / completed_by (+ FK)
-- - Partial unique index: eine active Saison pro Team
-- - Hilfsindex (team_id, status)
-- - RPC activate_team_season_exclusive (archiviert nur bei bewusster Aktivierung)
--
-- Nicht enthalten:
-- - pauschales Archivieren bestehender aktiver Saisons

-- Guard: keine stillen Datenänderungen; bei Duplikaten hart abbrechen
DO $$
DECLARE
  v_dup_teams int;
BEGIN
  SELECT count(*)::int INTO v_dup_teams
  FROM (
    SELECT team_id
    FROM public.team_seasons
    WHERE status = 'active'
    GROUP BY team_id
    HAVING count(*) > 1
  ) d;

  IF v_dup_teams > 0 THEN
    RAISE EXCEPTION
      'STEP4_LIVE_ABORT: % team(s) have more than one active season — run approved cleanup first',
      v_dup_teams;
  END IF;
END;
$$;

ALTER TABLE public.team_seasons
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.team_seasons.completed_at IS
  'Zeitpunkt des sportlichen Abschlusses / Archivierung (STEP 4). Historie bleibt erhalten.';
COMMENT ON COLUMN public.team_seasons.prepared_from_team_season_id IS
  'Quell-Saison für Entwurf (STEP 4 source_season).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_seasons_one_active_per_team
  ON public.team_seasons (team_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_team_seasons_team_status
  ON public.team_seasons (team_id, status);

CREATE OR REPLACE FUNCTION public.activate_team_season_exclusive(p_team_season_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_status text;
  v_archived int := 0;
BEGIN
  IF p_team_season_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_id');
  END IF;

  IF NOT public.can_manage_team_season_row(p_team_season_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT team_id, status
  INTO v_team_id, v_status
  FROM public.team_seasons
  WHERE id = p_team_season_id
  FOR UPDATE;

  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_status = 'archived' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'archived_locked');
  END IF;

  -- Nur bei expliziter Aktivierung: andere aktive derselben Mannschaft archivieren
  UPDATE public.team_seasons
  SET
    status = 'archived',
    archived_at = COALESCE(archived_at, now()),
    completed_at = COALESCE(completed_at, now())
  WHERE team_id = v_team_id
    AND id <> p_team_season_id
    AND status = 'active';

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  UPDATE public.team_seasons
  SET
    status = 'active',
    archived_at = NULL
  WHERE id = p_team_season_id;

  RETURN jsonb_build_object(
    'ok', true,
    'team_season_id', p_team_season_id,
    'archived_siblings', v_archived
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_team_season_exclusive(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_team_season_exclusive(uuid) TO authenticated;

COMMENT ON FUNCTION public.activate_team_season_exclusive(uuid) IS
  'STEP 4 LIVE: Aktiviert eine team_season und archiviert andere aktive derselben Mannschaft.';

NOTIFY pgrst, 'reload schema';
