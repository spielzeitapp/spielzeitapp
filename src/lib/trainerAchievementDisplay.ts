import type { CoachSeasonAchievements, SeasonMatchSummary } from './seasonMatchStats';

export type AchievementHighlight = {
  title: string;
  value: string;
  sub: string;
};

export function buildTrainerAchievementHighlights(
  achievements: CoachSeasonAchievements,
  seasonSummary: SeasonMatchSummary,
): AchievementHighlight[] | null {
  if (seasonSummary.played === 0) return null;

  const winRate =
    achievements.winRatePct != null
      ? achievements.winRatePct
      : seasonSummary.played > 0
        ? 0
        : null;

  const winRateValue = winRate != null ? `${winRate} %` : '—';
  let winRateSub = `${seasonSummary.wins} Siege aus ${seasonSummary.played} Spiel${
    seasonSummary.played === 1 ? '' : 'en'
  }`;
  if (winRate === 100 && seasonSummary.losses === 0 && seasonSummary.draws === 0) {
    winRateSub = 'Saison bisher ungeschlagen';
  } else if (winRate === 100 && seasonSummary.losses === 0) {
    winRateSub = 'Noch ohne Niederlage';
  }

  const pointsSub =
    seasonSummary.played > 0
      ? `${seasonSummary.points} Punkte aus ${seasonSummary.played} Spiel${
          seasonSummary.played === 1 ? '' : 'en'
        }`
      : '—';

  const goalRatio =
    seasonSummary.goalsFor > 0 || seasonSummary.goalsAgainst > 0
      ? `${seasonSummary.goalsFor} : ${seasonSummary.goalsAgainst}`
      : '—';

  let goalSub = 'Ausgeglichen';
  if (seasonSummary.goalDifference > 0) {
    goalSub = `+${seasonSummary.goalDifference} Tore`;
  } else if (seasonSummary.goalDifference < 0) {
    goalSub = `${seasonSummary.goalDifference} Tore`;
  }

  const streakValue =
    achievements.longestWinStreak != null
      ? `${achievements.longestWinStreak} Spiel${achievements.longestWinStreak === 1 ? '' : 'e'}`
      : '—';

  const maxGoalsValue =
    achievements.maxGoalsInGame != null ? String(achievements.maxGoalsInGame) : '—';

  return [
    { title: 'Erfolgsbilanz', value: winRateValue, sub: winRateSub },
    { title: 'Punkte / Spiel', value: seasonSummary.pointsPerGame, sub: pointsSub },
    { title: 'Torverhältnis', value: goalRatio, sub: goalSub },
    { title: 'Siegesserie', value: streakValue, sub: 'Längste Siegesserie' },
    { title: 'Meiste Tore', value: maxGoalsValue, sub: 'Bestwert in einem Spiel' },
  ];
}
