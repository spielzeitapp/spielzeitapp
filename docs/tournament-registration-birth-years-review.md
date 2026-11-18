# Tournament registration birth years — TEST review

2026-11-18. Scope: private tournament registration only.

The v4 gateway delegates token, claimant, staff/team, player ID, revision and write-lock checks to the existing v3 gateway before reading canonical `player_profiles.birthdate`. Legacy `players.Geburtsdatum` is the fallback. Only the year enters the registration response. Existing authoritative years cannot be overridden. Missing years can be completed in the private tournament snapshot; submitting requires valid years. Drafts may leave them blank. Player profiles and club rosters are never written by the gateway.

The migration remains TEST-only. Its pre-LIVE draft was corrected after checking rosterService's canonical birthday enrichment; TEST applied the initial version and then the CREATE OR REPLACE profile-source correction. The committed migration contains the final definition. This does not represent a LIVE execution.

Validation: TypeScript typecheck and production build passed. React renderer interaction test covers App roster year entry, review/save payload, logo and guest paths. Pure validation checks cover missing, malformed, future and valid years. The SQL rollback fixture uses authenticated roles and tests missing/invalid years, persisted snapshot/reload, source profile preservation, canonical profile precedence, conflicting source year rejection, stale revision, outsider and anonymous denial. All fixture writes roll back.

LIVE prerequisites checked read-only: v3 is absent on LIVE, so no LIVE migration approval hash was added. No LIVE changes were made. Actual mobile/browser layout has not been verified in a browser: Chromium cannot start in this runtime. Automated interaction tests do not replace that check.
