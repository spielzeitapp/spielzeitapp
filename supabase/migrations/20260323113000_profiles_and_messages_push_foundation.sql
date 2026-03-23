-- Home-Personalisierung + Nachrichten/Push-Grundlage

-- profiles erweitern
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS full_name text;

-- messages erweitern
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS body text NULL,
  ADD COLUMN IF NOT EXISTS event_id uuid NULL,
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

-- Event-Referenz (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND constraint_name = 'messages_event_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
  END IF;
END $$;

-- type von harter CHECK lösen (MVP: frei, z. B. event_reminder/system/event)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'messages_type_check'
  ) THEN
    ALTER TABLE public.messages DROP CONSTRAINT messages_type_check;
  END IF;
END $$;

-- Benutzerbezogene Abfrage performant halten
CREATE INDEX IF NOT EXISTS idx_messages_user_created
  ON public.messages (user_id, created_at DESC);

SELECT pg_notify('pgrst', 'reload schema');

