# Voluntary donations review — 2026-11-26

Free listings may invite optional donations to the club or an eligible own team. Buyer default is zero. Suggested amount is only sent as a chat message; it creates no cash record. Seller reports actual handover and received amount; an authorized cashier confirms positive receipts separately. No payment processing or automatic bank transfer. Existing fixed team-fund balances and payouts are unchanged. This separate register is not a withdrawable balance.

## Database validation
Inspected existing LIVE schema and authorization dependencies read-only before migration. Applied identical migration to separate TEST acbaecjzoabafbsjrzvr and LIVE shxugattqatahckhspwk; no application data copied between projects. Exact reviewed Git blob: 98b15df0c1379d24a767c0b299fdb42883c21743. Migration created using Supabase CLI; deployed file was not rewritten after application.

Executed scripts/voluntary-donation-db-test.sql in isolated transactions on both projects, before and after applying the migration. Fixtures and fake auth users rolled back. Calls used actual authenticated role and JWT claims. Passed club/team reports, zero amount, negative amount rejection, stale revisions, ownership, member dashboard denial, owner cash-confirm denial, raw private table denial, post-report retarget denial, idempotent repeated report/confirmation, changed amount rejection, required receipt note, positive-only dashboard and confirmed sums. Unique listing receipt plus row locks protect duplicate submissions. Parallel multi-connection interleaving was not exercised; sequential repeats and stale states were.

Security advisors run on both projects. New private receipt table has RLS and no policies intentionally: direct access revoked, checked RPC only. Advisor INFO for no RLS policies is expected; raw authenticated access denial tested. Existing unrelated advisor findings were not modified.

## Frontend validation
Typecheck both branches; fixed team-fund tests both; voluntary-donation-ui-test both (zero default, buyer selection creates no receipt, owner explicit acknowledgment, report revision and zero payload). Public API projection test, saved-provider test and request-send test passed. Existing club-exchange-public-ui-test is stale: lacks SessionProvider for existing useMarketAppSwitch hook, and still expects removed Neu im Shop tile; cannot currently serve as an end-to-end gate. No native iPhone visual walkthrough performed.

## Limits
Last 500 positive receipts are shown and the displayed confirmed total covers that window. Zero reports record a gifted outcome but no cash. No correction/cancellation workflow for a submitted receipt in this change; no payout flow for voluntary register. Existing fixed contributions retain their existing workflow.
