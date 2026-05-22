-- Training: Status „verletzt“ (injured) zusätzlich zu yes/no/maybe.
-- Bestehende yes/no bleiben; fehlende Zeile = offen (App-Logik).

ALTER TABLE public.event_attendance
  DROP CONSTRAINT IF EXISTS event_attendance_status_check;

ALTER TABLE public.event_attendance
  ADD CONSTRAINT event_attendance_status_check
  CHECK (status IN ('yes', 'no', 'maybe', 'injured'));

COMMENT ON COLUMN public.event_attendance.status IS
  'yes=dabei/present, no=abwesend/absent, injured=verletzt (Training), maybe=offen (Legacy). Fehlende Zeile=offen.';

SELECT pg_notify('pgrst', 'reload schema');
