import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePlayers } from '../hooks/usePlayers';
import { useJugglingChallenge } from '../hooks/useJugglingChallenge';
import { normalizeRole, canManageMatches } from '../lib/roles';
import {
  absoluteImprovement,
  buildAbsoluteImprovementRanking,
  buildEndValueRanking,
  buildPercentImprovementRanking,
  deriveJugglingAwards,
  formatImprovementDelta,
  formatImprovementPercent,
  percentImprovement,
} from '../lib/challengeScoring';
import type { ChallengeScoringRow, JugglingChallengePlayerRow } from '../lib/challengeTypes';
import { dsPanelRowClass } from '../lib/premiumDesignSystem';
import { GlassCard, PageShell, PremiumCard, PremiumEmptyState, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';

function parseInputInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

function AwardCard({
  emoji,
  title,
  row,
}: {
  emoji: string;
  title: string;
  row: ChallengeScoringRow | null;
}) {
  return (
    <GlassCard variant="subtle" showAmbientGlow={false} className="px-3 py-3">
      <p className="text-[12px] font-semibold text-white/70">
        <span className="mr-1" aria-hidden>
          {emoji}
        </span>
        {title}
      </p>
      {row ? (
        <>
          <p className="mt-1 text-[15px] font-bold text-white">{row.playerName}</p>
          <p className="mt-0.5 text-[13px] tabular-nums text-red-200/90">
            {title === 'Jonglierkönig'
              ? `${row.endValue} Jonglierungen`
              : title === 'Aufsteiger'
                ? formatImprovementDelta(row.absoluteImprovement)
                : formatImprovementPercent(row.percentImprovement)}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-white/50">Noch keine Endwerte erfasst.</p>
      )}
    </GlassCard>
  );
}

function RankingList({
  title,
  rows,
}: {
  title: string;
  rows: ChallengeScoringRow[];
}) {
  if (rows.length === 0) {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{title}</p>
        <p className="mt-1 text-[12px] text-white/50">Noch keine Endwerte erfasst.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.playerId}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
          >
            <span className="min-w-0 text-[13px] font-semibold text-white">
              <span className="mr-2 tabular-nums text-white/45">{row.rank}.</span>
              {row.playerName}
            </span>
            <span className="shrink-0 text-[13px] font-bold tabular-nums text-white/85">
              {title.includes('Endwert')
                ? row.endValue
                : title.includes('Entwicklung')
                  ? formatImprovementPercent(row.percentImprovement)
                  : formatImprovementDelta(row.absoluteImprovement)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlayerValueEditor({
  row,
  saving,
  onSave,
}: {
  row: JugglingChallengePlayerRow;
  saving: boolean;
  onSave: (playerId: string, start: number, end: number | null) => Promise<void>;
}) {
  const [startDraft, setStartDraft] = useState(String(row.startValue));
  const [endDraft, setEndDraft] = useState(row.endValue == null ? '' : String(row.endValue));

  useEffect(() => {
    setStartDraft(String(row.startValue));
    setEndDraft(row.endValue == null ? '' : String(row.endValue));
  }, [row.player.id, row.startValue, row.endValue]);

  const commit = async () => {
    const start = parseInputInt(startDraft) ?? 0;
    const endParsed = parseInputInt(endDraft);
    const end = endDraft.trim() === '' ? null : endParsed;
    if (start === row.startValue && end === row.endValue) return;
    await onSave(row.player.id, start, end);
  };

  const startNum = parseInputInt(startDraft) ?? row.startValue;
  const endNum = endDraft.trim() === '' ? null : parseInputInt(endDraft);
  const delta = absoluteImprovement(startNum, endNum);
  const pct = percentImprovement(startNum, endNum);

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
      <p className="text-[14px] font-semibold text-white">{row.player.display_name}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-white/55">
          Start
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={startDraft}
            onChange={(e) => setStartDraft(e.target.value)}
            onBlur={() => void commit()}
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[14px] font-semibold tabular-nums text-white"
          />
        </label>
        <label className="block text-[11px] text-white/55">
          Ende
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={endDraft}
            onChange={(e) => setEndDraft(e.target.value)}
            onBlur={() => void commit()}
            disabled={saving}
            placeholder="—"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[14px] font-semibold tabular-nums text-white"
          />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[12px] tabular-nums">
        <span className="text-white/70">{formatImprovementDelta(delta)}</span>
        <span className="text-white/50">{formatImprovementPercent(pct)}</span>
        {saving ? <span className="text-white/40">Speichern…</span> : null}
      </div>
    </div>
  );
}

export const JugglingChallengePage: React.FC = () => {
  const { teamSeasonId, role, loading: tsLoading } = useActiveTeamSeason();
  const roleNormalized = normalizeRole(role);
  const allowed = canManageMatches(roleNormalized);
  const { players, loading: playersLoading } = usePlayers(allowed ? teamSeasonId : null, {
    mode: 'active',
  });

  const { session, rows, loading, savingPlayerId, error, savePlayerValues } = useJugglingChallenge(
    players,
    teamSeasonId,
    allowed && !tsLoading,
  );

  const scoreInputs = useMemo(
    () =>
      rows.map((row) => ({
        playerId: row.player.id,
        playerName: row.player.display_name,
        startValue: row.startValue,
        endValue: row.endValue,
      })),
    [rows],
  );

  const minStart = session?.min_start_for_percent ?? 3;

  const awards = useMemo(
    () => deriveJugglingAwards(scoreInputs, minStart),
    [scoreInputs, minStart],
  );

  const endRanking = useMemo(() => buildEndValueRanking(scoreInputs), [scoreInputs]);
  const absoluteRanking = useMemo(() => buildAbsoluteImprovementRanking(scoreInputs), [scoreInputs]);
  const percentRanking = useMemo(
    () => buildPercentImprovementRanking(scoreInputs, minStart),
    [scoreInputs, minStart],
  );

  const hasAnyEndValue = scoreInputs.some((row) => row.endValue != null);

  if (!tsLoading && !allowed) {
    return <Navigate to="/app/team" replace />;
  }

  const handleSave = async (playerId: string, start: number, end: number | null) => {
    await savePlayerValues(playerId, start, end);
  };

  return (
    <PageShell
      background="default"
      className="min-h-[60vh] w-full px-3 py-6 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-lg space-y-4"
    >
      <Link
        to="/app/team?tab=training"
        className={cn(dsPanelRowClass(), '!min-h-[40px] !py-2 text-sm font-semibold text-white/85')}
      >
        <span className="flex items-center gap-2">
          <ChevronLeft className="h-4 w-4 text-white/50" aria-hidden />
          Zurück zu Team · Training
        </span>
      </Link>

      <SectionTitle subtitle="Startwert, Endwert und Entwicklung pro Spieler">
        Jonglier-Challenge
      </SectionTitle>

      {loading || playersLoading || tsLoading ? (
        <p className="text-[13px] text-white/65">Lade Challenge…</p>
      ) : error ? (
        <p className="text-[13px] text-red-300/90">{error}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <AwardCard emoji="🏆" title="Jonglierkönig" row={awards.king} />
            <AwardCard emoji="🚀" title="Aufsteiger" row={awards.riser} />
            <AwardCard emoji="⭐" title="Entwicklungspreis" row={awards.development} />
          </div>

          <PremiumCard variant="subtle" showAmbientGlow={false} className="sm:p-4">
            <SectionTitle as="h2" className="[&>h2]:text-base [&>h2]:font-semibold [&>h2]:normal-case">
              Werte erfassen
            </SectionTitle>
            {rows.length === 0 ? (
              <PremiumEmptyState variant="subtle" title="Keine aktiven Spieler im Kader." className="mt-3 py-6" />
            ) : (
              <div className="mt-3 space-y-2">
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[520px] border-separate border-spacing-y-1.5 text-left text-[13px]">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-white/45">
                        <th className="px-2 py-1 font-medium">Spieler</th>
                        <th className="px-2 py-1 font-medium">Start</th>
                        <th className="px-2 py-1 font-medium">Ende</th>
                        <th className="px-2 py-1 font-medium">Δ</th>
                        <th className="px-2 py-1 font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <PlayerTableRow
                          key={row.player.id}
                          row={row}
                          saving={savingPlayerId === row.player.id}
                          onSave={handleSave}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 sm:hidden">
                  {rows.map((row) => (
                    <PlayerValueEditor
                      key={row.player.id}
                      row={row}
                      saving={savingPlayerId === row.player.id}
                      onSave={handleSave}
                    />
                  ))}
                </div>
              </div>
            )}
          </PremiumCard>

          <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-4 sm:p-4">
            <SectionTitle as="h2" className="[&>h2]:text-base [&>h2]:font-semibold [&>h2]:normal-case">
              Rankings
            </SectionTitle>
            {!hasAnyEndValue ? (
              <p className="text-[13px] text-white/55">Noch keine Endwerte erfasst.</p>
            ) : (
              <div className="space-y-4">
                <RankingList title="1. Endwert-Ranking" rows={endRanking} />
                <RankingList title="2. Verbesserungs-Ranking" rows={absoluteRanking} />
                <RankingList title="3. Entwicklungspreis-Ranking" rows={percentRanking} />
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-white/45">
              Entwicklungspreis nur bei Startwert ≥ {minStart}. Prozentwertung entfällt bei Start = 0.
            </p>
          </PremiumCard>
        </div>
      )}
    </PageShell>
  );
};

function PlayerTableRow({
  row,
  saving,
  onSave,
}: {
  row: JugglingChallengePlayerRow;
  saving: boolean;
  onSave: (playerId: string, start: number, end: number | null) => Promise<void>;
}) {
  const [startDraft, setStartDraft] = useState(String(row.startValue));
  const [endDraft, setEndDraft] = useState(row.endValue == null ? '' : String(row.endValue));

  useEffect(() => {
    setStartDraft(String(row.startValue));
    setEndDraft(row.endValue == null ? '' : String(row.endValue));
  }, [row.player.id, row.startValue, row.endValue]);

  const commit = async () => {
    const start = parseInputInt(startDraft) ?? 0;
    const end = endDraft.trim() === '' ? null : parseInputInt(endDraft);
    if (start === row.startValue && end === row.endValue) return;
    await onSave(row.player.id, start, end);
  };

  const startNum = parseInputInt(startDraft) ?? row.startValue;
  const endNum = endDraft.trim() === '' ? null : parseInputInt(endDraft);

  return (
    <tr>
      <td className="rounded-l-lg bg-black/25 px-2 py-2 font-semibold text-white">{row.player.display_name}</td>
      <td className="bg-black/25 px-2 py-2">
        <input
          type="number"
          min={0}
          value={startDraft}
          onChange={(e) => setStartDraft(e.target.value)}
          onBlur={() => void commit()}
          disabled={saving}
          className="w-16 rounded border border-white/10 bg-black/40 px-2 py-1 text-[13px] tabular-nums text-white"
        />
      </td>
      <td className="bg-black/25 px-2 py-2">
        <input
          type="number"
          min={0}
          value={endDraft}
          onChange={(e) => setEndDraft(e.target.value)}
          onBlur={() => void commit()}
          disabled={saving}
          placeholder="—"
          className="w-16 rounded border border-white/10 bg-black/40 px-2 py-1 text-[13px] tabular-nums text-white"
        />
      </td>
      <td className="bg-black/25 px-2 py-2 tabular-nums text-white/80">
        {formatImprovementDelta(absoluteImprovement(startNum, endNum))}
      </td>
      <td className="rounded-r-lg bg-black/25 px-2 py-2 tabular-nums text-white/80">
        {formatImprovementPercent(percentImprovement(startNum, endNum))}
      </td>
    </tr>
  );
}
