-- Retain explicit confirmations made before club-wide progress was introduced.
-- Use the most recent explicit club decision, including a later reset to open.
INSERT INTO public.manager_club_setup_progress(club_id,reviewed_signature,updated_at,updated_by)
SELECT d.club_id, public.manager_club_setup_signature(c), d.updated_at, d.updated_by
FROM (
  SELECT DISTINCT ON (t.club_id) t.club_id,p.checks->>'club' AS decision,p.updated_at,p.updated_by
  FROM public.manager_setup_progress p
  JOIN public.team_seasons ts ON ts.id=p.team_season_id
  JOIN public.teams t ON t.id=ts.team_id
  WHERE p.checks ? 'club'
  ORDER BY t.club_id,p.updated_at DESC,p.team_season_id
) d JOIN public.clubs c ON c.id=d.club_id
WHERE d.decision='reviewed' AND c.status='active' AND nullif(btrim(c.name),'') IS NOT NULL
  AND nullif(btrim(c.logo_url),'') IS NOT NULL
ON CONFLICT(club_id) DO NOTHING;
