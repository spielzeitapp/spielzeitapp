/**
 * MATCH-OPPONENT-LOGO.1 – Gegnerlogo bei normalen Spielen (Katalog + Formular).
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const catalog = read('src/lib/opponentCatalog.ts');
const createModal = read('src/app/components/CreateEventModal.tsx');
const eventDetail = read('src/pages/EventDetailPage.tsx');
const logoField = read('src/components/events/OpponentLogoField.tsx');
const champ = read('src/lib/championshipFixtures.ts');
const teamVenues = read('src/lib/teamVenues.ts');
const migration = read('supabase/migrations/20260803120000_opponent_catalog_and_logos.sql');

// 1–5: zentrale Architektur wiederverwendet
assert.ok(catalog.includes("uploadStorageObject('opponent-logos'"), 'bucket opponent-logos upload missing');
assert.ok(catalog.includes('OPPONENT_LOGO_MAX_BYTES'), 'max size guard missing');
assert.ok(catalog.includes('lookupOpponentCatalogLogo'), 'catalog lookup missing');
assert.ok(catalog.includes('syncOpponentLogoToTeamSeasonMatches'), 'season sync missing');
assert.ok(catalog.includes('setOpponentCatalogLogo'), 'catalog set missing');
assert.ok(!catalog.includes('image/svg'), 'SVG must not be newly enabled');

assert.ok(teamVenues.includes('function normalizeOpponentKey'), 'normalizeOpponentKey missing');
assert.ok(
  /trim\(\)[\s\S]*toLowerCase\(\)/.test(
    teamVenues.slice(
      teamVenues.indexOf('function normalizeOpponentKey'),
      teamVenues.indexOf('function normalizeOpponentKey') + 200,
    ),
  ),
  'normalizeOpponentKey must trim+lower',
);

assert.ok(migration.includes("opponent-logos"), 'migration bucket missing');
assert.ok(migration.includes('can_manage_club_venues'), 'storage RLS staff check missing');
assert.ok(migration.includes('opponent_catalog'), 'opponent_catalog table missing');

// Form create/edit
assert.ok(createModal.includes('OpponentLogoField'), 'CreateEventModal logo field missing');
assert.ok(createModal.includes('opponent_logo_url'), 'CreateEventModal must persist logo url');
assert.ok(createModal.includes('ensureOpponentCatalogEntry'), 'CreateEventModal catalog ensure missing');
assert.ok(createModal.includes('form.is_home'), 'home/away must remain');
assert.ok(
  createModal.indexOf('OpponentLogoField') < createModal.indexOf('Heim / Auswärts') ||
    createModal.includes('Heim / Auswärts'),
  'home/away UI must stay',
);

assert.ok(eventDetail.includes('OpponentLogoField'), 'EventDetail logo field missing');
assert.ok(eventDetail.includes('setOpponentLogoForSeason'), 'EventDetail season sync missing');
assert.ok(eventDetail.includes('editOpponentLogoUrl'), 'EventDetail logo state missing');
assert.ok(
  /kind === 'match' && editEvent\.is_home === true/.test(eventDetail) ||
    eventDetail.includes("editEvent.is_home === true"),
  'away match must not force venue assignment',
);

assert.ok(logoField.includes('Gegnerlogo hochladen'), 'upload CTA missing');
assert.ok(logoField.includes('Logo ändern'), 'change CTA missing');
assert.ok(logoField.includes('Logo entfernen'), 'remove CTA missing');
assert.ok(logoField.includes('uploadOpponentLogoFile'), 'reuse upload helper');
assert.ok(logoField.includes('onUploadError'), 'upload error must be isolated');

// Championship helper syncs all matches now
assert.ok(champ.includes('syncOpponentLogoToTeamSeasonMatches'), 'setOpponentLogoForSeason must sync matches');

// Tournament center not rewritten
const tournamentLogo = read('src/components/tournament/TournamentClubLogo.tsx');
assert.ok(tournamentLogo.includes('getClubLogo'), 'tournament logo helper unchanged');

console.log('match-opponent-logo1-test: OK');
