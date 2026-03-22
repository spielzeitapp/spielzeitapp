-- In-App Nachrichten-Center (manueller Team-Push + später auto)
-- team_id verknüpft mit public.teams (falls vorhanden); sonst nur uuid ohne FK.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text NULL,
  type text NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'auto')),
  event_type text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_team_created
  ON public.notifications (team_id, created_at DESC);

COMMENT ON TABLE public.notifications IS 'Anzeige im Bereich „Nachrichten“; manuelle Einträge aus Team-Push (Service Role).';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Lesen: eingeloggte Nutzer mit Membership in einer team_season dieser Mannschaft
DROP POLICY IF EXISTS "notifications_select_team_members" ON public.notifications;
CREATE POLICY "notifications_select_team_members"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.memberships m
      INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
      WHERE m.user_id = auth.uid()
        AND ts.team_id = notifications.team_id
    )
  );

-- Schreiben nur Service Role / Backend (keine direkten Client-Inserts)
-- Inserts erfolgen über Vercel api/push/send-team mit SUPABASE_SERVICE_ROLE_KEY
