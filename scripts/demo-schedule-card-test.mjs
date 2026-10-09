import assert from 'node:assert/strict';
import fs from 'node:fs';

const schedule = fs.readFileSync(new URL('../src/pages/SchedulePage.tsx', import.meta.url), 'utf8');
const liveStart = schedule.indexOf('const runtime = getDemoLiveRuntimeSnapshot();', schedule.indexOf('const [activeScheduleLive,'));
const demoLive = schedule.slice(liveStart, schedule.indexOf('let cancelled = false;', liveStart));
assert.match(demoLive, /homeLogoUrl: isHome \? getClubLogo\(ourTeamName, \{ ourTeam: true \}\)/);
assert.match(demoLive, /awayLogoUrl: isHome \? getClubLogo\(opponent, \{ logoUrl: ev\?\.opponent_logo_url \}\)/);
assert.ok(!demoLive.includes('LogoUrl: null'));
const card = fs.readFileSync(new URL('../src/components/schedule/ScheduleActiveLiveCard.tsx', import.meta.url), 'utf8');
assert.ok(!card.includes('truncate'));
assert.equal((card.match(/break-words text-center/g) || []).length, 2);
assert.match(schedule, /<MatchCardLigaportal/);
assert.match(schedule, /<PastMatchResultCard/);
console.log('demo-schedule-card-test: OK (home/away logos, full team names, shared regular/result cards)');
