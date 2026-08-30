/** Typen für die öffentliche Trainer-Demo (keine DB-IDs echter Teams). */

export type DemoPlayerPosition = 'TW' | 'AV' | 'IV' | 'ZM' | 'OM' | 'ST';

export type DemoRsvp = 'yes' | 'no' | 'open';

export type DemoEventKind = 'training' | 'game' | 'tournament' | 'event' | 'info';

export type DemoFeedKind =
  | 'season_start'
  | 'training'
  | 'schedule_change'
  | 'squad'
  | 'lineup'
  | 'result'
  | 'tournament_result'
  | 'challenge'
  | 'photo'
  | 'next_training';

export type DemoPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  lastInitial: string;
  position: DemoPlayerPosition;
  jersey: number;
  available: boolean;
  trainingPct: number;
  appearances: number;
  goals: number;
  /** Immer true für Demo-Personen (KI-generiert). */
  aiGenerated: true;
};

export type DemoEvent = {
  id: string;
  kind: DemoEventKind;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  meetingAt?: string | null;
  location: string;
  opponent?: string | null;
  isHome?: boolean | null;
  rsvpYes: number;
  rsvpNo: number;
  rsvpOpen: number;
  notes?: string | null;
  linkedTrainingId?: string | null;
};

export type DemoFeedItem = {
  id: string;
  kind: DemoFeedKind;
  title: string;
  body: string;
  createdAt: string;
};

export type DemoTrainingPart = {
  id: string;
  phase: 'AW' | 'HT1' | 'HT2' | 'AK';
  title: string;
  minutes: number;
  organization: string;
  goal: string;
  material: string;
  coaching: string[];
};

export type DemoTraining = {
  id: string;
  title: string;
  durationMin: number;
  status: 'geplant' | 'durchgeführt';
  eventId: string;
  parts: DemoTrainingPart[];
  note: string;
  present: number;
  absent: number;
};

export type DemoLineupSlot = {
  playerId: string;
  role: 'start' | 'bench';
  positionLabel: string;
};

export type DemoTournamentTeam = {
  id: string;
  name: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
};

export type DemoTournamentMatch = {
  id: string;
  home: string;
  away: string;
  kickoff: string;
  scoreHome: number | null;
  scoreAway: number | null;
};

export type DemoLiveEvent = {
  id: string;
  minute: number;
  text: string;
  type: 'kickoff' | 'goal_home' | 'goal_away' | 'sub' | 'halftime' | 'fulltime' | 'info';
};

export type DemoLiveState = {
  homeName: string;
  awayName: string;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  status: 'live' | 'finished';
  events: DemoLiveEvent[];
};

export type DemoFixtures = {
  teamName: string;
  seasonLabel: string;
  clubColors: string[];
  players: DemoPlayer[];
  events: DemoEvent[];
  feed: DemoFeedItem[];
  training: DemoTraining;
  lineup: DemoLineupSlot[];
  formation: string;
  eventDetail: DemoEvent;
  tournament: {
    name: string;
    location: string;
    teams: DemoTournamentTeam[];
    matches: DemoTournamentMatch[];
    squadPlayerIds: string[];
  };
  liveInitial: DemoLiveState;
};
