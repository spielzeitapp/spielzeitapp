/** Shared provider model: confirmed participants and projections stay distinct. */
const text = (value) => String(value ?? "").trim();
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
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
  if (!json?.participants || !Array.isArray(json.groups) || !json.groups.length)
    return null;
  const name = (id) => text(json.participants[id]?.name);
  const label = (i) => text(json.groups[i]?.displayId) || String(Number(i) + 1);
  const teams = json.groups.flatMap((g, i) =>
    (json.groupParticipants?.[i] ?? [])
      .map((id) => ({ teamName: name(id), groupLabel: label(i) }))
      .filter((t) => t.teamName),
  );
  if (!teams.length) return null;
  const groupStandings = json.groups.map((g, i) => ({
    groupLabel: label(i),
    rows: (json.groupRankTables?.[i] ?? [])
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
  const scored = (m) =>
    m &&
    m.score1 != null &&
    m.score2 != null &&
    /^\d+$/.test(text(m.score1)) &&
    /^\d+$/.test(text(m.score2));
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
      const valid = (v) => v != null && text(v) !== "" && /^\d+$/.test(text(v));
      const hasResult = valid(m.score1) && valid(m.score2);
      const court = json.courts?.[m.courtId];
      rawMatches.push({
        homeTeam:
          homeTeam && sourceConfirmed(m.sourceTeam1)
            ? homeTeam
            : homeSource?.label || homeTeam,
        awayTeam:
          awayTeam && sourceConfirmed(m.sourceTeam2)
            ? awayTeam
            : awaySource?.label || awayTeam,
        homeConfirmed: Boolean(homeTeam) && sourceConfirmed(m.sourceTeam1),
        awayConfirmed: Boolean(awayTeam) && sourceConfirmed(m.sourceTeam2),
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
        kickoffTimeHHmm:
          text(m.dateAndTime).match(/\b(\d{2}:\d{2})(?::\d{2})?$/)?.[1] ?? "",
        plannedMinutes: Math.max(
          1,
          Math.min(
            120,
            num(
              kind === "g" ? json.groupMatchDuration : json.finalMatchDuration,
            ) || 10,
          ),
        ),
        pitch: text(court?.displayId) ? `Platz ${text(court.displayId)}` : null,
        hasResult,
        homeGoals: hasResult ? num(m.score1) : null,
        awayGoals: hasResult ? num(m.score2) : null,
        externalMatchId: `mtp-game-${m.gameId ?? m.displayId ?? (kind === "ko" ? `ko-${m.modeMapping?.round}-${m.modeMapping?.match}` : `g-${m.groupId}-${i}`)}`,
        roundLabel:
          kind === "ko" && num(m.modeMapping?.round) === 1
            ? num(m.modeMapping?.match) === 1
              ? "Finale"
              : `Spiel um Platz ${num(m.modeMapping.match) * 2 - 1}`
            : null,
      });
    }
  return {
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
}
