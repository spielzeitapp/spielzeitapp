# Connected tournament — TEST review, 2026-11-11

## Scope

Develop / staging only. No LIVE database, scheduler or Edge Function changed.
Provider example: https://www.meinturnierplan.de/showit.php?id=164yujsris

- Shared MeinTurnierplan parser retains provider game IDs, official standings, placement labels, bracket sources, provisional opponents and candidate paths.
- Group-derived pairings are provisional until the relevant group has results for every game. An unresolved opponent cannot create a playable own match or a notification.
- Exact tournament-specific own-team association prevents Rohrbach and Rohrbach U11 being merged.
- Central pg_cron / pg_net scheduler loads the read-only analyzer endpoint. No trainer session, service key or client tab is required. Refreshes about every two minutes during a tournament, every 15 minutes before tournament day. API responses are no-store. Retry preserves the previous snapshot.
- A single event lock serializes imports. Older timestamped responses and stale source URLs cannot replace a newer snapshot. Stable provider IDs survive kickoff changes.
- Own matches retain live score, events, lineup and squad. Official score is a display fallback before an own ticker has started; provider results do not mutate ticker scores. Official standings are explicitly labeled and not silently rewritten from app scores.
- Fans can opt in per tournament. Current membership, current opt-in, opponent, kickoff, cancellation and match status are checked at dispatch. One pending next-match job; postponement supersedes the obsolete job. Push TTL is limited to kickoff. The existing general TEST reminder scheduler remains disabled; the tournament worker uses tournamentOnly=1.

## Database review

Migration: `20261111113635_tournament_connected_live.sql` was iterated on TEST, not applied to LIVE. No migration-history entry is implied by the direct TEST SQL execution.
Public state has authenticated membership-scoped SELECT only. Subscription writes require auth.uid() ownership and event membership. There is no anonymous access. Private schema tables and functions have no anon/authenticated/service_role access. The one public SECURITY DEFINER RPC deliberately permits staff/platform-admin access with an explicit auth.uid() and team check, fixed search_path, source-link and active-season validation.

Executed rollback integration assertions using actual authenticated staff permissions:

- Repeat import of the 8-team example: 20 slots, 5 exact SPG Rohrbach matches; no duplicates.
- Exactly two championship semifinals; placement branch and third/fifth/seventh-place matches correctly categorized.
- Existing live score preserved across refresh.
- Stale source URL rejected.
- One reminder after repeated scheduling; postponement replaces the old pending job.
- Unrelated authenticated user cannot read snapshot, call writer RPC or create subscription.
- Service-role read access confirmed; direct authenticated state writes revoked.

Security advisors: no new open anonymous RPC. Private RLS-without-policy notices are intentional deny-all. The authenticated writer RPC notice is intentional and covered by the authorization tests above. Existing unrelated advisories were not changed.

## Verification and remaining device check

Pure tests: `node scripts/tournament-connected-test.mjs`, `node --import tsx scripts/tournament-reminder-test.ts`, existing phase-sync/schedule/public-page/reminder tests. Production build and scoped repository typecheck checked. Full repository tsc has pre-existing diagnostics and is not claimed clean.

The deployed staging Edge Function was invoked with tournamentOnly=1 and returned 200, zero jobs. No notification was sent to customers. Physical iOS push reception and mobile layout still need a device check before LIVE promotion. A historical provider result cannot prove a live organizer change; clock/pairing changes are tested synthetically in rollback transactions.

LIVE migration blob approval has intentionally not been added to `release/live-plan.json`; LIVE release is the subsequent stage after TEST/device verification. No TEST fixtures are to be copied to LIVE.
