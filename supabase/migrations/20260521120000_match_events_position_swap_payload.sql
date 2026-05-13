-- Positionswechsel am Feld: Typ `position_swap` + optionales JSON `payload` (z. B. zweiter Spieler).

ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS payload jsonb;

ALTER TABLE public.match_events
  DROP CONSTRAINT IF EXISTS match_events_type_check;

ALTER TABLE public.match_events
  ADD CONSTRAINT match_events_type_check CHECK (
    type IN (
      'goal',
      'goal_away',
      'goal_home',
      'sub_out',
      'sub_in',
      'substitution_out',
      'substitution_in',
      'kickoff',
      'final_whistle',
      'period_start',
      'period_end',
      'match_start',
      'match_pause',
      'match_resume',
      'match_end',
      'start',
      'pause',
      'resume',
      'end',
      'yellow_card',
      'red_card',
      'card_yellow',
      'card_red',
      'yellow',
      'red',
      'card',
      'position_swap'
    )
  );

COMMENT ON COLUMN public.match_events.payload IS 'Optional JSON, z. B. position_swap: { "swap_player_id": "<uuid>" }.';

SELECT pg_notify('pgrst', 'reload schema');
