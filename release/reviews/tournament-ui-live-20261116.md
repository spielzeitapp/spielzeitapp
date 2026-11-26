# Tournament LIVE release — 16 November 2026

Scope: selectively replay 30 tournament commits onto production 90db117b. Excludes unrelated marketplace, photo, season and manager changes. Concurrent uncommitted development work is untouched.

Includes readable fixtures and countdown, live/next match ordering, tournament lineup inheritance and manual block swaps, refresh retention, finished reports, actual imported crests, public QR/monitor/A4/A3 presentation, visible section navigation, scorers and shared read-only parent/fan overview. Removes redundant center subheader crest.

Validation: npm run build and npm run typecheck passed. Twelve executable tests passed: tournament-layout-flow, tournament-parent-actions, tournament-presentation, live-center-background-refresh, live-tournament-logo-display, tournament-blocks, tournament-assistant-ui, tournament-match-inheritance, public-tournament-standings, public-tournament-live-clock, tournament-imported-logos, meinturnierplan-compact-import. git diff --check passed. No physical iPhone verification performed in this release. Existing bundle size warning remains.

Database: production migration history already contains tournament_indoor_formations, tournament_connected_live, tournament_lineup_templates and tournament_template_roster_guards. Required tournament RPCs confirmed read-only. No migration or data write performed; no TEST records transferred. No migration allowlist changes required.

Merge resolution: logoResolver adds only canonical tournej tournament proxy validation; excludes unrelated develop ÖFB photo acceptance change.
