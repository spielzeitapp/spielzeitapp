/**
 * tournament-live provider + MeinTurnierplan regression.
 * Run: node scripts/tournament-live-plan-provider-test.mjs
 */

import { isSupportedTournamentPlanHost, extractMeinTurnierplanId } from '../api/_lib/meinTurnierplanUrl.js';
import {
  analyzeTournamentPlanJson,
  parseMeinTurnierplanJson,
} from '../api/_lib/tournamentPlanJsonAnalyze.js';
import {
  extractTournamentLiveKeyFromUrl,
  isTournamentLiveHost,
} from '../api/_lib/tournamentLiveUrl.js';
import { parseTournamentLiveResults } from '../api/_lib/tournamentLiveAdapter.js';

const LIVE_URL = 'https://go.tournament-live.com/38331';
const LIVE_MOBILE_URL = 'https://mobile.tournament-live.com/steurergedenkturnier/gedenkturnier2026/all';
const MTP_URL = 'https://www.meinturnierplan.de/showit.php?id=1h42fr1f04';

let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`ok  ${message}`);
    return;
  }
  failed += 1;
  console.error(`fail ${message}`);
}

const MEIN_TURNIERPLAN_FIXTURE = {
  participants: {
    1: { name: 'NSG Rohrbach' },
    2: { name: 'Gegner A' },
  },
  groups: [{ displayId: 'A' }],
  groupParticipants: [[1, 2]],
  groupMatches: [
    {
      groupId: 0,
      dateAndTime: '2026-08-14 10:00',
      homeParticipant: 1,
      awayParticipant: 2,
      courtId: 0,
    },
  ],
  courts: [{ displayId: '1' }],
  groupMatchDuration: 10,
};

const LIVE_RESULTS_FIXTURE = [
  {
    items: [
      {
        type: 'groupAll',
        title: 'Alle Gruppen',
        scheduleItems: [
          {
            type: 'game',
            assignment1: 'Duplikat Heim',
            assignment2: 'Duplikat Gast',
            time: '09:00',
            gameField: '9',
          },
        ],
      },
      {
        type: 'groupSchedule',
        title: 'Gruppe 1',
        tableItems: [{ title: 'NSG Rohrbach/St. Veit' }, { title: 'Gegner A' }],
        scheduleItems: [
          {
            type: 'game',
            _id: 'g1',
            gameNumber: 1,
            assignment1: 'NSG Rohrbach/St. Veit',
            assignment2: 'Gegner A',
            time: '10:00',
            gameField: '1',
          },
        ],
      },
      {
        type: 'koSchedule',
        title: 'Finale',
        scheduleItems: [
          {
            type: 'game',
            _id: 'f1',
            gameNumber: 99,
            assignment1: 'Platz 1 - Gruppe 1',
            assignment2: 'Platz 1 - Gruppe 2',
            time: '16:00',
            gameField: '1',
          },
        ],
      },
    ],
  },
];

function mockMeinTurnierplanFetch(url) {
  const href = String(url);
  if (href.includes('json.php')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      url: href,
      json: async () => MEIN_TURNIERPLAN_FIXTURE,
    });
  }
  return Promise.resolve({
    ok: false,
    status: 404,
    url: href,
    json: async () => null,
  });
}

assert(isTournamentLiveHost(LIVE_URL), 'go.tournament-live.com wird als tournament-live erkannt');
assert(isTournamentLiveHost('https://mobile.tournament-live.com/steurergedenkturnier/gedenkturnier2026'), 'mobile.tournament-live.com wird erkannt');
assert(isTournamentLiveHost(LIVE_MOBILE_URL), 'mobile.tournament-live.com /all wird erkannt');
assert(isTournamentLiveHost('https://turnier.live/38331'), 'turnier.live wird defensiv erkannt');
assert(!isSupportedTournamentPlanHost(LIVE_URL), 'tournament-live ist kein MeinTurnierplan-Host');
assert(extractTournamentLiveKeyFromUrl(LIVE_URL).id === '38331', 'Turnier-ID 38331 aus Pfad');
assert(
  extractTournamentLiveKeyFromUrl('https://mobile.tournament-live.com/steurergedenkturnier/gedenkturnier2026').alias ===
    'gedenkturnier2026',
  'Alias aus mobile-URL',
);
assert(
  extractTournamentLiveKeyFromUrl(LIVE_MOBILE_URL).alias === 'gedenkturnier2026',
  'Alias aus mobile-URL mit /all Trailing-Segment',
);
assert(extractTournamentLiveKeyFromUrl(LIVE_MOBILE_URL).pageSlug === 'steurergedenkturnier', 'pageSlug aus mobile-URL mit /all');

assert(isSupportedTournamentPlanHost(MTP_URL), 'MeinTurnierplan-Host weiterhin erkannt');
assert(!isTournamentLiveHost(MTP_URL), 'MeinTurnierplan ist kein tournament-live-Host');
assert(extractMeinTurnierplanId(MTP_URL) === '1h42fr1f04', 'MeinTurnierplan-ID unverändert');

const parsedLive = parseTournamentLiveResults(LIVE_RESULTS_FIXTURE, { title: 'Testurnier', groupMinutes: 15, koMinutes: 15 });
assert(Boolean(parsedLive), 'Live-Fixture wird geparst');
assert(parsedLive?.provider === 'tournament-live', 'Provider tournament-live');
assert(parsedLive?.tournamentName === 'Testurnier', 'Turniername aus Meta');
assert(parsedLive?.teamCount === 2, 'Duplikat-Blöcke werden übersprungen, 2 Teams');
assert(parsedLive?.matchCount === 2, '1 Gruppen- + 1 KO-Spiel');
assert(
  parsedLive?.teams.some((t) => t.teamName === 'NSG Rohrbach/St. Veit'),
  'NSG Rohrbach/St. Veit als Teilnehmer',
);
assert(
  !parsedLive?.teams.some((t) => /platz 1/i.test(t.teamName)),
  'KO-Platzhalter werden nicht als Teams übernommen',
);
assert(parsedLive?.rawMatches.every((m) => Boolean(m.externalMatchId)), 'Live-Fixture hat externalMatchId');
assert(parsedLive?.rawMatches.some((m) => m.phase === 'final' && m.homeTeam.startsWith('Platz')), 'Finale bleibt als Spiel erhalten');

const parsedMtp = parseMeinTurnierplanJson(MEIN_TURNIERPLAN_FIXTURE);
assert(Boolean(parsedMtp), 'MeinTurnierplan-Fixture wird geparst');
assert(parsedMtp?.provider === 'meinturnierplan', 'Provider meinturnierplan');
assert(parsedMtp?.teamCount === 2, 'MeinTurnierplan Teams');
assert(parsedMtp?.matchCount === 1, 'MeinTurnierplan Spiele');
assert(parsedMtp?.teams.some((t) => t.teamName === 'NSG Rohrbach'), 'NSG Rohrbach im MeinTurnierplan-Fixture');

const mtpAnalyze = await analyzeTournamentPlanJson(MTP_URL, mockMeinTurnierplanFetch);
assert(mtpAnalyze.ok === true, 'MeinTurnierplan-Analyse über Dispatcher');
assert(mtpAnalyze.provider === 'meinturnierplan', 'Dispatcher belässt MeinTurnierplan');
assert(mtpAnalyze.extractedId === '1h42fr1f04', 'MeinTurnierplan-ID im Dispatcher');
assert(mtpAnalyze.analysis?.matchCount === 1, 'MeinTurnierplan Spiele über Dispatcher');

const liveAnalyze = await analyzeTournamentPlanJson(LIVE_URL);
assert(liveAnalyze.ok === true, 'Live-Turnier 38331 analysierbar');
assert(liveAnalyze.provider === 'tournament-live', 'Provider erkannt: tournament-live');
assert(liveAnalyze.extractedId === '38331', 'Turnier-ID: 38331');
assert(Boolean(liveAnalyze.analysis?.tournamentName), `Turniername erkannt (${liveAnalyze.analysis?.tournamentName ?? '—'})`);
assert((liveAnalyze.analysis?.teamCount ?? 0) >= 10, `Teilnehmer erkannt (${liveAnalyze.analysis?.teamCount ?? 0})`);
assert((liveAnalyze.analysis?.matchCount ?? 0) >= 27, `Spiele erkannt (${liveAnalyze.analysis?.matchCount ?? 0})`);
assert(
  liveAnalyze.analysis?.teams.some((t) => /rohrbach/i.test(t.teamName)),
  'NSG Rohrbach im Live-Turnier vorhanden',
);
const ownLiveMatches = (liveAnalyze.analysis?.rawMatches ?? []).filter((m) =>
  /rohrbach/i.test(m.homeTeam) || /rohrbach/i.test(m.awayTeam),
);
assert(ownLiveMatches.length >= 4, `eigene Spiele in Vorschau (${ownLiveMatches.length})`);
assert(
  (liveAnalyze.analysis?.rawMatches ?? []).every((m) => Boolean(m.externalMatchId)),
  'alle Live-Spiele haben externalMatchId',
);
assert(liveAnalyze.ok === true, 'Import möglich (Analyse vollständig)');

const liveMobileAnalyze = await analyzeTournamentPlanJson(LIVE_MOBILE_URL);
assert(liveMobileAnalyze.ok === true, 'Mobile-URL /all analysierbar');
assert(liveMobileAnalyze.provider === 'tournament-live', 'Mobile-URL Provider tournament-live');
assert((liveMobileAnalyze.analysis?.teamCount ?? 0) >= 10, `Mobile-URL Teilnehmer (${liveMobileAnalyze.analysis?.teamCount ?? 0})`);
assert((liveMobileAnalyze.analysis?.matchCount ?? 0) >= 27, `Mobile-URL Spiele (${liveMobileAnalyze.analysis?.matchCount ?? 0})`);
assert(
  (liveMobileAnalyze.analysis?.rawMatches ?? []).filter((m) => /rohrbach/i.test(m.homeTeam) || /rohrbach/i.test(m.awayTeam))
    .length >= 4,
  'Mobile-URL eigene Spiele',
);

if (failed > 0) {
  console.error(`\n${failed} Test(s) fehlgeschlagen`);
  process.exit(1);
}

console.log('\nAlle Tests ok');
