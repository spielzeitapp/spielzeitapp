import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const React = require('react');
const { create, act } = require('react-test-renderer');
globalThis.fetch = async () => ({ ok: false });
const compiled = await build({
  entryPoints: ['src/components/team/SeasonMatchCard.tsx'], bundle: true,
  platform: 'node', format: 'cjs', packages: 'external', write: false,
  define: { 'import.meta.env.BASE_URL': '"/"' },
  plugins: [{ name: 'fixtures', setup(api) {
    api.onResolve({ filter: /seasonMatchStats$/ }, () => ({ path: 'stats', namespace: 'fixture' }));
    api.onResolve({ filter: /clubBranding$/ }, () => ({ path: 'brand', namespace: 'fixture' }));
    api.onResolve({ filter: /useClubOpponentLogos$/ }, () => ({ path: 'catalog', namespace: 'fixture' }));
    api.onResolve({ filter: /demoPaths$/ }, () => ({ path: 'base', namespace: 'fixture' }));
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents:
      path === 'stats' ? 'export const seasonMatchCardHref=()=>null;' :
      path === 'base' ? 'export const useInternalBasePath=()=>"/app";' :
      path === 'catalog' ? 'export const useClubOpponentLogos=()=>new Map([["FSG Ernstbrunn", "/logos/ernstbrunn.png"]]);export const preferredClubLogo=(name,map)=>map.get(name);' :
      'export const getClubBrandingForTeamSeason=async id=>({data:{logo_url:`/logos/${id}.png`,primary_color:"#164A9D",accent_color:"#F5C400"}});export const hexToRgbChannels=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)).join(" ");export const readableAccentOnDark=hexToRgbChannels;export const readableTextColor=()=>"#fff";'
    }));
  } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(require, module, module.exports);
const { MemoryRouter } = require('react-router-dom');
const match = { id: 'game', teamSeasonId: 'melk', eventId: null, opponent: 'Melk II', isHome: true,
  match_date: '2026-09-26T11:30:00Z', displayStatus: 'win', outcome: 'win', score_home: 4, score_away: 1 };
const render = m => React.createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
  React.createElement(module.exports.SeasonMatchCard, { match: m, ourTeamName: 'SC Melk FR', variant: 'appearance' }));
let root;
await act(async () => { root = create(render(match)); });
assert.deepEqual(root.root.findAllByType('img').map(n => n.props.src), ['/logos/melk.png', '/logos/melk.png']);
const card = root.root.findAllByType('div').find(n => n.props.style?.['--match-primary']);
assert.equal(card.props.style['--club-primary-rgb'], '22 74 157');
assert.equal(card.props.style['--club-accent-text-rgb'], '245 196 0');
await act(async () => root.update(render({ ...match, teamSeasonId: 'other', isHome: false, opponent: 'FSG Ernstbrunn' })));
assert.deepEqual(root.root.findAllByType('img').map(n => n.props.src), ['/logos/ernstbrunn.png', '/logos/other.png']);
assert.ok(!JSON.stringify(root.toJSON()).includes('/logos/melk.png'), 'club change discards the previous logo');
await act(async () => root.unmount());
console.log('PASS: appearance cards use their season logo/colors, reuse reserve-team crests, retain catalog opponents and clear stale logos.');
