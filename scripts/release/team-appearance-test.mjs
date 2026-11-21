import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
const club = '10000000-0000-0000-0000-000000000001';
const team = '10000000-0000-0000-0000-000000000002';
const sibling = '10000000-0000-0000-0000-000000000003';
const otherClub = '10000000-0000-0000-0000-000000000004';
const nsg = { logo_url: '/logos/nsg-goelsental.png', primary_color: '#7A1D2A', secondary_color: '#FFFFFF', accent_color: '#FF4050' };

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT current_setting(''test.user_id'', true)::uuid';
    CREATE FUNCTION public.is_platform_admin() RETURNS boolean LANGUAGE sql AS 'SELECT current_setting(''test.admin'', true) = ''yes''';
    CREATE FUNCTION public.club_is_operable(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT $1 = ''${club}''::uuid';
    CREATE TABLE public.teams(id uuid PRIMARY KEY, club_id uuid NOT NULL, name text);
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit int, allowed_mime_types text[]);
    CREATE TABLE storage.objects(bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO authenticated;
    GRANT INSERT ON storage.objects TO authenticated;
    GRANT SELECT ON public.teams TO authenticated;
    INSERT INTO public.teams VALUES ('${team}', '${club}', 'SPG Rohrbach'), ('${sibling}', '${club}', 'U09');
    SET test.user_id = '10000000-0000-0000-0000-000000000005';
  `);
  const migration = await readFile('supabase/migrations/20261121080947_manager_team_appearance.sql', 'utf8');
  await db.exec(await readFile('supabase/migrations/20261120162000_team_branding_overrides.sql', 'utf8'));
  await db.query('INSERT INTO public.team_branding_overrides VALUES ($1,$2,$3,$4,$5)', [sibling, ...Object.values(nsg)]);
  await db.exec(migration);
  await db.exec(migration);
  const save = (branding, clubId = club) => db.query('SELECT public.admin_set_team_branding($1,$2,$3)', [clubId,team,branding]);
  const read = () => db.query('SELECT * FROM public.team_branding_overrides ORDER BY team_id');
  await db.exec('SET ROLE anon');
  await assert.rejects(save(nsg), { code: '42501' });
  await db.exec("SET ROLE authenticated; SET test.admin = 'no'");
  await assert.rejects(save(nsg), { code: '42501' });
  await db.exec("SET test.admin = 'yes'");
  await assert.rejects(save(nsg, otherClub), { code: '22023' });
  await save(nsg);
  assert.deepEqual((await read()).rows, [{ team_id: team, ...nsg }, { team_id: sibling, ...nsg }]);
  await save({ ...nsg, logo_url: null });
  assert.equal((await read()).rows[0].logo_url, null);
  const objectName = `${team}/10000000-0000-0000-0000-000000000006.webp`;
  const custom = { ...nsg, logo_url: `https://project.supabase.co/storage/v1/object/public/team-logos/${objectName}` };
  await assert.rejects(save(custom), { code: '22023' });
  await db.query("INSERT INTO storage.objects VALUES ('team-logos', $1)", [objectName]);
  await save(custom);
  assert.equal((await read()).rows[0].logo_url, custom.logo_url);
  await assert.rejects(save({ ...nsg, accent_color: 'red' }), { code: '23514' });
  assert.equal((await read()).rows[0].logo_url, custom.logo_url);
  await save(null);
  assert.deepEqual((await read()).rows, [{ team_id: sibling, ...nsg }]);
  console.log('PASS permissions, club scope, migration replay, NSG preset, logo upload, custom colors and team-only reset');
} finally {
  await db.close();
}
