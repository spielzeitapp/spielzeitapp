import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [serviceSource, screenSource] = await Promise.all([
  readFile(new URL('../src/lib/liveMatchService.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/live/LiveMatchScreen.tsx', import.meta.url), 'utf8'),
]);

assert.match(
  serviceSource,
  /select\('is_home, opponent_logo_url'\)/,
  'Live match setup must load the stored opponent logo from the linked event.',
);
assert.match(
  screenSource,
  /getClubLogo\(headerOpponent, \{ logoUrl: opponentLogoUrl \?\? undefined \}\)/,
  'The live scoreboard must prefer the stored opponent logo over the name fallback.',
);
assert.match(
  screenSource,
  /sides\.isOwnTeamHome \? ownLogoSrc : opponentLogoSrc/,
  'The opponent logo must be assigned correctly for away matches.',
);

console.log('live opponent logo regression checks passed');
