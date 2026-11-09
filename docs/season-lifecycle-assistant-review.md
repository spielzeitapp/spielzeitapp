# Season lifecycle assistant — technical review 2026-11-09

Migration: supabase/migrations/20261109084014_season_lifecycle_assistant.sql
Reviewed Git blob: 723d7de898856d4b2e2e77dc837cd818e4ac2dbb

Scope: TEST implementation; technical approval of this exact migration does not deploy LIVE. Background cron is deliberately configured separately per environment.

Actual TEST and LIVE tables, columns, dependent helpers, grants and RLS were inspected before implementation. Both environments have zero duplicate draft prepared_from_team_season_id values. Public RPCs are security definers with empty search_path and explicit auth.uid plus platform/club/team staff checks. Private plans and worker functions are inaccessible to anonymous/authenticated/service_role clients. No privileged client keys.

Synthetic regression suite executed against TEST in a transaction with rollback using the exact migration above. Passed: authenticated trainer success, fan/anonymous/foreign-team denial, repeated preparation identity, unique draft race guard, explicit confirmation, stale fingerprint rejection, running-match guard, next-year manual/import routing, old-season date rejection, archive/activate and idempotent retry, same player IDs including preservation of paused roster status, preserved historical roster/statistics, copied photo, private worker ACL. Existing TEST data was not changed by these tests. Locks serialize writes against closure and preparation against competing preparations. A full simultaneous multi-session load test was not performed.

Known schedule completeness cannot be proven by the current importer; possible end is a suggestion after known competitive games finish in spring. Confirmation explicitly covers missing/postponed/cup games. Annual July–June seasons only. Future source events and running clocks block closure. Youth age is a proposal requiring review. No automatic parent invitations or automatic next-season activation. New ÖFB sync starts disabled until the new assignment is verified.

UI: shared assistant in current manager, design comparison, season administration and competition page. New-year manual game/ÖFB import prepares a draft and requests season review instead of writing to the old season. Scope changes discard late UI responses. Global overview does not change the selected trainer season.

Background: private tick scans active clubs and active annual seasons from May 1 of season end year, at most 100 eligible sources per invocation; advisory lock prevents overlapping ticks. Exceptions are retained per source and retried after a day. It prepares drafts only; never archives or activates.

Verification: SQL suite passed on TEST; frontend/typecheck/build results are tracked by the Season lifecycle checks workflow in the PR. Browser/iPhone end-to-end verification remains a manual follow-up.
