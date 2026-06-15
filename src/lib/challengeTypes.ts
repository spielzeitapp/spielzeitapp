import type { PlayerItem } from '../hooks/usePlayers';

export type ChallengeSessionStatus = 'draft' | 'active' | 'closed';

export type ChallengeSessionRow = {
  id: string;
  team_season_id: string;
  type: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: ChallengeSessionStatus;
  min_start_for_percent: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ChallengeResultRow = {
  id: string;
  challenge_id: string;
  player_id: string;
  start_value: number;
  end_value: number | null;
  notes: string | null;
  recorded_by: string | null;
  updated_at: string;
};

export type JugglingChallengePlayerRow = {
  player: PlayerItem;
  resultId: string | null;
  startValue: number;
  endValue: number | null;
  notes: string | null;
};

export type ChallengeScoringRow = {
  playerId: string;
  playerName: string;
  startValue: number;
  endValue: number;
  absoluteImprovement: number;
  percentImprovement: number | null;
  rank: number;
};

export type JugglingAwards = {
  king: ChallengeScoringRow | null;
  riser: ChallengeScoringRow | null;
  development: ChallengeScoringRow | null;
};
