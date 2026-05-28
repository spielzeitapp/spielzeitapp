-- LAZ-Spieler: Eltern dürfen bei Trainings optional Status external_training setzen.
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_laz_player boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.players.is_laz_player IS
  'Wenn true: Eltern können bei Trainings LAZ (external_training) als Teilnahmestatus wählen.';
