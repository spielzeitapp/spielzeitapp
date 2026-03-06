export type Team = {
  id: string;
  name: string;
};

export type MatchStatus = 'upcoming' | 'live' | 'finished';

export type Match = {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  time: string;
  home: boolean;
  location: string;
  status: MatchStatus;
  /** Player-of-the-Match Voting aktiv */
  motm_enabled?: boolean;
  /** Bis wann abgestimmt werden kann (ISO string); nach Ablauf oder bei status finished: Ergebnis anzeigen */
  motm_open_until?: string | null;
};

export const teams: Team[] = [{ id: 'u11', name: 'U11' }];

export const matches: Match[] = [
  {
    id: 'm1',
    teamId: 'u11',
    opponent: 'FC Beispielstadt',
    date: '2026-03-01',
    time: '10:30',
    home: true,
    location: 'Sportplatz Musterweg',
    status: 'upcoming',
  },
  {
    id: 'm2',
    teamId: 'u11',
    opponent: 'SV Nachbardorf',
    date: '2026-03-08',
    time: '11:00',
    home: false,
    location: 'Arena Nachbardorf',
    status: 'upcoming',
  },
  {
    id: 'm3',
    teamId: 'u11',
    opponent: 'TSG Altstadt',
    date: '2026-02-20',
    time: '09:45',
    home: true,
    location: 'Sportplatz Musterweg',
    status: 'finished',
  },
  {
    id: 'm4',
    teamId: 'u11',
    opponent: 'SC Jungtalente',
    date: '2026-02-25',
    time: '18:00',
    home: false,
    location: 'Stadion Jungtalente',
    status: 'finished',
  },
  {
    id: 'm5',
    teamId: 'u11',
    opponent: 'FC LiveMatch',
    date: '2026-02-11',
    time: '19:30',
    home: true,
    location: 'Flutlicht-Arena',
    status: 'live',
    motm_enabled: true,
  },
];

