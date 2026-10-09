import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(relative, stubs = {}) {
  const code = fs.readFileSync(new URL(relative, import.meta.url), 'utf8').replaceAll('import.meta', '({env:{BASE_URL:"/",DEV:false}})');
  const output = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: id => id.endsWith('.css') ? {} : stubs[id] ?? require(id) });
  return module.exports;
}
const { ResultPosterArtwork } = load('../src/components/feed/ResultPosterArtwork.tsx', {
  '../../lib/teamLogos': { getClubLogo: () => '/logos/placeholder-shield-a.png' },
});
const { formatPeriodScoresBracketFromRaw } = load('../src/lib/matchEventScores.ts');
const periods = formatPeriodScoresBracketFromRaw({ p1: { h: 0, a: 3 }, p2: { h: 2, a: 2 }, p3: { h: 1, a: 1 } });
assert.equal(periods, '(0:3 | 2:2 | 1:1)');
const common = { ageGroup: 'U12', competition: 'Meisterschaftsspiel', periods, date: 'Di. 06.10.2026', venue: 'Sportplatz Rohrbach', scorers: [{ playerName: 'Demo Spieler', detail: '25′ · 58′' }] };
for (const [home, away, isHome, state] of [[4,1,true,'win'],[1,4,false,'win'],[2,2,true,'draw'],[1,3,true,'loss'],[3,1,false,'loss'],[0,0,false,'draw'],[12,0,true,'win']]) {
  const html = renderToStaticMarkup(React.createElement(ResultPosterArtwork, { ...common, payload: { home_score:home, away_score:away, is_home:isHome, home_team_name:'SPG Rohrbach', away_team_name:'SPG Bischofstetten', home_logo_url:'/logos/nsg-goelsental.png', away_logo_url:'/logos/bischofstetten.png' } }));
  assert.ok(html.includes(`data-result-state="${state}"`));
  assert.ok(html.includes(periods));
  assert.ok(html.includes('/logos/nsg-goelsental.png') && html.includes('/logos/bischofstetten.png'));
  assert.equal(html.includes('result-poster-motif'), state !== 'loss');
  assert.equal(html.includes('result-poster--player'), state !== 'loss');
  assert.equal(html.includes('demo-result-celebration.webp'), state === 'win');
  assert.ok(html.includes('Demo Spieler') && html.includes('25′ · 58′'));
}
assert.equal(formatPeriodScoresBracketFromRaw(null), null);
const source = fs.readFileSync(new URL('../src/components/feed/ResultFeedPostCard.tsx', import.meta.url), 'utf8');
assert.ok(source.indexOf('if (hasCustomImage) {') < source.indexOf('<ResultPosterArtwork'));
assert.ok(source.includes('p.period_scores, p.is_home, p.match_type, teamLabel'));
console.log('result-poster-clean-test: OK (home/away, all outcomes, periods, original logos, custom media)');
const { demoFixtures } = load('../src/demo/demoFixtures.ts');
const demoTime = {
  demoMinutesFromNowIso: minutes => new Date(Date.now() + minutes * 60000).toISOString(),
  demoOffsetIso: days => new Date(Date.now() + days * 86400000).toISOString(),
};
const { buildDemoFeedPosts, buildDemoEvents } = load('../src/demo/demoDataSource.ts', {
  './demoFixtures': { demoFixtures }, './demoTime': demoTime,
  './demoTrainingStats': { buildDemoTrainingHistoryEventRows: () => [] },
});
const active = buildDemoFeedPosts().active;
assert.equal(active.find(p => p.kind === 'matchday').post.payload.matchday_player_image_url, '/avatars/demo/demo-player-upper-02.webp');
for (const event of buildDemoEvents().filter(e => e.kind === 'match')) {
  assert.ok(event.opponent_logo_url?.startsWith('/logos/'), `${event.id}: demo match logo survives EventRow conversion`);
}
for (const kind of ['matchday', 'squad', 'lineup', 'result']) assert.ok(active.some(p => p.kind === kind), kind);
const result = active.find(p => p.kind === 'result').post.payload;
assert.equal(result.result_state, 'win');
assert.equal(formatPeriodScoresBracketFromRaw(result.period_scores), '(1:0 | 1:1 | 1:0)');
const { SquadPosterArtwork } = load('../src/components/feed/SquadPosterArtwork.tsx', {
  './FeedClubName': { FeedClubName: ({ fullName }) => React.createElement('span', null, fullName) },
});
const squad = renderToStaticMarkup(React.createElement(SquadPosterArtwork, {
  left:{ name:'Demo Heim', logo:'/logos/nsg-goelsental.png' }, right:{ name:'Demo Gast', logo:'/logos/loosdorf.png' },
  ageGroup:'U12', players:demoFixtures.players.map(p => ({ player_id:p.id, name:`${p.firstName} ${p.lastName}`, jersey_number:p.jersey })),
  teamPhotoUrl:'/feed/demo-squad-huddle.webp',
}));
for (const p of demoFixtures.players) assert.ok(squad.includes(`${p.firstName} ${p.lastName}`));
assert.ok(squad.includes('KADER') && squad.includes('demo-squad-huddle.webp'));
console.log('demo-clean-feed-test: OK (all four active posts, winning result with periods, twelve full squad names)');

const allDemoPosts = [...active, ...buildDemoFeedPosts().historic];
assert.ok(!allDemoPosts.some(p => p.post.id === 'df-result-older'));
assert.ok(!allDemoPosts.some(p => JSON.stringify(p.post.payload).includes('SV Langenrohr')));
for (const id of ['df-training-preview', 'df-schedule-change', 'df-moment', 'df-tournament-info', 'df-parent-info', 'df-season-start']) assert.ok(!allDemoPosts.some(p => p.post.id === id));
const formations = load('../src/lib/matchFormations.ts');
const { LeibchenJersey } = load('../src/components/match/LeibchenJersey.tsx');
const { LineupPosterArtwork, buildPosterLineup } = load('../src/components/feed/LineupPosterArtwork.tsx', {
  '../../lib/lineupFeedTypes': { lineupFeedDisplayPlayerName: p => p.playerName || p.name },
  '../../lib/matchFormations': formations,
  '../match/LeibchenJersey': { LeibchenJersey },
});
const demoLineup = active.find(p => p.kind === 'lineup').post.payload;
for (const formation of Object.keys(formations.U11_FORMATIONS)) {
  const placed = buildPosterLineup(formation, demoLineup.lineup_players);
  assert.equal(placed.length, demoLineup.lineup_players.length);
  assert.equal(new Set(placed.map(s => s.slot)).size, placed.length);
  assert.equal(new Set(placed.map(s => s.player.player_id)).size, placed.length);
  assert.equal(placed.find(s => s.slot === 'GK').player.slot, 'GK');
}
assert.equal(buildPosterLineup('unknown', demoLineup.lineup_players), null);
assert.equal(buildPosterLineup('1-3-3', [...demoLineup.lineup_players, { ...demoLineup.lineup_players[0], player_id: 'extra' }]), null);
const lineupHtml = renderToStaticMarkup(React.createElement(LineupPosterArtwork, {
  left: {name: 'Demo Heim', logo: '/logos/nsg-goelsental.png'}, right: {name: 'Demo Gast', logo: '/logos/loosdorf.png'},
  ageGroup: 'U12', formation: demoLineup.formation, players: demoLineup.lineup_players, bench: demoLineup.bench_players,
}));
assert.ok(lineupHtml.includes('SYSTEM 1-3-3') && lineupHtml.includes('ERSATZBANK'));
assert.equal((lineupHtml.match(/data-slot=/g) || []).length, 7);
for (const p of [...demoLineup.lineup_players, ...demoLineup.bench_players]) assert.ok(lineupHtml.includes(p.playerName));
const lineupSource = fs.readFileSync(new URL('../src/components/feed/LineupFeedPostCard.tsx', import.meta.url), 'utf8');
assert.ok(lineupSource.indexOf('post.media_url?.trim()') < lineupSource.indexOf('<LineupPosterArtwork'));
console.log('lineup-pitch-demo-test: OK (all formations, unique slots, goalkeeper, full names, bench, custom media, no training feed posts)');

for (const file of ['lineupPoster.css', 'squadPoster.css', 'resultPoster.css']) {
  const css = fs.readFileSync(new URL(`../src/components/feed/${file}`, import.meta.url), 'utf8');
  assert.ok(!css.includes('autopost-texture-v2.webp'), `${file}: no gritty background`);
  assert.ok(css.includes('repeating-radial-gradient(ellipse at 120% 58%'), `${file}: clean curved-line background`);
}
console.log('clean-poster-background-test: OK (all four poster kinds, no gritty texture)');
const lineupCss = fs.readFileSync(new URL('../src/components/feed/lineupPoster.css', import.meta.url), 'utf8');
assert.match(lineupCss, /\.lineup-poster-player \{[^}]*z-index: 2;[^}]*object-fit: contain;/);
assert.match(lineupCss, /\.lineup-poster-tactics \{[^}]*width: 68%;/);
assert.match(lineupCss, /\.lineup-poster-pitch \{[^}]*height: 50cqw;/);
console.log('lineup-portrait-lane-test: OK (foreground portrait, narrower and shorter pitch)');
