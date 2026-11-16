# Spectator Push in TEST

Scope: `/turnier-app/` only, no account, no main-app subscriptions reused. Backend and cron are hard-gated to TEST. Nothing is approved or published to LIVE by this change.

## Consent and delivery

A tap on “Benachrichtigungen aktivieren” requests native permission. iPhone/iPad browser users get installation guidance first; installed app users can grant permission. Unsupported devices keep browsing. A random 256-bit device capability is persisted locally; the server stores its SHA-256 only. Device subscription is scoped to tournament and selected team (empty = all fixtures). Team switches reuse consent; opt-out deletes this tournament registration without removing other tournament subscriptions. Self-test sends only to the submitting capability’s registration.

Minute cron creates private, short-lived, single-use tickets for the existing tournament API entry. No extra Vercel function or new environment secret. The server reuses the existing VAPID configuration and respects `STAGING_DISABLE_OUTBOUND`. Missing configuration is shown as unavailable, never active. The worker claims rows with SKIP LOCKED and a two-minute lease, rechecks revocation/team changes, and conditionally saves snapshots against the original lease. Processing is bounded to about 35 seconds plus in-flight operations. Retry uses stable native notification tags (at-least-once transport, not a guarantee of exactly-once display). Expired subscriptions and 404/410 endpoints are deleted.

Notifications: next upcoming selected-team fixture within five minutes, future schedule changes/removals, newly assigned final/placement fixtures. Scores alone do not create notifications. Initial registration establishes a baseline, so existing games do not all announce themselves. Scheduled HH:mm uses Europe/Vienna on the event date. Local own-team aliases are canonicalized to the official participant name. Future tournament data continues to rely on the existing sync.

## Security checks

New subscription/ticket/quota tables: RLS on, no anon/authenticated grants or policies, service role only. The advisor’s “RLS enabled, no policies” notice is intentional deny-all for browser roles; do not add public read policies. RPC claim/quota functions are SECURITY INVOKER and service-role-only. Scheduler is private with fixed search_path and no public/auth/service execution rights. HTTP client APIs require exact TEST origin, JSON, bounded bodies, validated device capability and actual tournament/team. Push URLs are restricted to known HTTPS push providers (no arbitrary SSRF target); keys are decoded and length checked. Device/IP mutation requests are rate limited. Worker links can only open own `/turnier-app/<UUID>` routes. No private keys, endpoints, capability tokens or push content are logged.

## Verification

- `scripts/tournament-audience-push-db-test.sql`: ran against TEST with actual anon/authenticated/service_role; allowed/denied calls, invalid capability, repeated lease claim, stale worker update, quota, single-use ticket consumption/replay. Entire fixture transaction rolled back.
- `scripts/tournament-audience-push-test.mjs`: endpoint validation; Vienna winter/summer; alias merge; selected-team/reminder/dedupe/postponement/final/removal; real service worker handlers safe navigation.
- `scripts/tournament-audience-push-ui-test.mjs`: real hook with browser/server mocks; no permission on mount, permission on click, successful persistence, switching team, device self-test, event-specific opt-out, server failure, installed-iPhone requirement, permission denied.
- `scripts/tournament-audience-push-api-test.mjs`: real API handler with mocked Supabase/transport; origin/endpoint/team checks, device capability isolation, self-test targeting, ticket auth/replay, duplicate tick and opt-out.
- Existing spectator app regression, TypeScript and production build.

Limits: physical iOS/Android native permission sheet and actual lock-screen receipt require the user’s phone and its consent. “Testnachricht senden” is provided for this final check. No successful physical delivery is claimed from mocked transport tests. Offline devices receive only within the notification TTL; OS notification settings and network availability still govern receipt. Before LIVE, inspect current LIVE dependencies/grants and approve the exact migration hash separately; this change adds no release allowlist hashes.
