-- match_events.type: CHECK so erweitern, dass alle in der App genutzten Typen erlaubt sind.
-- Live/Spielbericht nutzt u.a. goal, goal_away, sub_out/sub_in, kickoff, final_whistle, period_*.
-- Zusätzlich Aliase (substitution_*, match_*) und Legacy goal_home für bestehende Zeilen.

ALTER TABLE public.match_events
  DROP CONSTRAINT IF EXISTS match_events_type_check;

ALTER TABLE public.match_events
  ADD CONSTRAINT match_events_type_check CHECK (
    type IN (
      -- Tore (Stadion)
      'goal',
      'goal_away',
      'goal_home',
      -- Wechsel (App-IDs)
      'sub_out',
      'sub_in',
      -- Wechsel (Alias)
      'substitution_out',
      'substitution_in',
      -- Spielphasen (persistiert / Liveticker)
      'kickoff',
      'final_whistle',
      'period_start',
      'period_end',
      'match_start',
      'match_pause',
      'match_resume',
      'match_end',
      -- Engine-Mapping kann theoretisch durchgereicht werden
      'start',
      'pause',
      'resume',
      'end',
      -- Karten
      'yellow_card',
      'red_card',
      'card_yellow',
      'card_red',
      'yellow',
      'red',
      'card'
    )
  );
