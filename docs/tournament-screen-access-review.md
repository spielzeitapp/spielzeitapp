# TEST tournament presentation permissions

16 November 2026. TEST only; no production release or LIVE database changes.

Screen mode is granted to platform admins, active club admins of the tournament club, and explicitly assigned trainers of the tournament team season. Other trainers, parents, fans and anonymous visitors are denied, including direct mode URLs. QR, public tournament data and print/PDF remain public.

Admins assign/revoke directors from the public tournament page via Turnierleitung verwalten. Trainer assignments do not grant admin powers. Membership removal invalidates an assignment. The active display rechecks every 20 seconds and on focus/auth changes. Failures deny screen access; refreshes of the same account do not blank an existing display unnecessarily.

Database: private RLS-enabled table with no anon/authenticated table grants. Narrow SECURITY DEFINER RPCs intentionally mediate access, verify auth.uid and event/club scope, use a fixed search_path and explicit execute grants. Candidate lists return only trainer IDs and display names; no email, phone or private account metadata. No user-editable JWT metadata used. Assignments are per user/event, idempotent inserts/deletes, not replacement of an entire membership list. No migration added to the LIVE allowlist; production schema/permission review remains required before LIVE publication.

Verification: transactional synthetic TEST cases run as authenticated and anon, with rollback: platform admin, club admin, unassigned trainer, delegated trainer, revoked director, unknown event, outsiders, attempted escalation/list read, direct table access, invalid target/null values and repeated assign/revoke. RLS/grants inspected and zero test profiles left behind. React integration tests cover toolbar visibility, direct URL guard, admin assignment, authorization/revocation and permission network failure; existing public cards, sections and embedded overview remain checked. A4/A3 and QR presentation tests pass. Build/typecheck and diff whitespace check performed. Physical iPhone/AirPlay testing still requires a device.

Limitation: public data and OS screen mirroring stay public capabilities; this controls the app presentation mode, not copying public information or AirPlay at OS level.
