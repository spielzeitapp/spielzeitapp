-- Turnierabschluss: Archivstatus auf events.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tournament_completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS tournament_completed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tournament_final_placement integer NULL,
  ADD COLUMN IF NOT EXISTS tournament_final_teams_count integer NULL,
  ADD COLUMN IF NOT EXISTS tournament_final_label text NULL;

COMMENT ON COLUMN public.events.tournament_completed_at IS
  'Zeitpunkt des aktiven Turnierabschlusses durch Trainer.';
COMMENT ON COLUMN public.events.tournament_final_placement IS
  'Gespeicherte Endplatzierung (Rang) beim Abschließen.';
COMMENT ON COLUMN public.events.tournament_final_teams_count IS
  'Gespeicherte Teamanzahl beim Abschließen.';
COMMENT ON COLUMN public.events.tournament_final_label IS
  'Gespeichertes Platzierungslabel beim Abschließen.';

SELECT pg_notify('pgrst', 'reload schema');
