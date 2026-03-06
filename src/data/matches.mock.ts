import type { Match, Player, Team, MatchEvent } from '../types/match';

const homePlayers: Player[] = [
  { id: 'h1', name: 'Max Torwart', number: 1, position: 'TW' },
  { id: 'h2', name: 'Leo Links', number: 2, position: 'LV' },
  { id: 'h3', name: 'Ben Rechts', number: 3, position: 'RV' },
  { id: 'h4', name: 'Jonas Mitte', number: 4, position: 'IV' },
  { id: 'h5', name: 'Tom Sechs', number: 6, position: 'DM' },
  { id: 'h6', name: 'Luca Acht', number: 8, position: 'ZM' },
  { id: 'h7', name: 'Finn Zehn', number: 10, position: 'OM' },
  { id: 'h8', name: 'Noah Flügel', number: 7, position: 'RA' },
  { id: 'h9', name: 'Mats Stürmer', number: 9, position: 'ST' },
  { id: 'h10', name: 'Emil Joker', number: 11, position: 'ST' },
  { id: 'h11', name: 'Paul Allrounder', number: 12 },
];

const awayPlayersA: Player[] = [
  { id: 'a1', name: 'Lennart Keeper', number: 1, position: 'TW' },
  { id: 'a2', name: 'Jan Verteidiger', number: 3 },
  { id: 'a3', name: 'Ole Verteidiger', number: 4 },
  { id: 'a4', name: 'Tim Sechser', number: 6 },
  { id: 'a5', name: 'Eric Achter', number: 8 },
  { id: 'a6', name: 'Nick Zehner', number: 10 },
  { id: 'a7', name: 'Timo Flügel', number: 7 },
  { id: 'a8', name: 'Kai Stürmer', number: 9 },
  { id: 'a9', name: 'Jannis Joker', number: 11 },
];

const awayPlayersB: Player[] = [
  { id: 'b1', name: 'Phil Tor', number: 1 },
  { id: 'b2', name: 'Robin LV', number: 2 },
  { id: 'b3', name: 'Nils RV', number: 3 },
  { id: 'b4', name: 'Moritz IV', number: 4 },
  { id: 'b5', name: 'Kian DM', number: 6 },
  { id: 'b6', name: 'Samir ZM', number: 8 },
  { id: 'b7', name: 'Anton OM', number: 10 },
  { id: 'b8', name: 'Jonah RA', number: 7 },
  { id: 'b9', name: 'Lio ST', number: 9 },
  { id: 'b10', name: 'Julius Joker', number: 11 },
];

const teamHome: Team = {
  id: 'home-u11',
  name: 'NSG Gölsental U11',
  shortName: 'NSG U11',
  players: homePlayers,
};

const teamAwayA: Team = {
  id: 'away-a',
  name: 'SV Nachbardorf U11',
  shortName: 'SVN U11',
  players: awayPlayersA,
};

const teamAwayB: Team = {
  id: 'away-b',
  name: 'FC Altstadt U11',
  shortName: 'FCA U11',
  players: awayPlayersB,
};

const eventsM2: MatchEvent[] = [
  {
    id: 'e1',
    type: 'kickoff',
    minute: 1,
    note: 'Anpfiff',
    timestampISO: '2026-02-20T18:15:00+01:00',
  },
  {
    id: 'e2',
    type: 'goal',
    minute: 8,
    teamId: teamHome.id,
    playerId: 'h9',
    note: 'Flachschuss ins Eck',
    timestampISO: '2026-02-20T18:23:00+01:00',
  },
  {
    id: 'e3',
    type: 'goal',
    minute: 18,
    teamId: teamAwayA.id,
    playerId: 'a8',
    note: 'Kontertor',
    timestampISO: '2026-02-20T18:33:00+01:00',
  },
  {
    id: 'e4',
    type: 'sub',
    minute: 25,
    teamId: teamHome.id,
    playerOutId: 'h2',
    playerInId: 'h11',
    note: 'Wechsel auf der Außenbahn',
    timestampISO: '2026-02-20T18:40:00+01:00',
  },
  {
    id: 'e5',
    type: 'goal',
    minute: 35,
    teamId: teamHome.id,
    playerId: 'h7',
    note: 'Direktabnahme',
    timestampISO: '2026-02-20T18:50:00+01:00',
  },
];

export const matchesMock: Match[] = [
  {
    id: 'm1',
    home: teamHome,
    away: teamAwayB,
    kickoffISO: '2026-03-01T10:30:00+01:00',
    status: 'planned',
    score: { home: 0, away: 0 },
    events: [],
    lineup: {
      homeStarting: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'],
      homeBench: ['h9', 'h10', 'h11'],
      awayStarting: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
      awayBench: ['b8', 'b9', 'b10'],
    },
    field: {
      home: {
        GK: 'h1',
        LB: 'h2',
        RB: 'h3',
        CM: 'h5',
        LW: 'h7',
        RW: 'h8',
        ST: 'h6',
      },
      away: {
        GK: 'b1',
        LB: 'b2',
        RB: 'b3',
        CM: 'b4',
        LW: 'b5',
        RW: 'b6',
        ST: 'b7',
      },
    },
    timer: {
      isRunning: false,
      startedAtISO: null,
      accumulatedSeconds: 0,
    },
  },
  {
    id: 'm2',
    home: teamHome,
    away: teamAwayA,
    kickoffISO: '2026-02-20T18:15:00+01:00',
    status: 'live',
    score: { home: 2, away: 1 },
    events: eventsM2,
    currentMinute: 38,
    period: 1,
    lineup: {
      homeStarting: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h9'],
      homeBench: ['h8', 'h10', 'h11'],
      awayStarting: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a8'],
      awayBench: ['a7', 'a9'],
    },
    field: {
      home: {
        GK: 'h1',
        LB: 'h2',
        RB: 'h3',
        CM: 'h5',
        LW: 'h7',
        RW: 'h6',
        ST: 'h9',
      },
      away: {
        GK: 'a1',
        LB: 'a2',
        RB: 'a3',
        CM: 'a4',
        LW: 'a5',
        RW: 'a6',
        ST: 'a8',
      },
    },
    timer: {
      isRunning: false,
      startedAtISO: null,
      accumulatedSeconds: 0,
    },
  },
];

