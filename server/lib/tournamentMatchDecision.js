export function readTournamentMatchDecision(periodScores) {
  const decision = periodScores?.tournamentDecision;
  const extra = decision?.extraTime;
  const shootout = decision?.shootout;
  return {
    extraTime: Number.isInteger(extra?.startSecond) && extra.startSecond >= 0 &&
      Number.isInteger(extra?.minutes) && extra.minutes >= 1 && extra.minutes <= 30
      ? { startSecond: extra.startSecond, minutes: extra.minutes } : null,
    shootout: Number.isInteger(shootout?.home) && shootout.home >= 0 &&
      Number.isInteger(shootout?.away) && shootout.away >= 0
      ? { home: shootout.home, away: shootout.away } : null,
  };
}
