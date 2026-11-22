export function readTournamentMatchDecision(periodScores) {
  const decision = periodScores?.tournamentDecision;
  const extra = decision?.extraTime;
  const shootout = decision?.shootout;
  const attempts = Array.isArray(shootout?.attempts)
    ? shootout.attempts.filter(attempt =>
        (attempt?.side === 'home' || attempt?.side === 'away') &&
        (attempt.outcome === 'goal' || attempt.outcome === 'miss'))
      .map(({ side, outcome }) => ({ side, outcome }))
    : [];
  return {
    extraTime: Number.isInteger(extra?.startSecond) && extra.startSecond >= 0 &&
      Number.isInteger(extra?.minutes) && extra.minutes >= 1 && extra.minutes <= 30
      ? { startSecond: extra.startSecond, minutes: extra.minutes } : null,
    shootout: Number.isInteger(shootout?.home) && shootout.home >= 0 &&
      Number.isInteger(shootout?.away) && shootout.away >= 0
      ? { home: shootout.home, away: shootout.away, attempts } : null,
  };
}

export function recordShootoutAttempt(shootout, attempt) {
  return {
    ...shootout,
    [attempt.side]: shootout[attempt.side] + (attempt.outcome === 'goal' ? 1 : 0),
    attempts: [...shootout.attempts, attempt],
  };
}

export function undoShootoutAttempt(shootout) {
  const attempt = shootout.attempts.at(-1);
  if (!attempt) return shootout;
  return {
    ...shootout,
    [attempt.side]: Math.max(0, shootout[attempt.side] - (attempt.outcome === 'goal' ? 1 : 0)),
    attempts: shootout.attempts.slice(0, -1),
  };
}
