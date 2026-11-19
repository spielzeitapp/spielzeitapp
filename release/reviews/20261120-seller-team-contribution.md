# TEST: seller receives price and forwards team contribution

Scope: TEST/develop only. LIVE/main and its database have not been modified. This candidate supersedes the previous cross-environment market source parity baseline for its changed files. New migration is intentionally not added to release/live-plan.json: no LIVE migration execution or LIVE role validation is claimed.

Buyer contacts the seller and agrees external handover/payment. Owner explicitly confirms item handed over and price received. RPC locks the listing, checks membership/ownership/revision/offer, snapshots fixed price and split, marks item Vergeben and creates one seller-origin pending contribution atomically. No payment settings required to announce; missing instructions ask seller to arrange handover with trainer/cashier. Seller can cancel a pending announcement; this never silently republishes the item. Active seller announcements prevent re-publishing, price changes or split changes. Receipt and payout ledger retains existing explicit team booking checks and idempotency.

Cash view shows source, current seller first-name label, listing title, reference and only authorized team shares. Partial team access can see its own pending share without other team labels/amounts, but cannot confirm the multi-team receipt without all participating team booking rights. Cash balance changes only on receipt confirmation. Dashboard highlights pending contributions for approved teams. No new push/email dispatch is claimed; refresh/open the cash view to see current data.

Existing buyer-origin pledges default to initiated_by=buyer, retain original payer and payment instructions, and cannot be duplicated through the new seller flow. Public UI explains new workflow; actual legacy pledge details retain legacy wording.

Verification on TEST acbaecjzoabafbsjrzvr:
- Original applied functions/schema inspected; LIVE function ACL/RLS inspected read-only before changes.
- New migration applied via MCP; private tables remain RLS enabled and client table access revoked, public wrappers remain invoker; anonymous announce and client trigger execute denied.
- exchange_team_fund.sql and exchange_cash_explicit_access.sql: PASS real authenticated SQL role in rolled-back synthetic transactions. Seller-only announcements, stale revisions, atomic sold status, duplicate announcement/receipt/payout, cancellation/re-announcement, immutable split, no premature balance, team scope, partial grants, privilege escalation, read-only grants, overdraw and cross-club denial.
- exchange_fund_legacy_compatibility.sql: PASS above workflow plus legacy original buyer ownership, duplicate seller denial and legacy cancellation checks. All synthetic records rolled back. Actual TEST payment settings count zero, proving announcement works without payment instructions.
- Team-fund component test: PASS buyer has no announce button; seller confirmation checkbox gates submission, exact listing/revision sent, reference/open state and cancellation, parent listing refresh, manager requires explicit receipt step.
- Manager dashboard component test, candidate release hashes, TypeScript and Vite production build: PASS.
- Security advisors inspected: private deny-all finance tables intentionally report INFO no-policy; pre-existing unrelated public view/function/auth findings remain outside this change. New trigger has fixed empty search_path and no client execute grant. Relevant remediation: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Limits: device walkthrough by user still required. No actual handover, bank movement, real receipt or production data mutation performed. No online checkout, automatic bank reconciliation or tax receipt.
