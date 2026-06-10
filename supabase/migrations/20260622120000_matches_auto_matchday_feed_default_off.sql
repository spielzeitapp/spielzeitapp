-- Automatischer Spieltag-Post: Standard für NEUE Spiele AUS.
-- Bestehende Spiele behalten ihren aktuellen Wert (kein Update, nur Spalten-Default).
-- Aufstellung, Live-Updates, Ergebnis, Match-Vorbereitung und Live-Ticker sind unabhängig.

ALTER TABLE public.matches
  ALTER COLUMN auto_matchday_feed_enabled SET DEFAULT false;

COMMENT ON COLUMN public.matches.auto_matchday_feed_enabled IS
  'true = automatischer Spieltag-Post im Feed + Spieltag-Hero auf Home. Standard: false (Opt-in pro Spiel). Lineup/Live/Ergebnis bleiben unabhängig.';

SELECT pg_notify('pgrst', 'reload schema');
