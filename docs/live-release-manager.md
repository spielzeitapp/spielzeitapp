# Manager LIVE publication

Platform dashboard now includes an owner-only TEST publication panel. It requires a fresh server-verified Supabase user and a global `user_roles.role=admin`; season staff and UI role overrides cannot authorize a release. The API is limited to the fixed TEST project, fixed repository, develop source and main target. POST dispatches only the exact head/main/manifest digest shown in the preview. The worker revalidates that snapshot, CI status and migration content before touching LIVE.

## Current bootstrap requirements

The panel deliberately remains blocked until these are configured. Installing this feature in develop does **not** publish LIVE.

1. Install `.github/workflows/publish-live.yml`, `scripts/release/publish-live.mjs`, and `server/lib/liveRelease.js` on the default/main branch as a separate reviewed bootstrap change. Do not promote the whole develop branch for bootstrap. Workflow dispatch requires the workflow on the default branch. Coordinate this small main update with existing deployment controls because any main push may trigger Vercel.
2. In the TEST Vercel project(s) only, configure server-only `RELEASE_GITHUB_TOKEN`. Use an installation token or fine-grained repository token with Contents read, Commit statuses read and Actions write/read for `spielzeitapp/spielzeitapp`. Never use a VITE-prefixed secret. Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required to verify the user, and must point to TEST. Redeploy TEST after configuration. Rotate the release token as needed; expiration is shown as a connection failure.
3. Configure GitHub environment `production` and its `SUPABASE_ACCESS_TOKEN`, scoped operationally to the LIVE project. Review GitHub branch/environment protection and workflow push permissions; never bypass main protection to make the button work. If environment reviewers are enabled, the run waits for their approval and the panel shows the pending run.
4. Review all unapplied LIVE database migrations against the actual LIVE schema/history. Record each approved migration's exact Git blob SHA under its full path in `release/live-plan.json`. The committed file starts with an empty approval map. Historical missing migrations are checked too. Editing an already-shipped SQL file is blocked; create a new migration. Only additive/backward-compatible changes belong in this automatic path. Destructive changes need a separately planned maintenance operation. No TEST database dump or test content is copied.
5. Reconcile any divergence between main/develop and bring the bootstrap main commit into develop. The automatic path accepts a fast-forward only. Verify the complete proposed main/develop diff before approval.

## Execution and failure behavior

A user reviews the displayed version and explicitly confirms the action. The API creates a workflow request, rather than publishing inside a short-lived HTTP handler. The trusted workflow/script is loaded from main; candidate build steps have no production database secret. After the candidate builds, a separate production-environment job verifies pending migrations and applies only approved blobs to fixed LIVE project `shxugattqatahckhspwk`. It then fast-forwards main without force. Deployment is confirmed by the public version endpoint on `https://spielzeitapp.at`, requiring the exact SHA and main branch; old TEST Vercel statuses are not treated as proof of LIVE readiness.

The worker serializes releases. Source changes, divergent branches, failed/pending checks, missing approvals, incomplete comparisons or unapplied unapproved SQL all stop the job. The UI displays a run history and does not automatically retry release POSTs. Private API data is not cached. The public `?view=version` exposes only the deployed SHA/branch for health verification.

Database updates cannot be automatically rolled back safely: if migration or code deployment fails after partial progress, the run fails visibly and an operator must inspect the actual state before retrying. Repeated database migration versions are skipped. A database schema already ahead of code must stay backward compatible; rollback is a separate reviewed code or forward-fix operation. The button does not enable ÖFB jobs or other LIVE outbound services automatically; those require an environment-specific reviewed activation.

## Validation

`node --test scripts/release/live-release.test.cjs` verifies pinned-plan readiness, changed snapshots, exact migration SHA approval, divergence/check/bootstrap gates, active-run serialization and actual API authorization/environment rejection. Run the project typecheck and production build too. A real production dispatch is intentionally not part of these tests. Until bootstrap and credentials are installed, the visible disabled state is expected, not a successful deployment.

## Publication traffic light

Green means all checks pass. Yellow means all mandatory checks pass with review notes (for example a large update); the explicit confirmation still enables publication. Red means a required check or setup step blocks publication. A warning never overrides a blocker. GitHub caps comparison files at 300, so large updates use both complete recursive Git trees and refuse truncated trees. Exact migration approvals, unchanged shipped migrations and fast-forward ancestry remain mandatory.
