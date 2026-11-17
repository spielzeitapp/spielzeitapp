# Tournament registration logos — TEST, 2026-11-17

Logo upload and light/dark previews added to App-team and guest-team registration. Existing authorized App team options include the club logo; selecting that team defaults to adopting the club logo. A custom upload or explicit removal is saved with the roster draft/submission. The organizer can inspect/replace/remove the registration logo; replacing/removing an approved logo clears confirmation and increments revision. Club branding itself is never modified.

## Files and privacy

PNG/JPEG/WebP/SVG input up to 5 MB is decoded and normalized client-side to a transparent PNG with aspect ratio preserved (up to 512 pixels, reducing to 384/256 when needed). SVG script/event/external references and DTD/entities are rejected; raw SVG is never saved. The private registration stores the optimized PNG data URI (bounded to 180,000 bytes) rather than publishing an unreviewed storage object. This avoids public draft URLs and orphaned uploads. Source club URLs come only from the authorized team query, never arbitrary client URL parameters.

The v3 gateway delegates existing current auth/token/expiry/claimant/roster/organizer checks to v2. Save plus logo validation is atomic. Invalid, oversized or arbitrary-URL logos roll back the roster write as well. Organizer changes require current admin access plus exact revision. PUBLIC/anon execution revoked. Private RLS and deny-all grants unchanged. The intentional authenticated SECURITY DEFINER gateway advisor is reviewed; no unrelated advisor changed.

## Verification

- `npm run typecheck`, `npm run build`.
- Registration interaction tests cover App/guest logo selection payloads, existing-logo availability, review/receipt behavior and organizer confirmation. MIME/size checks and safe preview source checks included.
- Rollback SQL `supabase/tests/tournament_registration_logos.sql`: authorized club inheritance, PNG save/read, invalid active SVG/URL/oversize rejected atomically, explicit removal, confirmation reset, stale revision, unrelated user read/write denied, anon denied, original club untouched.
- Guest-registration rollback assertions run through v3 for regression coverage.
- Browser image decoding/file picker and physical mobile appearance still need a device check; no real browser file-upload test is claimed. No customer images uploaded by this task.

TEST migration applied only. LIVE checked read-only: the v2 dependency is absent. No LIVE hashes approved, no LIVE schema/data changed. Public tournament/TV logo publication and wider tournament-center integration remain subsequent work; this feature provides the internal confirmed registration asset.
