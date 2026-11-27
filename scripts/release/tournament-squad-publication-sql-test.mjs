// Isolated PostgreSQL rehearsal. PGLITE_MODULE points at an external PGlite installation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
const id = (n) => `50000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [trainer, parent, playerUser, otherParent, outsider, team, season, event, first, second, extra, matchEvent] =
  Array.from({ length: 12 }, (_, index) => id(index + 1));

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    grant usage on schema auth to authenticated, anon;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.uid', true), '')::uuid$$;
    create table teams(id uuid primary key);
    create table team_seasons(id uuid primary key, team_id uuid references teams, status text);
    create table events(id uuid primary key, team_season_id uuid references team_seasons, kind text,
      status text, notes text, opponent text, tournament_completed_at timestamptz);
    create table memberships(user_id uuid, team_season_id uuid, role text);
    create function public.is_platform_admin() returns boolean language sql stable as $$select false$$;
    create function public.membership_is_staff_for_team_season(p_season uuid) returns boolean
      language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.memberships where team_season_id=p_season and user_id=auth.uid()
        and role in ('trainer','co_trainer','head_coach','admin'))$$;
    create table players(id uuid primary key, team_season_id uuid, is_active boolean, first_name text, last_name text);
    create table team_season_players(team_season_id uuid, player_id uuid, is_active boolean);
    create table tournament_squad(tournament_event_id uuid references events, player_id uuid references players,
      unique (tournament_event_id, player_id));
    create table player_guardians(player_id uuid, user_id uuid);
    create table player_users(player_id uuid, user_id uuid);
    create table team_feed_posts(team_season_id uuid, team_id uuid, event_id uuid, post_kind text,
      caption text, payload jsonb, dedupe_key text unique, created_by uuid, updated_at timestamptz);
    create table notification_jobs(id uuid primary key default gen_random_uuid(), event_id uuid, team_id uuid, kind text check (kind in ('event','match','training')),
      send_at timestamptz, payload jsonb, status text, dedupe_key text unique);
    create table notifications(user_id uuid, team_id uuid, event_id uuid, title text, message text, link text,
      type text, read boolean, event_type text, source_notification_job_id uuid references notification_jobs,
      unique (source_notification_job_id, user_id));
  `);
  await db.exec(readFileSync('supabase/migrations/20261127112516_tournament_squad_publication.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261127123804_tournament_squad_feed_only.sql', 'utf8'));
  await db.query('insert into teams values ($1)', [team]);
  await db.query("insert into team_seasons values ($1,$2,'active')", [season, team]);
  await db.query("insert into events(id,team_season_id,kind,status,notes) values ($1,$2,'tournament','upcoming','Hallencup · Halle'),($3,$2,'match','upcoming',null)", [event, season, matchEvent]);
  await db.query("insert into memberships values ($1,$2,'trainer'),($3,$2,'parent')", [trainer, season, parent]);
  await db.query("insert into players values ($1,$4,true,'Alex','A'),($2,$4,true,'Sam','B'),($3,null,true,'Robin','C')", [first, second, extra, season]);
  await db.query('insert into team_season_players values ($1,$2,true)', [season, second]);
  await db.query('insert into player_guardians values ($1,$3),($2,$3),($2,$4),($5,$6)', [first, second, parent, otherParent, extra, outsider]);
  await db.query('insert into player_users values ($1,$2),($1,$3)', [first, playerUser, parent]);

  const as = async (user, role = 'authenticated') => {
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.uid',$1,false)", [user]);
  };
  const save = (players, expected, eventId = event) =>
    db.query('select save_tournament_squad_draft($1,$2,$3)', [eventId, players, expected]);
  const publish = async (players, version, selected = 'Du bist dabei', eventId = event) =>
    (await db.query('select publish_tournament_squad($1,$2,$3,$4,$5) as result',
      [eventId, players, version, selected, 'Diesmal nicht im Kader'])).rows[0].result;

  await as(parent);
  await assert.rejects(save([first], []), /nicht bearbeitbar/);
  await assert.rejects(publish([first], 0), /nicht bearbeitbar/);
  await as(parent, 'anon');
  await assert.rejects(publish([first], 0), /permission denied/);
  await as(trainer);
  await assert.rejects(publish([], 0), /mindestens einen Spieler/);
  await assert.rejects(save([first], [], matchEvent), /nicht bearbeitbar/);
  await assert.rejects(save([extra], []), /außerhalb/);
  await save([first], []);
  await save([first], []);
  await assert.rejects(save([second], []), /inzwischen geändert/);
  await assert.rejects(publish([second], 0), /inzwischen geändert/);
  await assert.rejects(publish([first], 0, ' '.repeat(5)), /500 Zeichen/);
  await db.exec('reset role');
  assert.equal((await db.query('select * from team_feed_posts')).rows.length, 0);
  assert.equal((await db.query('select * from notification_jobs')).rows.length, 0);

  await as(trainer);
  assert.equal((await publish([first], 0)).version, 1);
  assert.equal((await publish([first], 0)).version, 1);
  await db.exec('reset role');
  const firstJobs = (await db.query('select payload from notification_jobs')).rows.map(row => row.payload);
  assert.equal(firstJobs.length, 2);
  assert.equal((await db.query('select * from notifications')).rows.length, 3);
  assert.deepEqual(firstJobs.find(job => job.pushBody === 'Du bist dabei').recipientUserIds, [parent, playerUser]);
  assert.deepEqual(firstJobs.find(job => job.pushBody === 'Diesmal nicht im Kader').recipientUserIds, [otherParent]);
  const firstPost = (await db.query('select * from team_feed_posts')).rows[0];
  assert.equal(firstPost.caption, 'Hallencup');
  assert.deepEqual(firstPost.payload.players, ['Alex A']);

  await as(trainer);
  await save([second], [first]);
  await assert.rejects(publish([second], 0), /inzwischen veröffentlicht/);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select payload from team_feed_posts')).rows[0].payload.players, ['Alex A']);
  await as(trainer);
  assert.equal((await publish([second], 1)).version, 2);
  await as(parent);
  assert.equal((await db.query('select * from tournament_squad_publications')).rows.length, 0);
  await db.exec('reset role');
  const posts = (await db.query('select * from team_feed_posts')).rows;
  assert.equal(posts.length, 1);
  assert.equal(posts[0].dedupe_key, firstPost.dedupe_key);
  assert.deepEqual(posts[0].payload.players, ['Sam B']);
  assert.equal((await db.query('select * from notification_jobs')).rows.length, 4);
  assert.equal((await db.query('select * from notifications')).rows.length, 6);
  await as(trainer);
  await save([first, second], [second]);
  const feedOnly = () => db.query('select publish_tournament_squad($1,$2,2,null,null) as result', [event, [first, second]]);
  await assert.rejects(publish([first, second], 2, null), /500 Zeichen/);
  assert.equal((await feedOnly()).rows[0].result.version, 3);
  assert.equal((await feedOnly()).rows[0].result.version, 3);
  await db.exec('reset role');
  const updatedPosts = (await db.query('select * from team_feed_posts')).rows;
  assert.equal(updatedPosts.length, 1);
  assert.deepEqual(updatedPosts[0].payload.players, ['Alex A', 'Sam B']);
  assert.equal((await db.query('select * from notification_jobs')).rows.length, 4);
  assert.equal((await db.query('select * from notifications')).rows.length, 6);
  console.log('PASS: tournament-only authorization, draft isolation, stale writes, deduplicated recipients and retry, single updated feed post, and feed-only publication with no notifications.');
} finally {
  await db.close();
}
