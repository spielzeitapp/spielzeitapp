-- Training: externes Training / LAZ (nicht als Abwesend werten).

ALTER TABLE public.event_attendance
  DROP CONSTRAINT IF EXISTS event_attendance_status_check;

ALTER TABLE public.event_attendance
  ADD CONSTRAINT event_attendance_status_check
  CHECK (status IN ('yes', 'no', 'maybe', 'injured', 'external_training'));

COMMENT ON COLUMN public.event_attendance.status IS
  'yes=dabei, no=abwesend, injured=verletzt, external_training=LAZ/extern, maybe=legacy. Fehlende Zeile: offen (zukünftig) bzw. nicht erfasst (vergangen).';

SELECT pg_notify('pgrst', 'reload schema');
