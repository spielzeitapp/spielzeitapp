# Vereinsinterne Tauschbörse – TEST

Entry: `/app/usc-rohrbach?tab=verein&section=tauschboerse`.
SpielzeitApp entry: **Mehr → Tauschbörse**, `/app/tauschboerse`. Uses the selected team's club (or configured partner-club exchange) and offers a club selector when multiple clubs are available. Both surfaces use identical listings and private chats. New notification links preserve the actual club and thread on the authenticated main-app route. Existing USC notification links remain valid.
UI is staging-only. The push API additionally rejects every non-staging database URL.

## Behavior

- All eligible club members see listings across teams, independently of team favourites.
- Active parent/trainer/coach/fan memberships or club/platform administration permit access. Player-only accounts and favourites alone do not.
- Partner youth teams are configured separately in `exchange_partner_teams`; no club/user IDs are embedded in migrations. TEST has the existing SPG Rohrbach U12/U13 assigned to USC.
- Up to five camera/gallery images, locally resized to JPEG with location/EXIF metadata removed. Private bucket, 15-minute signed URLs, at least one photo to publish.
- Only a first-name snapshot is published. No broad profile reads or automatic contact sharing.
- One thread per listing/requester. Only participants can read messages. Owners can reserve, mark given away, edit or delete their listing. Revisions reject stale saves.
- Contact sharing sends only the text explicitly entered by the user into the current private chat. Blocking stops messages in both directions.
- A message transaction creates an in-app notification plus a durable push queue entry. The API accepts no recipient/content/link from the client. It verifies the sender, claims their pending entries, and sends a generic banner through existing active subscriptions.
- `STAGING_DISABLE_OUTBOUND=true` is honored. Failed push delivery remains pending and is retried on the sender's next visit; at most five attempts. This version has no autonomous background retry worker. No subscription means only the in-app notification.

## Evidence and limits

- Vite production build, the configured `npm run typecheck`, and a dedicated TypeScript check for the exchange UI pass. The full-project TypeScript check reports errors in existing legacy/live/training modules outside this change; it is not a clean project-wide check. No diagnostics reference the new exchange files or modified USC app. The existing USC fanshop regression test also passes after incorporating its concurrent TEST update.
- `scripts/club-exchange-sql-test.mjs`: PGlite replays all exchange migrations with Supabase-style default grants, then runs synthetic transactions as the authenticated role. Covers outsider/player rejection, partner access, owner-only changes, no anonymous/TRUNCATE/immutable-column grants, path/storage RLS, third-party chat rejection, forged sender/owner, duplicate thread, targeted notifications with club/thread deep links, blocking, stale revisions and deletion. Fixtures roll back.
- `scripts/club-exchange-main-app-test.mjs`: verifies the main-app entry, shared SPG/USC scope, switching clubs, notification club taking precedence over the selected team, and authorization before team data is requested.
- `scripts/club-exchange-ui-test.mjs`: React renderer exercises listing creation, photo input/upload path, private inquiry/reply, voluntary contact sharing, block/unblock and reserve. DOM/canvas/Supabase are mocked; this does not prove native camera or visual layout.
- `scripts/club-exchange-push-test.mjs`: mocked delivery verifies method/auth, strict TEST target, outbound-disable, server-owned recipients/content, job claim and completed-job dedupe. No real push is sent. The endpoint uses a self-contained CommonJS entry to avoid Vercel runtime resolution of extensionless TypeScript imports.
- TEST database inspection confirms all six tables use RLS, the bucket is private, actual storage policies do not grant unrelated buckets access, and explicit grants are installed. Security advisor's no-policy notice for `exchange_push_queue` is intentional: all client grants revoked, service-role only.
- Remote transaction test through MCP expired before confirmation. No result from that test is claimed. Local PostgreSQL-compatible tests passed. A real authenticated two-device camera/upload/chat/push check remains open; local Chromium could not start because socket creation was denied.
- Existing LIVE dependency columns were inspected read-only. No LIVE data/schema/source deployment was changed. No hashes were added to `release/live-plan.json`; this is not an approval for LIVE publication.

## Reproduce

Run `node scripts/club-exchange-ui-test.mjs` and `node scripts/club-exchange-push-test.mjs` with repository dependencies installed.
For the isolated SQL test install `@electric-sql/pglite@0.3.14` in a temporary prefix and set `EXCHANGE_PGLITE_PATH` to its package directory before running `node scripts/club-exchange-sql-test.mjs`.

The first two migrations were applied to TEST, followed by a TEST-only policy correction for owner cleanup and the explicit privilege migration. The checked-in second migration includes that cleanup correction so a fresh replay produces the same final schema. No already-LIVE migration was modified.
