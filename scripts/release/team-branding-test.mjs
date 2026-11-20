import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
const visibleTeam = '10000000-0000-0000-0000-000000000001';
const hiddenTeam = '10000000-0000-0000-0000-000000000002';
const sql = await readFile('supabase/migrations/20261120162000_team_branding_overrides.sql', 'utf8');
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table public.teams(id uuid primary key, visible boolean not null);
    insert into public.teams values ('${visibleTeam}',true),('${hiddenTeam}',false);
    alter table public.teams enable row level security;
    grant select on public.teams to authenticated;
    create policy visible_team on public.teams for select to authenticated using(visible);
  `);
  await db.exec(sql);
  await db.exec(sql);
  await db.exec('set role service_role');
  const setBranding = (id, color, logo = '/logos/nsg-goelsental.png') => db.query(
    "insert into public.team_branding_overrides values($1,$2,$3,'#FFFFFF','#FF4050')",
    [id, logo, color]
  );
  await assert.rejects(setBranding(visibleTeam, 'transparent'), { code: '23514' });
  await assert.rejects(setBranding(visibleTeam, '#7A1D2A', '//example.com/logo.png'), { code: '23514' });
  await setBranding(visibleTeam, '#7A1D2A');
  await setBranding(hiddenTeam, '#111111');
  await db.exec('set role authenticated');
  const read = () => db.query('select team_id from public.team_branding_overrides');
  assert.deepEqual((await read()).rows, [{ team_id: visibleTeam }]);
  await assert.rejects(db.query("update public.team_branding_overrides set accent_color='#000000'"), { code: '42501' });
  await db.exec('set role anon');
  await assert.rejects(read(), { code: '42501' });
  await db.exec('reset role');
  await db.query('delete from public.teams where id=$1', [visibleTeam]);
  assert.deepEqual((await read()).rows, [{ team_id: hiddenTeam }]);
  console.log('PASS team design validation, role permissions, team visibility, migration replay and cascade');
} finally {
  await db.close();
}
