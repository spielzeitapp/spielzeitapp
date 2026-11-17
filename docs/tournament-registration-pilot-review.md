# Digital tournament registration — TEST pilot, 2026-11-17

## Implemented scope

Existing SpielzeitApp teams: organizer creates a personal invitation per tournament participant; authenticated staff choose an active authorized team season, reuse existing player IDs and select participants. Jersey numbers are snapshots on the tournament registration only. No player, source-roster, membership, score or public feed writes occur.

Routes: `/turnier-meldung/:token` and `/turnier-verwaltung/:eventId`. Login preserves the invitation destination. The organizer entry is available on the tournament Teams tab and the public tournament page for authorized club/platform admins. Public audience team selection remains preference-only.

Private draft/submitted/confirmed registrations, contact name/optional phone, jersey colors and server-generated name/year snapshots. Updating a confirmed registration removes confirmation. Optimistic integer revisions plus row locks reject stale writes. Reissuing a link invalidates the former token without changing the assigned trainer. Revocation and 30-day expiry are enforced server-side. Tokens are 64 hex characters; only their SHA-256 hash is stored. UI does not persist roster drafts in localStorage.

## Security and database

TEST project: spielzeitapp-staging. Migration applied to TEST only. New schema `tournament_registration` is unexposed, RLS enabled and grants revoked. A deliberate narrow SECURITY DEFINER RPC checks auth.uid(), current staff permissions, organizer access, token validity, claimant ownership and revision on every relevant operation. Public/anon EXECUTE revoked. No trust in user-editable metadata. No source roster access by other teams or audience endpoints.

Security advisor: new private-table RLS-without-policy notice is intentional deny-all. Authenticated definer gateway notice is intentional and covered by permission tests. Existing unrelated findings were not changed.

LIVE table columns/dependencies inspected read-only. LIVE does not yet contain `tournament_screen_is_admin(uuid)`, a dependency of this pilot. This migration is NOT approved in release/live-plan.json; do not promote it to LIVE without reviewing/applying that dependency and the complete production privacy flow. No LIVE data or schema changed.

## Verification

- `npm run build` and `npm run typecheck`.
- `node scripts/tournament-registration-test.mjs`: number range, missing/duplicate player and number validation.
- `node scripts/tournament-registration-ui-test.mjs`: React interaction test with synthetic API responses: team selection, roster reuse, player number, submission, organizer confirmation.
- `supabase/tests/tournament_team_registration.sql` executed as rollback transaction on TEST using authenticated-role API calls: invite, roster, submit, confirmation, edit clears confirmation, stale save rejected, duplicate/foreign players rejected, unrelated team rejected, outsider read/manage denied, direct table access denied, token rotation, revoke, unauthenticated and anon rejection. Synthetic event/participant and temporary assignment rolled back.
- Browser automation could not start in this runtime (Chromium socket permission error). No visual browser/device check is claimed. Physical mobile/login/install checks remain before wider use.

## Pilot limits / next steps

Use suitable test data only. New teams without an existing authorized active App roster, guest players, organizer settings/deadlines, reusable club logos/colors, tournament rule acknowledgement, legally reviewed privacy/terms, granular parent/photo/name permissions, staff delegation and controlled TV/feed/ticker integration are separate subsequent stages. Submitting this private roster is NOT publication consent. The screen explicitly labels these limits. No real invitations or messages were sent. Link copy is a user action.
