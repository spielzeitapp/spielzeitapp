# Completed TEST bootstrap workflows

These files are source archives, not executable workflows. They are preserved byte-for-byte with a `.txt` suffix so a future release cannot accidentally re-enable one-time setup jobs.

Read-only verification on 2026-11-04 confirmed on TEST (`acbaecjzoabafbsjrzvr`):

- Club-admin assignment table, club-admin helper, Manager context, staff lookup and both assignment RPCs exist. Legacy membership backfill is complete.
- Training club/team authorization helpers exist. All four exercise policies, four session policies and four exam-document policies use the intended helpers.
- Branding setter/getter and the public logo bucket exist. Branding migration `20260927100000` is recorded.

This is evidence for retiring completed TEST installers only. It does not approve LIVE SQL or repair migration history. The trusted LIVE publication workflow is unchanged.

## SQL excluded from the first publication

The two admin-org SQL files remain explicitly excluded from automatic publication. The third SQL archive (`20260929100000`) is already present in LIVE history as `20261012203512`, except that LIVE deliberately omitted the hardcoded TEST U13 assignment. None of these three archives may be executed by the release worker.

Historical source files already on main are adopted as the current LIVE baseline using exact Git blob hashes in `release/legacy-baseline.json`. This does not mark unrecorded versions as applied. The first publication applies only the 34 separately reviewed, pending files in `release/live-plan.json`.
