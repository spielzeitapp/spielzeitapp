# Training at another team
Migration blob d291f66cb1945c3e7c8f9d32b28f63480a87bf7c.
Trainer choice and parent self-response accept a team/note (e.g. U13).
New status other_team_training is distinct from LAZ. Own-team attendance excludes it; activity includes it once per event/player primary key. Existing seasonal totals remain scoped to their team; this does not link a second team's separate event.
All existing RLS and table grants preserved; new invoker trigger restricts the status to training and requires a team note. Team participation RPC counts it outside the own-team session, retaining existing auth check and execution grants.
Synthetic SQL tests run successfully on staging and LIVE with rollback: trainer write/read/update/reset, parent update of own child, required note, correct 8/9 own-team quote, outsider read/write rejection. No synthetic fixtures persist.
Hosted API migration versions reconciled to CLI-created file version 20261113104103; no SQL changes.
UI tests cover explicit choice, required team field, cancellation without saving, existing LAZ eligibility and all other absence reasons. Domain checks confirm distinct counts, credited activity and hall roster exclusion.
Build passes. Full-repository typecheck has pre-existing unrelated errors; no claim of a clean global typecheck. Physical phone layout not checked.
Security advisors found no finding for the new function. No secret keys or new public access.
