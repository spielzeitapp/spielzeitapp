import { tournamentLogoUrl } from './tournamentTeamLogos.js';
/** Shared provider model: confirmed participants and projections stay distinct. */
const text = (value) => String(value ?? "").trim();
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const providerActive = (match) => [true, 1, '1'].includes(match?.isActive);
const hasScores = (match) => /^\d+$/.test(text(match?.score1)) && /^\d+$/.test(text(match?.score2));

// The provider can leave the last group game marked active during the final round.
export function supersededLiveMatches(matches, additionalProgress = []) {
  const candidates = [...matches, ...additionalProgress];
  const knownPitches = new Set(candidates.map(match => text(match.pitch).toLowerCase()).filter(Boolean));
  const pitchOf = match => text(match.pitch).toLowerCase() ||
    (knownPitches.size === 1 ? knownPitches.values().next().value : '');
  const timeOf = match => /^\d{2}:\d{2}$/.test(text(match.kickoffTimeHHmm)) ? match.kickoffTimeHHmm : '';
  const dated = candidates.every(match => !timeOf(match) || match.kickoffDate);
  const startOf = match => dated ? `${match.kickoffDate}T${timeOf(match)}` : timeOf(match);
  const latestByPitch = new Map();
  const priority = match => match.isLive ? match.local ? 2 : 1 : 0;

  for (const match of candidates) {
    if ((!match.isLive && !match.hasResult) || !timeOf(match)) continue;
    const pitch = pitchOf(match);
    if (!pitch && knownPitches.size > 1) continue;
    const start = startOf(match);
    const latest = latestByPitch.get(pitch);
    if (!latest || start > latest.start || (start === latest.start && (
      priority(match) > priority(latest.match) ||
      (priority(match) === priority(latest.match) && text(match.externalMatchId) > text(latest.match.externalMatchId))
    ))) latestByPitch.set(pitch, { start, match });
  }

  return new Set(matches.filter(match => {
    if (!match.isLive || !timeOf(match)) return false;
    const latest = latestByPitch.get(pitchOf(match));
    if (!latest || latest.match === match) return false;
    const start = startOf(match);
    return latest.start > start || (
      latest.start === start && latest.match.isLive &&
      (!match.externalMatchId || match.externalMatchId !== latest.match.externalMatchId)
    );
  }));
}

export function normalizeMeinTurnierplanLiveMatches(analysis, additionalProgress = []) {
  if (analysis?.provider !== 'meinturnierplan') return analysis;
  const matches = analysis.rawMatches ?? [];
  const superseded = supersededLiveMatches(matches, additionalProgress);
  if (!superseded.size) return analysis;
  return {
    ...analysis,
    rawMatches: matches.map(match => {
      if (!superseded.has(match)) return match;
      const { isLive, liveHomeGoals, liveAwayGoals, ...fixture } = match;
      const hasResult = liveHomeGoals != null && liveAwayGoals != null;
      return {
        ...fixture,
        hasResult,
        homeGoals: hasResult ? liveHomeGoals : null,
        awayGoals: hasResult ? liveAwayGoals : null,
      };
    }),
  };
}

export function meinTurnierplanLiveByMatchId(analysis) {
  const index = new Map();
  if (analysis?.provider !== 'meinturnierplan') return index;
  for (const match of normalizeMeinTurnierplanLiveMatches(analysis).rawMatches ?? []) {
    if (!match.isLive || !match.externalMatchId) continue;
    index.set(match.externalMatchId, match);
    index.set(`meinturnierplan:${match.externalMatchId}`, match);
  }
  return index;
}
export function resolveMeinTurnierplanFinalStandings(analysis) {
  const ranked = new Map();
  const teamRanks = new Map();
  const teamKey = teamName => text(teamName).toLocaleLowerCase('de');
  const canPlace = (rank, teamName) => Number.isSafeInteger(rank) && rank > 0 && teamName &&
    (!ranked.has(rank) || teamKey(ranked.get(rank)) === teamKey(teamName)) &&
    (!teamRanks.has(teamKey(teamName)) || teamRanks.get(teamKey(teamName)) === rank);
  const place = (rank, teamName) => {
    if (!ranked.has(rank)) ranked.set(rank, teamName);
    teamRanks.set(teamKey(teamName), rank);
  };

  for (const row of analysis.finalStandings ?? []) {
    const rank = Number(row.rank);
    const teamName = text(row.teamName);
    if (canPlace(rank, teamName)) place(rank, teamName);
  }

  if (analysis.provider === 'meinturnierplan') {
    for (const match of analysis.rawMatches ?? []) {
      const { homeGoals, awayGoals } = match;
      if (match.isLive || !match.hasResult || !Number.isInteger(homeGoals) ||
        !Number.isInteger(awayGoals) || homeGoals === awayGoals ||
        match.homeConfirmed === false || match.awayConfirmed === false) continue;
      const rank = match.phase === 'final' && match.roundLabel === 'Finale' ? 1
        : match.phase === 'placement' ? Number(match.roundLabel?.match(/^Spiel um Platz (\d+)$/)?.[1]) : NaN;
      const homeWins = homeGoals > awayGoals;
      const winner = text(homeWins ? match.homeTeam : match.awayTeam);
      const loser = text(homeWins ? match.awayTeam : match.homeTeam);
      if (teamKey(winner) === teamKey(loser) || !canPlace(rank, winner) || !canPlace(rank + 1, loser)) continue;
      place(rank, winner);
      place(rank + 1, loser);
    }
  }

  return [...ranked.entries()].sort(([a], [b]) => a - b).map(([rank, teamName]) => ({ rank, teamName }));
}

export function inferMeinTurnierplanPhase(mapping, a, b) {
  const round = num(mapping?.round),
    match = num(mapping?.match);
  if (round === 1) return match === 1 ? "final" : "placement";
  if (round === 2)
    return match > 2 ||
      (a?.type === "group" && num(a.rank) > 2) ||
      (b?.type === "group" && num(b.rank) > 2)
      ? "placement"
      : "semifinal";
  return "unknown";
}
export function parseMeinTurnierplanModel(json) {
  if (!json?.participants || !Array.isArray(json.groups)) return null;
  // Compact public plans use one league table without an explicit groups list.
  if (!json.groups.length) {
    const matches = json.groupMatches;
    if (!Array.isArray(matches) || !matches.length ||
        matches.some((m) => m.groupId != null && Number(m.groupId) !== 0)) return null;
    const ids = Object.keys(json.participants).filter((id) => text(json.participants[id]?.name));
    if (!ids.length) return null;
    json = { ...json, groups: [{ displayId: 'A' }], groupParticipants: [ids] };
  }
  const name = (id) => text(json.participants[id]?.name);
  const logo = (id) => {
    const participant = json.participants[id];
    for (const candidate of [participant?.logo?.lx160, participant?.logo?.lx160w,
      participant?.logo?.lx95, participant?.logo?.lx95w, participant?.logoUrl]) {
      const url = tournamentLogoUrl(candidate);
      if (url) return url;
    }
    return null;
  };
  const label = (i) => text(json.groups[i]?.displayId) || String(Number(i) + 1);
  // The public stadium page can omit groupParticipants even for multi-group plans.
  const participantIdsByGroup = json.groups.map((_, index) => {
    const supplied = json.groupParticipants?.[index]?.length
      ? json.groupParticipants[index]
      : (json.groupRankTables?.[index] ?? []).map(row => row.participant);
    const fixtures = (json.groupMatches ?? [])
      .filter(match => String(match.groupId ?? (json.groups.length === 1 ? 0 : '')) === String(index));
    return [...new Set([...supplied, ...fixtures.flatMap(match => [match.homeParticipant, match.awayParticipant])]
      .filter(id => name(id)).map(String))];
  });
  const teams = participantIdsByGroup.flatMap((ids, index) =>
    ids.map((id) => ({ teamName: name(id), groupLabel: label(index), ...(logo(id) ? { logoUrl: logo(id) } : {}) })),
  );
  if (!teams.length) return null;
  const groupStandings = json.groups.map((g, i) => ({
    groupLabel: label(i),
    rows: (json.groupRankTables?.[i]?.length ? json.groupRankTables[i] : participantIdsByGroup[i].map(participant => ({participant,rank:0})))
      .map((r) => ({
        teamName: name(r.participant),
        rank: num(r.rank),
        played: num(r.gameCount),
        wins: num(r.winCount),
        draws: num(r.drawCount),
        losses: num(r.loseCount),
        goalsFor: num(r.ownGoalCount),
        goalsAgainst: num(r.opponentGoalCount),
        goalDifference: num(r.goalDifference),
        points: num(r.points),
      }))
      .filter((r) => r.teamName),
  }));
  const source = (s) => {
    if (!s) return null;
    if (s.type === "group")
      return {
        type: "group",
        groupLabel: label(s.group),
        rank: num(s.rank),
        label: `${num(s.rank)}. Gruppe ${label(s.group)}`,
      };
    if (s.type === "knockout") {
      const prior = (json.finalMatches ?? []).find(
        (m) =>
          num(m.modeMapping?.round) === num(s.round) &&
          num(m.modeMapping?.match) === num(s.match),
      );
      return {
        type: "knockout",
        round: num(s.round),
        match: num(s.match),
        rank: num(s.rank),
        externalMatchId: prior
          ? `mtp-game-${prior.gameId ?? prior.displayId ?? `ko-${s.round}-${s.match}`}`
          : null,
        label: `${num(s.rank) === 1 ? "Sieger" : "Verlierer"} Spiel ${prior?.displayId ?? s.match}`,
      };
    }
    return null;
  };
  const projection = (s) => {
    if (s?.type === "group")
      return (
        groupStandings
          .find((g) => g.groupLabel === s.groupLabel)
          ?.rows.find((r) => r.rank === s.rank)?.teamName ?? null
      );
    if (s?.type === "knockout") {
      const prior = (json.finalMatches ?? []).find(
        (m) =>
          num(m.modeMapping?.round) === s.round &&
          num(m.modeMapping?.match) === s.match,
      );
      if (
        prior &&
        text(prior.score1) !== "" &&
        text(prior.score2) !== "" &&
        prior.score1 != null &&
        prior.score2 != null &&
        num(prior.score1) !== num(prior.score2)
      ) {
        const homeWins = num(prior.score1) > num(prior.score2);
        return (
          name(
            (s.rank === 1 ? homeWins : !homeWins)
              ? prior.homeParticipant
              : prior.awayParticipant,
          ) || null
        );
      }
    }
    return null;
  };
  const pitchOf = match => {
    const court = json.courts?.[match.courtId];
    const label = text(court?.displayId);
    const index = text(match.courtId);
    return label ? `Platz ${label}` : index ? `Platz ${/^\d+$/.test(index) ? num(index) + 1 : index}` : null;
  };
  const scheduleMeta = new Map([...(json.groupMatches ?? []), ...(json.finalMatches ?? [])].map(match => {
    const scheduledAt = text(match.dateAndTime);
    return [match, {
      pitch: pitchOf(match),
      kickoffDate: scheduledAt.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
      kickoffTimeHHmm: scheduledAt.match(/\b(\d{2}:\d{2})(?::\d{2})?$/)?.[1] ?? "",
      isLive: providerActive(match),
      hasResult: hasScores(match),
    }];
  }));
  const superseded = supersededLiveMatches([...scheduleMeta.values()]);
  const isActive = match => providerActive(match) && !superseded.has(scheduleMeta.get(match));
  const scored = (m) => !isActive(m) && hasScores(m);
  const sourceConfirmed = (s) => {
    if (!s) return true;
    if (s.type === "group") {
      const games = (json.groupMatches ?? []).filter(
        (m) => num(m.groupId) === num(s.group),
      );
      return games.length > 0 && games.every(scored);
    }
    if (s.type === "knockout")
      return scored(
        (json.finalMatches ?? []).find(
          (m) =>
            num(m.modeMapping?.round) === num(s.round) &&
            num(m.modeMapping?.match) === num(s.match),
        ),
      );
    return false;
  };
  const candidates = (s, depth = 0) => {
    if (!s || depth > 8) return [];
    const projected = projection(source(s));
    if (projected) return [projected];
    if (s.type === "knockout") {
      const prior = (json.finalMatches ?? []).find(
        (m) =>
          num(m.modeMapping?.round) === num(s.round) &&
          num(m.modeMapping?.match) === num(s.match),
      );
      if (!prior) return [];
      return [
        ...new Set(
          [
            ...(prior.sourceTeam1
              ? candidates(prior.sourceTeam1, depth + 1)
              : [name(prior.homeParticipant)]),
            ...(prior.sourceTeam2
              ? candidates(prior.sourceTeam2, depth + 1)
              : [name(prior.awayParticipant)]),
          ].filter(Boolean),
        ),
      ];
    }
    return [];
  };
  const rawMatches = [];
  for (const [kind, list] of [
    ["g", json.groupMatches ?? []],
    ["ko", json.finalMatches ?? []],
  ])
    for (let i = 0; i < list.length; i++) {
      const m = list[i],
        homeSource = source(m.sourceTeam1),
        awaySource = source(m.sourceTeam2);
      const homeTeam = name(m.homeParticipant),
        awayTeam = name(m.awayParticipant);
      if ((!homeTeam && !homeSource) || (!awayTeam && !awaySource)) continue;
      const isLive = isActive(m);
      const hasResult = scored(m);
      // Once a result is official, the assigned teams are known even if the
      // provider still flags an earlier source fixture as active.
      const homeConfirmed = Boolean(homeTeam) && (hasResult || sourceConfirmed(m.sourceTeam1));
      const awayConfirmed = Boolean(awayTeam) && (hasResult || sourceConfirmed(m.sourceTeam2));
      const timing = scheduleMeta.get(m);
      rawMatches.push({
        homeTeam:
          homeConfirmed
            ? homeTeam
            : homeSource?.label || homeTeam,
        awayTeam:
          awayConfirmed
            ? awayTeam
            : awaySource?.label || awayTeam,
        homeConfirmed,
        awayConfirmed,
        homeCandidates: candidates(m.sourceTeam1),
        awayCandidates: candidates(m.sourceTeam2),
        homeSource,
        awaySource,
        homeProjection: projection(homeSource),
        awayProjection: projection(awaySource),
        groupLabel: kind === "g" ? label(m.groupId ?? 0) : null,
        phase:
          kind === "g"
            ? "group"
            : inferMeinTurnierplanPhase(
                m.modeMapping,
                m.sourceTeam1,
                m.sourceTeam2,
              ),
        kickoffTimeHHmm: timing.kickoffTimeHHmm,
        kickoffDate: timing.kickoffDate,
        plannedMinutes: Math.max(
          1,
          Math.min(
            120,
            num(
              kind === "g" ? json.groupMatchDuration : json.finalMatchDuration,
            ) || 10,
          ),
        ),
        pitch: timing.pitch,
        hasResult,
        ...(hasResult && m.withPenaltyShootout === true ? { resultDecision: "shootout" }
          : hasResult && m.withExtraTime === true ? { resultDecision: "extra_time" } : {}),
        homeGoals: hasResult ? num(m.score1) : null,
        awayGoals: hasResult ? num(m.score2) : null,
        ...(isLive ? {
          isLive,
          liveHomeGoals: hasScores(m) ? num(m.score1) : null,
          liveAwayGoals: hasScores(m) ? num(m.score2) : null,
        } : {}),
        externalMatchId: `mtp-game-${m.gameId ?? m.displayId ?? (kind === "ko" ? `ko-${m.modeMapping?.round}-${m.modeMapping?.match}` : `g-${m.groupId}-${i}`)}`,
        roundLabel:
          kind === "ko" && num(m.modeMapping?.round) === 1
            ? num(m.modeMapping?.match) === 1
              ? "Finale"
              : `Spiel um Platz ${num(m.modeMapping.match) * 2 - 1}`
            : null,
      });
    }
  const analysis = {
    provider: "meinturnierplan",
    tournamentName: text(json.name),
    teamCount: teams.length,
    groupCount: json.groups.length,
    matchCount: rawMatches.length,
    preliminaryMatchCount: rawMatches.filter((m) => m.phase === "group").length,
    knockoutMatchCount: rawMatches.filter((m) => m.phase !== "group").length,
    groupSummaries: json.groups.map((g, i) => ({
      label: label(i),
      teamCount: teams.filter((t) => t.groupLabel === label(i)).length,
    })),
    teams,
    rawMatches,
    groupStandings,
    finalStandings: (json.finalRankTable ?? [])
      .map((r) => ({ rank: num(r.rank), teamName: name(r.participant) }))
      .filter((r) => r.teamName),
    rankingRuleCode: text(json.sortCrit),
    suggestedPollingSeconds: Math.max(60, num(json.polling) || 90),
  };
  return { ...analysis, finalStandings: resolveMeinTurnierplanFinalStandings(analysis) };
}
