import type { Match, MatchEvent } from '../types/match';
import type { PlayerMatchStats } from '../types/stats';

interface InternalPlayerMinutes {
  isStarting: boolean;
  subInMinutes: number[];
  subOutMinutes: number[];
}

export function computePlayerMatchStats(match: Match): PlayerMatchStats[] {
  const statsMap = new Map<string, PlayerMatchStats>();
  const minutesMap = new Map<string, InternalPlayerMinutes>();

  const allPlayers = [
    ...match.home.players.map((p) => ({ ...p, teamId: match.home.id })),
    ...match.away.players.map((p) => ({ ...p, teamId: match.away.id })),
  ];

  const homeStarting = new Set(match.lineup.homeStarting);
  const awayStarting = new Set(match.lineup.awayStarting);

  for (const player of allPlayers) {
    statsMap.set(player.id, {
      playerId: player.id,
      teamId: player.teamId,
      goals: 0,
      yellow: 0,
      red: 0,
      subIn: 0,
      subOut: 0,
      minutesPlayed: 0,
    });

    const isStarting =
      (player.teamId === match.home.id && homeStarting.has(player.id)) ||
      (player.teamId === match.away.id && awayStarting.has(player.id));

    minutesMap.set(player.id, {
      isStarting,
      subInMinutes: [],
      subOutMinutes: [],
    });
  }

  const events: MatchEvent[] = match.events ?? [];

  for (const event of events) {
    if (event.type === 'goal' && event.playerId) {
      const s = statsMap.get(event.playerId);
      if (s) {
        s.goals += 1;
      }
    }

    if (event.type === 'card' && event.playerId) {
      const s = statsMap.get(event.playerId);
      if (s) {
        if (event.cardType === 'yellow') {
          s.yellow += 1;
        } else if (event.cardType === 'red') {
          s.red += 1;
        }
      }
    }

    if (event.type === 'sub') {
      if (event.playerInId) {
        const sIn = statsMap.get(event.playerInId);
        if (sIn) {
          sIn.subIn += 1;
        }
        if (event.minute != null) {
          const mIn = minutesMap.get(event.playerInId);
          if (mIn) {
            mIn.subInMinutes.push(event.minute);
          }
        }
      }
      if (event.playerOutId) {
        const sOut = statsMap.get(event.playerOutId);
        if (sOut) {
          sOut.subOut += 1;
        }
        if (event.minute != null) {
          const mOut = minutesMap.get(event.playerOutId);
          if (mOut) {
            mOut.subOutMinutes.push(event.minute);
          }
        }
      }
    }
  }

  let endMinuteGlobal: number = 0;
  const minutesInEvents = events
    .filter((e) => e.minute != null)
    .map((e) => e.minute as number);

  const finalWhistleWithMinute = events
    .filter((e) => e.type === 'final_whistle' && e.minute != null)
    .map((e) => e.minute as number);

  if (finalWhistleWithMinute.length > 0) {
    endMinuteGlobal = Math.max(...finalWhistleWithMinute);
  } else if (match.timer) {
    let totalSeconds = match.timer.accumulatedSeconds;
    if (match.timer.isRunning && match.timer.startedAtISO) {
      const startMs = new Date(match.timer.startedAtISO).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - startMs) / 1000));
      totalSeconds += diffSec;
    }
    endMinuteGlobal = Math.max(0, Math.floor(totalSeconds / 60));
  } else if (minutesInEvents.length > 0) {
    endMinuteGlobal = Math.max(...minutesInEvents);
  }

  for (const [playerId, minutesInfo] of minutesMap.entries()) {
    const stat = statsMap.get(playerId);
    if (!stat) continue;

    let minutesPlayed = 0;

    if (minutesInfo.isStarting) {
      const beginMinute = 0;
      const firstSubOut =
        minutesInfo.subOutMinutes.length > 0
          ? Math.min(...minutesInfo.subOutMinutes)
          : undefined;
      const endMinute = firstSubOut ?? endMinuteGlobal;
      minutesPlayed = Math.max(0, endMinute - beginMinute);
    } else if (minutesInfo.subInMinutes.length > 0) {
      const firstSubIn = Math.min(...minutesInfo.subInMinutes);
      const possibleEnds = minutesInfo.subOutMinutes.filter(
        (m) => m > firstSubIn,
      );
      const endMinuteFromSub =
        possibleEnds.length > 0 ? Math.min(...possibleEnds) : undefined;
      const endMinute = endMinuteFromSub ?? endMinuteGlobal;
      minutesPlayed = Math.max(0, endMinute - firstSubIn);
    } else {
      minutesPlayed = 0;
    }

    stat.minutesPlayed = minutesPlayed;
  }

  return Array.from(statsMap.values());
}

