/**
 * RESULT-FEED-OPPONENT-LOGO – Ergebnisposts verwenden das am Termin gespeicherte Gegnerlogo.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/lib/ensureResultFeedPost.ts'), 'utf8');

assert.ok(
  source.includes('opponent, opponent_logo_url'),
  'result feed event lookup must load opponent_logo_url',
);
assert.ok(
  source.includes("const opponentLogoUrl = ev.opponent_logo_url?.trim() || null"),
  'result feed must normalize the stored opponent logo',
);
assert.ok(
  source.includes('getClubLogo(sides.homeTeamName, { logoUrl: opponentLogoUrl })'),
  'away-match home logo must use the stored opponent logo',
);
assert.ok(
  source.includes('getClubLogo(sides.awayTeamName, { logoUrl: opponentLogoUrl })'),
  'home-match away logo must use the stored opponent logo',
);
assert.ok(
  source.includes('getClubLogo(sides.homeTeamName, { ourTeam: true })') &&
    source.includes('getClubLogo(sides.awayTeamName, { ourTeam: true })'),
  'our team logo must remain stable for home and away matches',
);

console.log('result-feed-opponent-logo-test: OK');
