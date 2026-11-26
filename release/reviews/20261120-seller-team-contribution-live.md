# LIVE promotion: seller announces sale and forwards team contribution

Promotes only TEST commit 1746d57 seller-handover changes onto LIVE d5127a7. Unrelated TEST application changes and the TEST-only shop remain outside this release. Existing production club IDs, users, listings, grants and payment instructions are retained.

LIVE shxugattqatahckhspwk functions, column layout, ACL, fixed search_path and RLS inspected before applying the exact unchanged 20261119232238_exchange_fund_seller_handover.sql from TEST. Migration applied successfully. Both exchange_cash_explicit_access.sql and exchange_fund_legacy_compatibility.sql passed against LIVE using actual authenticated-role synthetic transactions rolled back in full: ownership, stale revision, atomic sold marking, pending versus balance, split immutability, cancel/reannounce, explicit trainer approval, partial-team visibility, all-team receipt rights, idempotent posting/payout, overdraft, read-only/crossclub denial and legacy original buyer handling. No real finance records or transfers created.

Exact migration Git blob added to release/live-plan.json only after these LIVE role tests passed. Earlier TEST review is historical; its TEST-only restriction is superseded by this explicit promotion.

Frontend verification: team-fund component tests, manager dashboard tests, release hashes, TypeScript and Vite production build pass. No complete real-person mail/signup/handover or physical-device smoke test is claimed. No online bank transfer or reconciliation is introduced. User may simulate the workflow in TEST; LIVE receipt confirmation requires actual received money.
