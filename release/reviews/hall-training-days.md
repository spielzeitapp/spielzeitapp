# Internal hall training release review

Migration: `supabase/migrations/20261112220302_hall_training_days.sql`
Exact Git blob: `5b640d450ee321d6b93a10d72064a2c434cb4b65`

## Verified 2026-11-12

- Read-only inspection of LIVE and TEST event columns, staff helpers, event RLS, dependent table grants and event triggers before DDL.
- Fresh schema rehearsed inside rolled-back transactions in TEST and LIVE.
- Migration applied independently to TEST acbaecjzoabafbsjrzvr and LIVE shxugattqatahckhspwk; the same synthetic transaction suite passed against each applied schema. No fixture data survives.
- Actual authenticated role: trainer save/read/update, parent and outsider reads empty/writes denied, anon privilege denial; archived season reads allowed but writes denied. Normal outdoor training cannot be saved through the hall API.
- Timing overrun, invalid pair counts, duplicate/foreign roster IDs and two simultaneous active games rejected. Successful initial/repeated saves, valid running clock and finish, and stale expected revision rejected. Advisory transaction lock serializes writers; stale revision is tested, a two-connection timing race was not separately exercised.
- Security advisors after DDL: no finding referring to the hall table or functions. Existing unrelated project advisories are outside this change.
- Pure planner matrix: 3/4 teams, 15–180 minutes, pause values 0–300 seconds, complete pairing counts and exact time budget. Infeasible settings rejected.
- Component flow with controlled persistence: generate, assign, green saved readiness, start, goal, undo, pause, resume, remount/reload, finish, standings, next match, stale-save feedback and read-only controls.
- Targeted TypeScript compile includes the new planner/store and TrainingDetailSections; normal repository typecheck alone only includes feed components.

## Boundaries

Internal training data lives only in hall_training_days. No match, feed, push or league-statistics insert occurs. UI recognizes Hallentraining or explicit indoor venue text. Timing is a planned budget; coaches start matches manually, so delays can extend wall-clock duration. Equal game counts and team playtime do not automatically balance individual substitutions. No browser/iPhone end-to-end check was possible in the local runtime; browser launch is restricted.

Follow-up migration explicitly denies anonymous Auth sessions in all policies. It was rehearsed with synthetic authenticated anonymous sessions against both environments and then applied independently. Exact follow-up blob: `b409bcfb12ebea90fd5b2cc5239ae329c9984c14`.
