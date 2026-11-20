import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const file = 'supabase/migrations/20261120155000_allow_same_team_name_across_age_groups.sql';
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function public.is_platform_admin() returns boolean language sql stable as
      $$select current_setting('test.role',true)='admin'$$;
    create function public.club_is_operable(uuid) returns boolean language sql stable as $$select true$$;
    create table public.teams(id uuid primary key,club_id uuid,name text,age_group text);
    create table public.seasons(id uuid primary key default gen_random_uuid(),name text,active boolean,created_at timestamptz default now());
    create table public.team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text,age_group text,display_name text);
    insert into public.seasons(id,name) values ('${id(1)}','2026/27'),('${id(2)}','2025/26');
    insert into public.teams values
      ('${id(10)}','${id(3)}','SPG Rohrbach','U12'),
      ('${id(11)}','${id(3)}','U10','U10'),
      ('${id(12)}','${id(3)}','U11','U11'),
      ('${id(13)}','${id(3)}','SPG Rohrbach','U09');
    insert into public.team_seasons values
      ('${id(20)}','${id(10)}','${id(1)}','active','U12',null),
      ('${id(21)}','${id(11)}','${id(1)}','active','U10',null),
      ('${id(22)}','${id(12)}','${id(1)}','active','U11',null),
      ('${id(23)}','${id(12)}','${id(2)}','archived','U09',null),
      ('${id(24)}','${id(13)}','${id(2)}','archived','U09',null);
    set test.uid='${id(4)}';
  `);
  await db.exec(await readFile(file, 'utf8'));
  const edit = (season, name, age, previous, previousAge) => db.query(
    'select public.admin_update_team_details($1,$2,$3,$4,$5,$6,$7,$5) as result',
    [id(3), id(season), name, age, '2026/27', previous, previousAge]
  );
  await db.exec("set role anon; set test.role='admin'");
  await assert.rejects(edit(21, 'SPG Rohrbach', 'U10', 'U10', 'U10'), { code: '42501' });
  await db.exec("reset role; set role authenticated; set test.role='parent'");
  await assert.rejects(edit(21, 'SPG Rohrbach', 'U10', 'U10', 'U10'), { code: '42501' });
  await db.exec("set test.role='admin'");
  await assert.rejects(edit(21, '', 'U10', 'U10', 'U10'), { code: '22023' });
  const { rows } = await edit(21, 'SPG Rohrbach', 'U10', 'U10', 'U10');
  assert.deepEqual(rows[0].result, { team_id: id(11), team_season_id: id(21) });
  await edit(21, 'SPG Rohrbach', 'U10', 'SPG Rohrbach', 'U10');
  await assert.rejects(edit(21, 'SPG Rohrbach', 'U10', 'U10', 'U10'), { code: '40001' });
  await assert.rejects(edit(21, ' spg rohrbach ', 'u12', 'SPG Rohrbach', 'U10'), { code: '23505' });
  await assert.rejects(edit(22, 'SPG Rohrbach', 'U11', 'U11', 'U11'), { code: '23505' });
  console.log('PASS same names across ages, unchanged IDs, authorization, retries, stale edits and archived conflicts');
} finally {
  await db.close();
}
