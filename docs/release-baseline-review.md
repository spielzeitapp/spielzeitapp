# Initial Manager publication: reviewed preparation

Prepared on 2026-11-04. This preparation has not published the TEST application, applied SQL to LIVE, deployed its changed Edge Function, or copied TEST content.

## Reconciliation and package validation

All 117 previous source conflicts were reconciled in a real merge (PR #135). Released LIVE fixes and the intended TEST Manager, ÖFB, branding and authorization features are retained. The per-file decisions are recorded in `release-baseline-resolution.json`. Three completed TEST setup installers were verified and archived in PR #136.

The current TEST feature set also includes explicit ÖFB name adoption and local photo background removal. Its malformed package lockfile was restored from the newest valid previous lock and regenerated for the current package manifest. A clean `npm ci --ignore-scripts` succeeds, retaining the MediaPipe dependency.

## Database adoption without replay

LIVE schema/history are readable again. Read-only inspection captured 128 migration history entries and an empty local schema reconstruction with 115 tables, 255 functions, 375 defaults and 527 constraints. No LIVE business rows were copied.

`release/legacy-baseline.json` adopts 150 historical source files that already existed on the previous LIVE branch but whose versions were not in LIVE history. Their exact Git blobs are frozen. Adoption means **do not replay them**, not “these versions ran”; no history entries are manufactured. A changed historical file still blocks publication. The worker fetches this baseline from the pinned MAIN commit, never from the candidate.

There are also 24 exact SQL matches to recorded LIVE changes under different names/versions. The evidence and rehearsal limits are in `release-initial-preflight-2026-11-04.json`.

Three candidate-only SQL files are archived outside the executable migration folder:

- `20260818140000` and `20260818140100`: excluded legacy admin-role changes. The worker explicitly rejects those versions if reintroduced.
- `20260929100000`: LIVE already has the same schema/functions as `20261012203512`, deliberately excluding the hardcoded TEST U13 assignment. That TEST seed must never run in LIVE.

The remaining 34 pending SQL files are reviewed by exact Git blob in `release/live-plan.json`. Their top-level statements perform DDL, permission changes, schema reload notifications, or a checked function-definition adjustment. They do not bulk-copy or update players, events, team assignments or other TEST content.

## Verified publication sequence

1. Recheck the exact TEST/main commit, successful deployment checks, complete file diff and approval digest.
2. Load the trusted MAIN baseline. Reject unknown SQL, changed frozen blobs, excluded versions and duplicate pending versions.
3. Commit the 34 reviewed SQL files and their exact source/history records in one transaction, with a short lock timeout. Failure stops publication. A retry checks recorded SQL content before skipping a committed version.
4. Deploy only the exact approved `generate-club-communications/index.ts`. Retain JWT validation and verify the active function/version before code promotion.
5. Recheck the pinned source and fast-forward main without force. Confirm the exact public LIVE SHA.
6. Configure and verify the LIVE technical ÖFB scheduler connection using the literal LIVE origin. This copies no TEST tasks, source settings or team preferences; automatic sync remains off for teams until configured in LIVE.

Changes to the trusted workflow, publisher helpers or baseline must be installed separately on main before the prepared TEST version is eligible. The bootstrap contains no TEST feature code or SQL execution.

## Validation and limits

- Clean dependency installation, configured typecheck, production Vite build, and 24 release/serverless guard tests pass.
- All 34 SQL files load against the local reconstruction of the LIVE schema.
- Synthetic RPC checks pass for team setup, existing-player linking and explicit name correction without duplicates, duration, photo layout, setup checks, admin communication access, archival retaining player identity, and denial of unprivileged mutations.
- Function ACLs/default ACLs and three relevant base triggers were reconstructed. This is not a full authenticated RLS or production end-to-end test.
- The `http` extension is unavailable in PGlite, so its type was stubbed for local DDL compilation. LIVE advertises version 1.6 as available. Actual HTTP/cron execution is not claimed by the rehearsal.
- The existing full-application TypeScript backlog outside the configured feed check is not resolved by this preparation.
- The initial code difference remains large and should show yellow. The operator must still test the intended TEST features and explicitly confirm the pinned version before publishing.
