# ÖFB fixture reconciliation

Existing imported games are matched by season, configured competition and exact ÖFB match ID. No games are matched by opponent name and no new calendar events are created. Only `Endstand` scores can finish a match. Native clocks/events, cancelled events, archived seasons and conflicting finished scores are protected.

The Manager ÖFB import page contains a per-season opt-in and status panel. Changing competition, source team name or age group disables the opt-in. Reusing the same source team in another enabled age group is rejected. Each environment's scheduler must be enabled separately; applying migrations alone does not enable it.

Database owner setup (use the origin belonging to that database):

```sql
select oefb_sync.configure('https://app.spielzeitapp.at');
```

`oefb-fixture-sync` runs each minute. Each tick performs at most two HTTPS requests with a 15-second timeout; rounds repeat after 15 minutes, failed requests after five minutes. Round zero discovers historical rounds so a postponed match is checked even when its original round is old. Larger numbers of configured competitions can increase the delay beyond 15 minutes. Requests use the existing fixed ÖFB results proxy. Data is consumed directly from the HTTPS response, never from pg_net's globally writable response tables. Private worker functions are unavailable to app roles.

Automatic results also create deduplicated result feed posts, honoring feed suppression records and preserving existing captions/scorers. Automatic source confirmations are labelled `oefb`; they do not impersonate a human approver. An existing match with a different finished score requires staff review. New fixtures still require the import preview. This job does not import lineups, substitutions or infer individual playing time.

Monitor as database owner:

```sql
select competition_id,round_id,last_success,last_error,next_at from oefb_sync.tasks order by competition_id,round_id;
select jobname,schedule,active from cron.job where jobname='oefb-fixture-sync';
select status,return_message,start_time from cron.job_run_details where jobid=(select jobid from cron.job where jobname='oefb-fixture-sync') order by start_time desc limit 5;
```

Pause globally using `cron.alter_job(jobid, active := false)` or disable individual seasons in the Manager. SQL regression checks: `supabase/tests/oefb_background_sync.sql` uses existing TEST fixtures and rolls all changes back. Frontend checks: `npm run typecheck`, `npm run build` and `node scripts/home-feed-chronology-test.mjs`.
