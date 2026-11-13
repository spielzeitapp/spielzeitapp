# First hall training pairing

Choose any ordered pair before the first kickoff, in Teams or the first pending match. A bijection remaps all schedule slots, preserving rosters, team colors/names and individual game durations; full round-robin counts remain equal. Existing JSON schema and authorization are unchanged. Selection auto-saves; unsaved teams/configuration, loading, read-only and in-progress games disable it.

Passed pure tests of every first pairing for 3/4 teams, immutable input, unchanged duration and complete pair counts; UI choose/save/start and hidden control after kickoff; production build. Synthetic swapped-schedule SQL rollback suite passed on staging and LIVE with staff, outsider, parent, anonymous Auth, anon, stale revision and invalid states. No user fixtures changed. Physical device layout not verified.
