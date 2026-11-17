# Step 1 — Guest team registration, TEST only

2026-11-17. Extends the existing invitation workflow to authenticated users without an App team or trainer membership. A valid personal invitation and an account are required. The organizer still reviews the declared club/team against the invited participant. No global team, player, club or role is created.

## Behavior

- Invitation entry offers existing-account login or new account registration. The existing safe `next` redirect carries the invitation through email confirmation; tournament-specific account copy avoids promising a role/child selection.
- Trainer chooses App roster reuse or guest registration. A no-team account starts with guest registration.
- Guest fields: club, team, contact, optional phone, jersey colors. Up to 40 player rows: first/last name, year, number. Drafts may be incomplete; submission requires complete valid fields and the declaration of authority.
- Guest IDs have a separate `guest:` namespace and live only in private registration JSON. App players retain existing IDs and the original roster path.
- Reopening an invitation restores saved guest drafts. Subsequent edits increment the revision and clear organizer confirmation. Switching away from unsaved guest edits prompts before discarding.
- Organizer list includes declared guest club/team for review, plus existing confirm/revoke actions. No public-name/photo permission is implied.

## Database and authorization

New migration adds only private `guest_details` and an authenticated v2 gateway. It reuses the original current auth/token/expiry/revocation/claimant/staff validation and row lock. Organizer list calls the original authorization gate before private metadata access. Guest writes validate revision and normalize an allowlist of fields. No source-table writes. Private schema/table grants remain denied, RLS retained; anon/PUBLIC function execution revoked.

Security advisor reports the authenticated SECURITY DEFINER gateway intentionally, as with the original narrowly scoped RPC. The existing private deny-all table notice remains intentional. Unrelated findings unchanged.

TEST migration applied. LIVE inspected read-only: original registration dependency and private entries table are absent. No LIVE release hash approval was added. Requires the preceding registration/screen-access migrations and a reviewed complete production privacy workflow before any LIVE release.

## Verification

- Typecheck and production build.
- React interaction tests: existing App team selection/import/submit/confirmation plus a no-team account's guest details/player input/submission and submitted receipt.
- `supabase/tests/tournament_guest_registration.sql`, rollback on TEST with a synthetic auth user without memberships: invitation, guest submit, missing year, number range, duplicate rows, source-ID spoof rejection, stale save, unrelated claimant, organizer metadata/confirmation, edit clears confirmation, incomplete draft, revoke, anon denial, no source player/membership created.
- Existing App-path rollback SQL re-executed through v2, including roster isolation and source-roster preservation.
- No customer accounts or invitations created; no email sent. Actual email delivery/confirmation and a full mobile browser check remain manual device checks. Previously documented runtime browser restriction remains.

## Next stages

Existing App roster missing-year completion, tournament rules/privacy texts, deadlines/queries, organizer settings and controlled public/TV/media integrations remain separate. Use suitable test data during this pilot.
