-- Stellt sicher, dass Live-Events das Feld `period` im DB-Schema haben.
-- Fix für Fehler: "Could not find the 'period' column of 'match_events' in the schema cache"

ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS period int;

