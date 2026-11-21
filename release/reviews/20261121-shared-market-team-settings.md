# Shared market team settings

NSG and USC previously used separate parent choices inside each environment. Explicit environment-local source mappings now use one authoritative choices row/version per partnership; all existing admin authorization and registration access checks remain. Partner pools are linked without changing team ownership, memberships, cash grants or financial data. New teams/partner links join the shared candidate pool but remain disabled until selected. Manual editing remains subject to the original owning club.

Validated against actual TEST and LIVE structures, with rollback transactions under authenticated: cross-club saved label and version, registration option equality, new-team linking, stale version rejection, foreign team rejection, unprivileged denial. Tests passed before and after installation. Actual selected names checked identical across both local source clubs: 11 enabled, KM/Reserve disabled. No physical-device end-to-end claim.

Environment-local configuration was deliberately applied separately: TEST source is the existing active USC market, LIVE source the existing active NSG market. Existing choices unioned, old duplicate choice storage cleared. Missing TEST Hainfeld U14/Rohrbach U15 and LIVE St. Veit U8 created through the existing authenticated manager RPC; no TEST records copied to LIVE. Existing LIVE short aliases corrected through the normal versioned settings RPC.

Database-only change; no frontend build required for effect. Security advisors reviewed; private configuration has RLS and no client grants/policies by design.
