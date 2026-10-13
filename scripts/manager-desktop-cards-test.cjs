const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const css = postcss.parse(fs.readFileSync('src/manager/managerDesktopWorkspace.css', 'utf8'));
let scheduleShell = false, backdrop = false, trainer = false;
css.walkRules(rule => {
  if (!rule.selector.includes('data-manager-schedule-card') && !rule.selector.includes('data-trainer-card')) return;
  assert.equal(rule.parent.type, 'atrule');
  assert.equal(rule.parent.params, '(min-width: 768px)', 'Card overrides must not affect mobile');
  if (rule.selector.includes('data-manager-schedule-card')) {
    assert(rule.selector.includes('.schedule-page'), 'Feed cards must keep their existing presentation');
    if (rule.selector.endsWith('[data-manager-schedule-card]')) {
      assert(rule.nodes.some(d => d.prop === 'background' && d.value === '#fff' && d.important));
      scheduleShell = true;
    }
    if (rule.selector.includes('sz-club-schedule-hero-backdrop')) {
      assert(rule.nodes.some(d => d.prop === 'display' && d.value === 'none' && d.important));
      backdrop = true;
    }
  }
  if (rule.selector.endsWith('[data-trainer-card]')) {
    assert(rule.nodes.some(d => d.prop === 'background' && d.value === '#fff' && d.important));
    trainer = true;
  }
});
assert(scheduleShell && backdrop && trainer);
async function renderCheck() {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-desktop-cards-'));
const out = path.join(dir, 'render.cjs');
await esbuild.build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import { SessionViewProvider } from './src/auth/useSession';
    import { MatchCardLigaportal } from './src/app/components/MatchCardLigaportal';
    import { EventHeroCard } from './src/components/schedule/EventHeroCard';
    import { ScheduleHeroEventCard } from './src/components/schedule/ScheduleHeroEventCard';
    import { PastMatchResultCard } from './src/components/schedule/PastMatchResultCard';
    import { TeamTrainerShowcase } from './src/components/team/TeamTrainerShowcase';
    const event = { id:'fixture', team_season_id:'fixture-season', kind:'match', type:'game',
      starts_at:'2026-10-13T15:00:00Z', status:'finished', opponent:'Gastverein', is_home:true,
      match_type:'league', location:'Sportplatz', title:'Training', match_id:null };
    export const render = () => renderToStaticMarkup(<SessionViewProvider value={{user:null,effectiveRole:'fan'}}><MemoryRouter initialEntries={['/manager/termine']}>
      <EventHeroCard label="Nächstes Spiel"><MatchCardLigaportal ourTeamName="Testverein" opponent="Gastverein"
        startsAt={event.starts_at} isHome status="upcoming" kind="match" eventType="game"
        scheduleNextMatchHero role="trainer" /></EventHeroCard>
      {['training','tournament','event'].map(et => <ScheduleHeroEventCard key={et} ev={event} et={et}
        ourTeamName="Testverein" showMeetup={false} />)}
      <PastMatchResultCard ev={event} ourTeamName="Testverein" scoreHome={1} scoreAway={2}
        forcePublicView onNavigate={()=>{}} />
      <PastMatchResultCard compact ev={event} ourTeamName="Testverein" scoreHome={1} scoreAway={2}
        forcePublicView onNavigate={()=>{}} />
      <TeamTrainerShowcase trainers={[{user_id:'fixture-coach',first_name:'Test',last_name:'Trainer',role:'trainer'}]}
        onTrainerClick={()=>{}} />
    </MemoryRouter></SessionViewProvider>);
  ` },
  bundle:true, platform:'node', format:'cjs', outfile:out, logLevel:'silent',
  define:{'import.meta.env':'{}'},
  plugins:[{name:'no-network',setup(b){b.onLoad({filter:/supabaseClient\.ts$/},()=>({contents:'export const supabase={};',loader:'js'}));}}],
});
try {
  const html = require(out).render();
  assert.equal((html.match(/data-manager-schedule-card/g) ?? []).length, 7,
    'Upcoming match, hero frame, training, tournament, event and both result layouts need light surfaces');
  assert(html.includes('data-trainer-card') && html.includes('Test') && html.includes('Trainer'));
  console.log('PASS desktop card surfaces: all event/result layouts, trainer portrait, desktop-only scope and unchanged feed scope');
} finally { fs.rmSync(dir, {recursive:true, force:true}); }
}
renderCheck().catch(error => { console.error(error); process.exitCode = 1; });
