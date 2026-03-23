-- MVP Nachrichten-Center („messages“)
-- In-App Nachrichten-Historie (Home + /app/nachrichten).

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('info', 'reminder', 'change')),
  related_event_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_team_created
  ON public.messages (team_id, created_at DESC);

-- Dedupe für Reminder: pro Team/Event/Typ max. 1 Nachricht.
-- (Für null related_event_id sind mehrere Nachrichten möglich.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_team_event_type_unique
  ON public.messages (team_id, related_event_id, type);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Lesen: eingeloggte Nutzer mit Membership in einer team_season dieser Mannschaft
DROP POLICY IF EXISTS "messages_select_team_members" ON public.messages;
CREATE POLICY "messages_select_team_members"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships m
      INNER JOIN public.team_seasons ts ON ts.id = m.team_season_id
      WHERE m.user_id = auth.uid()
        AND ts.team_id = messages.team_id
    )
  );

-- Hinweis: Inserts/Updates passieren über Service Role (Vercel / Server-Code) → RLS-Inserts nicht benötigt.

SELECT pg_notify('pgrst', 'reload schema');

