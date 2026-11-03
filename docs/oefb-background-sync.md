# ÖFB fixture reconciliation

Existing imported games are matched by season, configured competition and exact ÖFB match ID. No games are matched by opponent name and no new calendar events are created. Only `Endstand` scores can finish a match. Native clocks/events, cancelled events, archived seasons and conflicting finished scores are protected.

The Manager ÖFB import page contains a per-season opt-in and status panel. Changing competition, source team name or age group disables the opt-in. Reusing the same source team in another enabled age group is rejected. Each environment's scheduler must be enabled separately; applying migrations alone does not enable it.

Database owner setup (use the origin belonging to that database):

```sql
select oefb_sync.configure('https://app.spielzeitapp.at');
```

`oefb-fixture-sync` runs each minute. Each tick performs at most two HTTPS requests with a 15-second timeout; rounds repeat after 15 minutes, failed requests after five minutes. Round zero discovers historical rounds so a postponed match is checked even when its original round is old. Larger numbers of configured competitions can increase the delay beyond 15 minutes. Requests use the existing fixed ÖFB results proxy. Data is consumed directly from the HTTPS response, never from pg_net's globally writable response tables. Private worker functions are unavailable to app roles.

Existing automatic scheduling posts update their date, time and generated caption when an upcoming imported game moves. Manually authored feed posts are unaffected.

Automatic results also create deduplicated result feed posts, honoring feed suppression records and preserving existing captions/scorers. Automatic source confirmations are labelled `oefb`; they do not impersonate a human approver. An existing match with a different finished score requires staff review. New fixtures still require the import preview. This job does not import lineups, substitutions or infer individual playing time.

Monitor as database owner:

```sql
select competition_id,round_id,last_success,last_error,next_at from oefb_sync.tasks order by competition_id,round_id;
select jobname,schedule,active from cron.job where jobname='oefb-fixture-sync';
select status,return_message,start_time from cron.job_run_details where jobid=(select jobid from cron.job where jobname='oefb-fixture-sync') order by start_time desc limit 5;
```

Pause globally using `cron.alter_job(jobid, active := false)` or disable individual seasons in the Manager. SQL regression checks: `supabase/tests/oefb_background_sync.sql` uses existing TEST fixtures and rolls all changes back. Frontend checks: `npm run typecheck`, `npm run build` and `node scripts/home-feed-chronology-test.mjs`.

## Independent team schedule (TEST)

The Manager now uses a single team-schedule configuration, independent of standings. Save the exact `vereine.oefb.at/.../Mannschaften/Saison-YYYY-YY/AGE/Spiele` URL and the team name as it appears in the schedule (without the age prefix). Choose schedule-only or schedule plus final results and enable it once. Saving disables the older competition worker for that season. Existing legacy settings remain in the database; their former panel is replaced.

The private `oefb_sync.schedules` queue uses the existing schedule parser. It validates the configured season and age group and requires an exact home/away team-name match before importing. New numeric ÖFB IDs create calendar fixtures, repeated IDs do not. Similar manual fixtures on the same day remain untouched instead of being linked by guesswork. Review such fixtures through the existing import preview. Manual kickoff overrides (different from `source_starts_at`), live clocks/events, nonzero unfinished scoreboards and conflicting final scores are preserved. Date/score conflicts appear in the Manager with a link to review the game. Matching values clear the conflict on the next successful reconciliation. Trainer notes, meeting times, venue overrides, lineups and substitutions are never replaced by this worker.

Enable the environment-owned schedule separately, after confirming `oefb_sync.config.origin`:

```sql
select cron.schedule('oefb-mannschaftsspielplan-sync','* * * * *','select oefb_sync.tick_schedule();');
```

Each tick processes up to two configured schedules; successes repeat after 15 minutes, errors after five. Requests have 15-second timeouts. Exact source failures appear in the Manager; no result is erased. TEST Rohrbach U13 is configured. Other seasons are not enabled implicitly. The second job must not be automatically enabled in LIVE by migration deployment.

Checks: `supabase/tests/safe_oefb_schedule_sync.sql` (rollback), existing background-sync regression, real Rohrbach source response in a rollback, project typecheck/build. Source confirmations and private worker permissions follow the original guards above. No browser/iPhone visual verification was performed.
