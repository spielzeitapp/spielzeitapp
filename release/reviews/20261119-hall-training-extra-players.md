# Additional participants in internal training matches

Scope is the existing event-scoped hall training state. Guests use event-local IDs. The club search returns only player ID, name and squad for active squads in the same club and season. It checks staff access for the destination training, and rejects anonymous Auth sessions. No player master data or attendance outside the internal match is written.

LIVE and TEST catalog checks confirmed the existing trigger body matches the prior checked-in migration, staff-only row policies, anonymous-session restrictions, authenticated event update permission for the existing row lock, and relevant roster columns. Isolated PostgreSQL fixtures checked legacy plan saves, valid guests and same-club players, duplicate and unregistered participants, cross-club rejection, stale and repeated revision writes, and anonymous and unauthorized access. Competing requests against the same revision accepted one write in the isolated harness. Typecheck, Vite build, hall planner logic, and UI regression were run on the LIVE-based source. No device-level trainer session was used.

Reviewed migration blob: 14197a906ecc74f2e3019350cb08fe99fed6902a.
