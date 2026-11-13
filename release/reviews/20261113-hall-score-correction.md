# Finished hall score corrections

Completed fixtures offer Ergebnis korrigieren. Staff can add goals via the existing scorer/own-goal picker or remove specific goals after confirmation. Scores, standings and scorers derive from the same goal list; finished status and other games are preserved. Retrospectively added goals use timeUnknown metadata and show a dash instead of inventing a goal time. No schema/RLS changes.

Passed hall UI test: finish, add named goal, cancel/remove selected goal, retain other goal and next game state. Existing hall logic tests and production build pass. Synthetic SQL rollback suite passed staging and LIVE, including additions/removal in finished game while another game runs, preserving runningSince and status, stale revision and outsider/parent/anonymous/archive denials. No actual matches modified; physical device layout not verified.
