# Focused release: favorite view persistence and club colors

Base: main `acb727aab4e46ff7622df0357224d381f4714f28` (PR #61).
Source: develop `34faf396`, especially c4ba7350, b46bfd2c, a8956724,
4f714cf5 and their external-view dependencies in 1e577829 / 9c9807af.
This release does not merge develop or introduce a Melk-specific/demo route.

## Result

- Favorites select a read scope independently of trainer work season/role.
- Single external favorites survive reload and logout/login on the same browser.
- Preferences remain keyed by account. An explicit work-team selection clears
  the previous saved favorite scope.
- External team metadata is loaded using the signed-in client and current RLS;
  unavailable favorites show an error rather than borrowing Rohrbach metadata.
- Opening a discovered team uses the existing fan membership model. Duplicate
  membership inserts are ignored, preserving an existing trainer/parent role.
- The active club colors replace fixed red navigation/profile gradients,
  highlights and profile controls. Rohrbach retains its existing palette.
- Team metadata and player lists follow the read scope; old roster responses
  cannot replace the list after a team switch.
- No database/schema/policy/data changes. Existing splash/welcome release #61
  and unrelated main functionality remain in the base unchanged.

## Validation

Passed locally:

- `npm run build` (existing bundle-size warnings only)
- `npm run typecheck`
- `node scripts/favorite-session-lifecycle-test.mjs` — actual React
  SessionProvider and useActiveTeamSeason with mocked database data: external
  singleton, reload, same-account logout/login, direct account switch, trainer
  season isolation, return to Rohrbach, parent U11 archive, unavailable team,
  fan membership duplicate protection.
- `node scripts/team-view-selection-test.mjs`
- `node scripts/bottom-nav-initial-position-test.mjs`
- `node scripts/auth-ios-focus-test.mjs`
- `node scripts/step4-season-logic-check.mjs`
- `node scripts/parent-access-cleanup-invite-final-test.mjs`
- `git diff --check`

These are component/lifecycle checks, not authenticated production or real-device
end-to-end tests. WebKit was downloaded but cannot launch here because its host
system libraries are unavailable. No successful iPhone visual test is claimed.

## Remaining acceptance checks

Use the regular Manager setup to create the LIVE Melk club/team/season before
attempting a production Melk end-to-end test. On a physical iPhone: select only
Melk, close/reopen, logout/login, verify fan-facing team content and club colors
on navigation/profile/splash/welcome, then return to Rohrbach and check trainer
functions and U11 archive. Also verify keyboard scrolling in the favorites
sheet. This release does not certify these checks as passed.

## Final targeted release

The release also includes the tested More background, Welcome image recoloring,
blue/yellow kit variant, and dark Welcome buttons from PRs #62–#65. More and
favorite control colors follow the club palette without unrelated develop UI
changes. The user confirmed the requested short iPhone acceptance checks before
requesting publication. The combined main-based build, typecheck and listed
session/navigation/parent/archive regression checks all passed again.
