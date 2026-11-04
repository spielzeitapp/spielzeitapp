# One-time release baseline review

Application reconciliation completed on 2026-11-04. LIVE publication remains blocked pending database and Edge Function review. No LIVE database change or TEST data transfer was performed.

Sources: LIVE `991349e9721e85b92da649f416d0bfccbea84dff`, TEST `2e475122924425fa95dfa5578d0b6a4c6f4a3036`.

## Application reconciliation

All 117 conflicting files have been reconciled in a real merge of LIVE into TEST. The per-file/hunk choices are recorded in `release-baseline-resolution.json`. This is not an ancestry-only merge: the resulting tree retains the intended TEST Manager, ÖFB, branding and authorization additions and restores released fixes for persisted favorites, user switching, feed deletion/automation, poster design, video transfer and marketing assets.

Follow-up integration fixes: remove duplicate Home filter markup, complete the demo formation wrapper/import, restore the demo training plan import, remove an unused Team logo reference, avoid duplicate schedule date classification, use the actual opponent-logo state setter, and allow the global publication page without a team scope. Communication generation retains TEST permissions with environment-bound CORS for TEST and LIVE; deployment of this changed Edge Function remains a separate blocker.

## Validation

- Production Vite build and the configured feed typecheck pass.
- 14 release authorization, stale snapshot, full file comparison and serverless routing tests pass; API remains at 10 deployed functions.
- Favorite session lifecycle, multi-team reading scope, normal favorites, club-theme scope, automatic matchday deletion, poster design, match club branding, ÖFB opponent-logo roundtrip, player assignment, roster preview, duration settings, Manager trainer mode and parent invitation UX tests pass.
- Demo formation and authorized video transfer tests pass.
- Full application TypeScript check was additionally compared to the unchanged TEST baseline. Existing errors outside the configured check remain; see validation results. No newly introduced diagnostic may be accepted. This is not a claim that the entire application is type-clean.
- Older source-string assertions for parent profile hint, platform dashboard labels and opponent logos are stale on existing branch heads; they are not acceptance evidence. The SQL feed-switch test requires the optional PGlite dependency, absent in this workspace.
- Authenticated end-to-end user acceptance remains to be done on TEST.

## Database inventory and release blockers

LIVE history was read without mutation: 128 entries. There are 186 repository SQL files whose exact version is absent from that history: 150 already exist in the LIVE source branch and 36 are TEST additions. Of these, 28 have a same-named LIVE entry under a different version. A matching name is not proof of identical SQL or schema. Two files even share an existing repository version; historical ordering must not be reconstructed by blindly replaying the folder.

`release-live-migration-inventory.json` records the read-only LIVE version/name inventory. `release-missing-migrations-review.json` records exact candidate blobs and separates new changes, legacy files, possible version aliases and explicitly excluded files. Neither file grants migration approval. `release/live-plan.json` retains its empty approvals.

The admin-org files `20260818140000` and `20260818140100` remain excluded and must not run automatically. Historical SQL conflicts retain the LIVE source contents. New, compatible schema deltas must be reviewed against the actual LIVE schema and tested separately. Do not mark missing versions applied or treat this code reconciliation as database equivalence approval.

Changed Edge Functions and three TEST-only setup workflows also require a separate, reviewed deployment/bootstrap decision before the first publication. The traffic light must stay red while these blockers remain; a large, completely enumerated code-only release may be yellow after all real blockers are resolved.
