-- Optional: Nur ausführen, wenn public.events BEREITS existiert mit abweichenden Spaltennamen
-- und Sie Daten erhalten wollen. Renames nur, wenn Quelle existiert und Ziel nicht.
-- Ansonsten 20260227100000_events_fix_and_reload_schema.sql verwenden (DROP + CREATE).

DO $$
BEGIN
  -- ist_zuhause -> is_home
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'ist_zuhause')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'is_home') THEN
    ALTER TABLE public.events RENAME COLUMN ist_zuhause TO is_home;
  END IF;
  -- Standort -> location (Postgres speichert unquoted als lowercase: standort)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'standort')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'location') THEN
    ALTER TABLE public.events RENAME COLUMN standort TO location;
  END IF;
  -- beginnt_bei -> starts_at
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'beginnt_bei')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'starts_at') THEN
    ALTER TABLE public.events RENAME COLUMN beginnt_bei TO starts_at;
  END IF;
  -- meetup_at -> meeting_at
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'meetup_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'meeting_at') THEN
    ALTER TABLE public.events RENAME COLUMN meetup_at TO meeting_at;
  END IF;
  -- Teilnahmemodus -> attendance_mode (lowercase: teilnahmemodus)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'teilnahmemodus')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'attendance_mode') THEN
    ALTER TABLE public.events RENAME COLUMN teilnahmemodus TO attendance_mode;
  END IF;
  -- typ -> type (Vorsicht: "type" ist reserviert, aber als Spaltenname erlaubt)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'typ')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'type') THEN
    ALTER TABLE public.events RENAME COLUMN typ TO type;
  END IF;
  -- gegner -> opponent
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'gegner')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'opponent') THEN
    ALTER TABLE public.events RENAME COLUMN gegner TO opponent;
  END IF;
  -- art -> kind
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'art')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'kind') THEN
    ALTER TABLE public.events RENAME COLUMN art TO kind;
  END IF;
  -- notizen -> notes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'notizen')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'notes') THEN
    ALTER TABLE public.events RENAME COLUMN notizen TO notes;
  END IF;
END $$;

-- Fehlende Spalten ergänzen (ADD COLUMN IF NOT EXISTS)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS kind text NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS type text NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS opponent text NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_home boolean NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location text NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS starts_at timestamptz NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS meeting_at timestamptz NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status text NULL DEFAULT 'upcoming';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS attendance_mode text NULL DEFAULT 'opt_in';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS notes text NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS match_id uuid NULL REFERENCES public.matches(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_by uuid NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_at timestamptz NULL DEFAULT now();
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL DEFAULT now();

-- Constraints setzen, falls noch nicht (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_type_check') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_type_check CHECK (type IN ('match', 'training', 'event'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_status_check') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_status_check CHECK (status IN ('upcoming', 'live', 'finished', 'canceled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_attendance_mode_check') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_attendance_mode_check CHECK (attendance_mode IN ('opt_in', 'opt_out'));
  END IF;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
