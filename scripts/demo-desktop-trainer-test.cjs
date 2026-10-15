const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-desktop-trainer-'));
  const outfile = path.join(dir, 'test.cjs');
  await esbuild.build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { MemoryRouter } from 'react-router-dom';
      import { DemoDesktopTrainerPage } from './src/demo/pages/DemoDesktopTrainerPage';
      import { createTrainingSessionHandoutHtml } from './src/lib/trainingSessionHandout';
      import * as data from './src/demo/demoDesktopTraining';
      export { data, createTrainingSessionHandoutHtml };
      export const render = () => renderToStaticMarkup(<MemoryRouter initialEntries={['/demo/desktop']}><DemoDesktopTrainerPage /></MemoryRouter>);
    ` },
    outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
    define: { 'import.meta.env': '{}' }, loader: { '.css': 'empty', '.ttf': 'file' },
    plugins: [{ name: 'reject-network', setup(build) {
      build.onLoad({ filter: /supabaseClient\.ts$/ }, () => ({
        contents: 'export const supabase = new Proxy({}, { get() { throw new Error("Demo must not access Supabase"); } });', loader: 'js',
      }));
    } }],
  });
  try {
    const { data, render, createTrainingSessionHandoutHtml } = require(outfile);
    const first = data.createDemoDesktopItems();
    const session = data.createDemoDesktopSession();
    assert.equal(first.length, 4);
    assert.equal(first.reduce((sum, i) => sum + i.duration_minutes, 0), 75);
    assert.deepEqual(first.map(i => i.phase), ['AW', 'HT1', 'HT2', 'AK']);
    first[0].duration_minutes = 99;
    session.title = 'Changed';
    assert.equal(data.createDemoDesktopItems()[0].duration_minutes, 15, 'Reset must create independent records');
    assert.equal(data.createDemoDesktopSession().title, 'Passspiel – Torabschluss – Umschalten');
    assert.equal(data.DEMO_DESKTOP_EXERCISES.length, 4);
    assert.equal(new Set(data.DEMO_DESKTOP_EXERCISES.map(e => e.id)).size, 4);
    for (const e of data.DEMO_DESKTOP_EXERCISES) {
      assert.equal(e.image_path, null, 'No storage object or child photo');
      assert(e.club_id.startsWith('desktop-demo-'));
      assert(!/https?:/.test(JSON.stringify(e)), 'No external source or video');
      assert(data.DEMO_DESKTOP_SKETCHES[e.id].startsWith('/demo/training-video/'));
      const image = fs.readFileSync(`public${data.DEMO_DESKTOP_SKETCHES[e.id]}`);
      assert.equal(image.readUInt16BE(0), 0xffd8, 'Each original sketch must be a real bundled JPEG');
      assert(image.length > 1000);
      assert(!/Baumann|Rohrbach|Loosdorf/.test(JSON.stringify(e)), 'No original personal/team data in demo seeds');
    }
    assert.deepEqual(data.createDemoDesktopItems().map(i => i.duration_minutes), [15, 20, 20, 20]);
    assert(data.DEMO_DESKTOP_EXERCISES[0].description.includes('Ablauf 2 (rechts)'));
    assert(data.DEMO_DESKTOP_EXERCISES[2].description.includes('Doppelpass'));
    const reversed = data.createDemoDesktopItems().reverse();
    assert.deepEqual(data.orderDemoDesktopItems(reversed).map(i => i.phase), ['AW', 'HT1', 'HT2', 'AK']);
    const exerciseMap = Object.fromEntries(data.DEMO_DESKTOP_EXERCISES.map(e => [e.id, e]));
    const html = createTrainingSessionHandoutHtml({
      session: { ...data.createDemoDesktopSession(), title: '<script>alert(1)</script>' },
      items: data.createDemoDesktopItems(), exerciseMap, sketchUrls: data.DEMO_DESKTOP_SKETCHES,
      teamName: 'FC Demoheim · fiktiv', trainerName: 'Markus Beispiel · Demo',
    });
    assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert(!html.includes('<script>alert(1)</script>'));
    assert(html.includes('FC Demoheim') && html.includes('Pass-Wettbewerb'));
    const rendered = render();
    assert(rendered.includes('Trainerdokumentation') && rendered.includes('Desktop-Demo'));
    assert(rendered.includes('beim Neuladen zurückgesetzt'));
    assert(rendered.includes('FC Demoheim') && !rendered.includes('Loosdorf'));
    const page = fs.readFileSync('src/demo/pages/DemoDesktopTrainerPage.tsx', 'utf8');
    assert(!/useSession|supabase\.|localStorage|sessionStorage|fetch\(/.test(page), 'Sandbox must not use real account or persist data');
    const app = fs.readFileSync('src/app/App.tsx', 'utf8');
    assert.equal((app.match(/path="desktop" element=\{<DemoDesktopTrainerPage/g) || []).length, 2, 'Both app/public hosts need a public demo route');
    console.log('PASS desktop demo: sandbox render without database, fictional seeds, independent reset, phase order, escaped handout, both public routes');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
