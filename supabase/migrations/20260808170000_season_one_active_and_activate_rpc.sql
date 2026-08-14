-- STEP 4 Manager: Saisonverwaltung absichern (eine aktive Saison pro Team).
-- Additive only. Keine Löschung historischer Daten.
-- Ziel: Staging acbaecjzoabafbsjrzvr — NICHT Production shxugattqatahckhspwk.

-- ---------------------------------------------------------------------------
-- Abschluss-Metadaten (optional, für Archiv/Abschluss nachvollziehbar)
-- ---------------------------------------------------------------------------

ALTER TABLE public.team_seasons
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.team_seasons.completed_at IS
  'Zeitpunkt des sportlichen Abschlusses / Archivierung (STEP 4). Historie bleibt erhalten.';
COMMENT ON COLUMN public.team_seasons.prepared_from_team_season_id IS
  'Quell-Saison für Entwurf (STEP 4 source_season).';

-- Falls mehrere aktive Saisons existieren: älteste behalten, Rest archivieren
WITH ranked AS (
  SELECT
    id,
    team_id,
    ROW_NUMBER() OVER (
      PARTITION BY team_id
      ORDER BY created_at DESC NULLS LAST, id
    ) AS rn
  FROM public.team_seasons
  WHERE status = 'active'
)
UPDATE public.team_seasons ts
SET
  status = 'archived',
  archived_at = COALESCE(ts.archived_at, now()),
  completed_at = COALESCE(ts.completed_at, now())
FROM ranked r
WHERE ts.id = r.id
  AND r.rn > 1;

-- Höchstens eine aktive Saison pro Mannschaft
DROP INDEX IF EXISTS public.idx_team_seasons_one_active_per_team;
CREATE UNIQUE INDEX idx_team_seasons_one_active_per_team
  ON public.team_seasons (team_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_team_seasons_team_status
  ON public.team_seasons (team_id, status);

-- ---------------------------------------------------------------------------
-- Atomare Aktivierung: neue Saison aktiv, bisherige aktive derselben Mannschaft archivieren
-- ---------------------------------------------------------------------------

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
  'STEP 4: Aktiviert eine team_season und archiviert andere aktive derselben Mannschaft.';

NOTIFY pgrst, 'reload schema';
