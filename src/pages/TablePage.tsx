import React, { useEffect, useMemo, useState } from "react";
import {
  getMatches,
  getScheduleTeamMeta,
  SCHEDULE_TEAMS,
  SCHEDULE_TEAM_STORAGE_KEY,
  type ScheduleMatch,
  type ScheduleTeamId,
} from "../services/matchRepo";
import { useActiveTeamSeason } from "../hooks/useActiveTeamSeason";
import { useMatches } from "../hooks/useMatches";
import { Card, CardTitle } from "../app/components/ui/Card";

function formatMatchDate(startsAt: string | null | undefined): string {
  if (!startsAt) return "Termin offen";
  try {
    return new Date(startsAt).toLocaleString("de-AT", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "Termin offen";
  }
}

interface TableRow {
  teamName: string;
  sp: number;
  s: number;
  u: number;
  n: number;
  gf: number;
  ga: number;
  td: number;
  pkt: number;
}

function computeTableRow(
  teamId: ScheduleTeamId,
  finishedMatches: ScheduleMatch[],
): TableRow {
  const meta = getScheduleTeamMeta(teamId);
  const ourName = meta.shortName;

  let sp = 0;
  let s = 0;
  let u = 0;
  let n = 0;
  let gf = 0;
  let ga = 0;

  for (const m of finishedMatches) {
    const weAreHome = m.homeTeam === ourName;
    const ourGoals = weAreHome ? m.scoreHome : m.scoreAway;
    const oppGoals = weAreHome ? m.scoreAway : m.scoreHome;

    sp += 1;
    gf += ourGoals;
    ga += oppGoals;

    if (ourGoals > oppGoals) s += 1;
    else if (ourGoals < oppGoals) n += 1;
    else u += 1;
  }

  const td = gf - ga;
  const pkt = s * 3 + u * 1;

  return {
    teamName: ourName,
    sp,
    s,
    u,
    n,
    gf,
    ga,
    td,
    pkt,
  };
}

export const TablePage: React.FC = () => {
  const {
    teamLabel,
    teamSeasonId,
    loading: tsLoading,
    error: tsError,
  } = useActiveTeamSeason();
  const { matches: dbMatches, loading: mLoading, error: mError } = useMatches(teamSeasonId);

  const [teamId, setTeamId] = useState<ScheduleTeamId>(() => {
    if (typeof window === 'undefined') return 'u11a';
    try {
      const stored = window.localStorage.getItem(
        SCHEDULE_TEAM_STORAGE_KEY,
      ) as ScheduleTeamId | null;
      if (stored === 'u11a' || stored === 'u12') return stored;
    } catch {
      // ignore
    }
    return 'u11a';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SCHEDULE_TEAM_STORAGE_KEY, teamId);
    } catch {
      // ignore
    }
  }, [teamId]);

  const localMatches = useMemo(() => getMatches(teamId), [teamId]);
  const finishedMatches = useMemo(
    () => localMatches.filter((m) => m.status === "finished"),
    [localMatches],
  );

  const tableData = useMemo(() => {
    const row = computeTableRow(teamId, finishedMatches);
    return [row];
  }, [teamId, finishedMatches]);

  const hasNoFinished = finishedMatches.length === 0;

  return (
    <div className="page space-y-4">
      <h1 className="headline">Spielplan</h1>

      {/* Spielplan Card – Matches aus DB */}
      <Card>
        <CardTitle>Spielplan</CardTitle>
        {tsLoading && (
          <p className="mt-2 text-sm text-[var(--muted)]">Lade Team…</p>
        )}
        {!tsLoading && tsError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {tsError}
          </p>
        )}
        {!tsLoading && !tsError && teamLabel != null && (
          <p className="mt-0.5 text-sm text-[var(--muted)]">{teamLabel}</p>
        )}
        {!tsLoading && !tsError && teamSeasonId == null && (
          <p className="mt-2 text-sm text-[var(--muted)]">Kein Team gewählt.</p>
        )}
        {!tsLoading && !tsError && teamSeasonId != null && (
          <>
            {mLoading && (
              <p className="mt-2 text-sm text-[var(--muted)]">Lade Spiele…</p>
            )}
            {!mLoading && mError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {mError}
              </p>
            )}
            {!mLoading && !mError && dbMatches.length === 0 && (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Noch keine Spiele angelegt.
              </p>
            )}
            {!mLoading && !mError && dbMatches.length > 0 && (
              <ul className="mt-2 divide-y divide-[var(--border)]">
                {dbMatches.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2 first:pt-0 last:pb-0 text-sm text-[var(--text-main)]"
                  >
                    <span className="text-[var(--text-sub)]">
                      {formatMatchDate(m.starts_at)}
                    </span>
                    {m.opponent != null && m.opponent !== "" && (
                      <span className="font-medium">{m.opponent}</span>
                    )}
                    {m.location != null && m.location !== "" && (
                      <span className="text-[var(--muted)]">{m.location}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      <h2 className="text-lg font-semibold mt-6">Tabelle (intern)</h2>
      <p className="text-sm text-[var(--text-sub)]">
        Berechnet nur aus den in der App erfassten Spielen der eigenen
        Mannschaft.
      </p>

      <div className="flex items-center justify-between gap-3">
        <label className="text-sm text-[var(--text-sub)]">
          Mannschaft
          <select
            className="ml-2 rounded-full bg-black/40 border border-[var(--glass-border)] px-3 py-1 text-sm text-[var(--text-main)]"
            value={teamId}
            onChange={(e) =>
              setTeamId(e.target.value as ScheduleTeamId)
            }
          >
            {SCHEDULE_TEAMS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasNoFinished && (
        <div
          className="rounded-xl border border-[var(--glass-border)] bg-black/20 px-4 py-3 text-sm text-[var(--text-sub)]"
          role="status"
        >
          Noch keine beendeten Spiele erfasst.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--glass-border)] text-left text-[var(--text-sub)]">
              <th className="py-2 pr-2 font-medium">Team</th>
              <th className="py-2 px-1 text-center font-medium">Sp</th>
              <th className="py-2 px-1 text-center font-medium">S</th>
              <th className="py-2 px-1 text-center font-medium">U</th>
              <th className="py-2 px-1 text-center font-medium">N</th>
              <th className="py-2 px-1 text-center font-medium">Tore</th>
              <th className="py-2 px-1 text-center font-medium">TD</th>
              <th className="py-2 pl-1 text-center font-medium">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row) => (
              <tr
                key={row.teamName}
                className="border-b border-[var(--glass-border)] text-[var(--text-main)]"
              >
                <td className="py-2.5 pr-2 font-medium">{row.teamName}</td>
                <td className="py-2.5 px-1 text-center">{row.sp}</td>
                <td className="py-2.5 px-1 text-center">{row.s}</td>
                <td className="py-2.5 px-1 text-center">{row.u}</td>
                <td className="py-2.5 px-1 text-center">{row.n}</td>
                <td className="py-2.5 px-1 text-center">
                  {row.gf}:{row.ga}
                </td>
                <td className="py-2.5 px-1 text-center">
                  {row.td >= 0 ? `+${row.td}` : row.td}
                </td>
                <td className="py-2.5 pl-1 text-center font-semibold">
                  {row.pkt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
