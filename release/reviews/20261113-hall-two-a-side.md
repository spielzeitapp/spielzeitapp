# Two-a-side hall training

Adds format 2 for three/four teams. Existing schedule calculation, game durations, RLS, grants and invoker authorization remain unchanged.

Verified: pure schedule/readiness tests (six/eight players), UI select/distribute/save/start with six players; production build. Synthetic SQL rollback tests passed on staging and LIVE under authenticated staff, outsider, parent, anonymous session and anon roles; invalid formats, duplicate/foreign players, stale revisions and archived writes rejected. Existing three-a-side SQL suite passed on staging. No real events changed.

Migration blob: a228773538b1a133383d3cb4e7fa9d61a24aa795. Applied staging then LIVE; actual migration history versions aligned to CLI filename. Staging also retains an initial SELECT 1 no-op migration record at 20261113160932; actual validator migration is 20261113160743 (name hall_training_two_a_side_validation). No history SQL was rewritten.

Physical iPhone audio/layout not tested in this change.
