-- Optionale Absagefrist pro Training + Grund bei Absage in event_attendance

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS training_absence_deadline_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.training_absence_deadline_disabled IS
  'true = keine Frist; false = Absage bis 12:00 Uhr (Europe/Vienna) am Trainingstag';

ALTER TABLE public.event_attendance
  ADD COLUMN IF NOT EXISTS reason text NULL;

COMMENT ON COLUMN public.event_attendance.reason IS 'Optionaler Absagegrund (Training)';
