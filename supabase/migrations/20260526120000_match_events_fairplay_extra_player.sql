-- U11 FairPlay: Zusatzspieler am Feld (kein normaler Wechsel) — eigene Ereignistypen.

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
      'position_swap',
      'extra_player_on',
      'extra_player_off'
    )
  );

COMMENT ON CONSTRAINT match_events_type_check ON public.match_events IS
  'Inkl. FairPlay extra_player_on / extra_player_off (U11, nur eigene Mannschaft).';

SELECT pg_notify('pgrst', 'reload schema');
