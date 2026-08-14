import React from 'react';
import { createPortal } from 'react-dom';
import { FileDown } from 'lucide-react';
import { AppButton } from '../ui/AppButton';
import {
  buildTournamentPlanImportPreviewSummary,
  countAnalysisMatchResults,
  countOwnTeamMatchesInAnalysis,
  labelForTournamentPlanAnalyzeSource,
  listOwnTeamMatchesForImportPreview,
  type TournamentImportRecognition,
  type TournamentPlanAnalysis,
  type TournamentPlanAnalyzeDiagnostics,
  type TournamentPlanAnalyzeFailure,
} from '../../lib/tournamentPlanImport';
import { TournamentImportRecognitionPanel } from './TournamentImportRecognitionPanel';
import { TournamentPlanAnalyzeDebugPanel } from './TournamentPlanAnalyzeDebugPanel';
import { TournamentPlanResultPreviewSection } from './TournamentPlanResultPreviewSection';

type Props = {
  isOpen: boolean;
  loading: boolean;
  importing: boolean;
  error: string | null;
  analyzeFailure: TournamentPlanAnalyzeFailure | null;
  analyzeDiagnostics: TournamentPlanAnalyzeDiagnostics | null;
  analysis: TournamentPlanAnalysis | null;
  recognition: TournamentImportRecognition | null;
  onClose: () => void;
  onImport: () => void;
  onAddAlias: () => void;
  onRetry?: () => void;
  onEditLink?: () => void;
};

function formatGroupLine(summary: { label: string; teamCount: number }): string {
  const label = summary.label.trim();
  const prefixed = /^gruppe\s/i.test(label) ? label : `Gruppe ${label}`;
  return `${prefixed} (${summary.teamCount})`;
}

export const TournamentPlanImportSheet: React.FC<Props> = ({
  isOpen,
  loading,
  importing,
  error,
  analyzeFailure,
  analyzeDiagnostics,
  analysis,
  recognition,
  onClose,
  onImport,
  onAddAlias,
  onRetry,
  onEditLink,
}) => {
  if (!isOpen || typeof document === 'undefined') return null;

  const ownTeamMatchCount =
    analysis && recognition ? countOwnTeamMatchesInAnalysis(analysis, recognition.knownNames) : 0;
  const resultCounts = analysis ? countAnalysisMatchResults(analysis) : null;
  const ownMatches =
    analysis && recognition ? listOwnTeamMatchesForImportPreview(analysis, recognition.knownNames) : [];
  const preview =
    analysis && recognition
      ? buildTournamentPlanImportPreviewSummary(analysis, recognition.knownNames)
      : analysis
        ? buildTournamentPlanImportPreviewSummary(analysis, [])
        : null;
  const showIncompleteActions = Boolean(
    analyzeFailure &&
      (analyzeFailure.code === 'plan_incomplete' || analyzeFailure.provider === 'tournament-live') &&
      analyzeFailure.code !== 'unsupported_host',
  );

  return createPortal(
    <div
      className="modalOverlay !z-[1002]"
      onClick={(event) => {
        if (event.target === event.currentTarget && !importing) onClose();
      }}
      role="presentation"
    >
      <div
        className="modalSheet max-h-[min(92dvh,calc(100dvh-var(--app-header-h)-env(safe-area-inset-top,0px)-12px))] border border-purple-500/25 shadow-[0_0_40px_rgba(88,28,135,0.18)] sm:max-w-[480px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-plan-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div id="tournament-plan-import-title" className="modalTitle flex items-center gap-2 text-white">
            <FileDown className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
            Turnierplan erkannt
          </div>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Schließen" disabled={importing}>
            ×
          </button>
        </div>

        <div className="modalBody flex flex-col gap-3">
          {loading ? (
            <p className="text-[14px] text-white/70">Turnierplan wird analysiert…</p>
          ) : error ? (
            <>
              {!analyzeFailure ? (
                <p className="text-[13px] text-red-300/90" role="alert">
                  {error}
                </p>
              ) : null}
              {showIncompleteActions ? (
                <div className="flex flex-col gap-2">
                  {onRetry ? (
                    <AppButton variant="primary" onClick={onRetry} className="w-full">
                      Erneut versuchen
                    </AppButton>
                  ) : null}
                  {onEditLink ? (
                    <AppButton variant="secondary" onClick={onEditLink} className="w-full">
                      QR/Link bearbeiten
                    </AppButton>
                  ) : null}
                  <AppButton variant="secondary" onClick={onClose} className="w-full">
                    Spiele manuell anlegen
                  </AppButton>
                </div>
              ) : null}
              <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                <summary className="cursor-pointer text-[12px] text-white/55">Debug (Trainer)</summary>
                <div className="mt-2">
                  <TournamentPlanAnalyzeDebugPanel failure={analyzeFailure} diagnostics={analyzeDiagnostics} />
                </div>
              </details>
            </>
          ) : analysis && preview ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[14px] text-white/85">
                {analyzeDiagnostics?.source ? (
                  <p className="mb-2 text-[13px] text-emerald-300/85">
                    Quelle: {labelForTournamentPlanAnalyzeSource(analyzeDiagnostics.source)}
                  </p>
                ) : null}
                {preview.tournamentName ? (
                  <p className="font-medium text-white">{preview.tournamentName}</p>
                ) : null}
                <p>Teams erkannt: {preview.teamCount}</p>
                <p>Spiele erkannt: {preview.matchCount}</p>
                <p>eigene Mannschaft erkannt: {preview.ownTeamRecognized ? 'ja' : 'nein'}</p>
                {preview.firstOwnMatch ? (
                  <p>
                    erstes eigenes Spiel: {preview.firstOwnMatch.kickoffTimeHHmm} vs.{' '}
                    {preview.firstOwnMatch.opponentName}
                  </p>
                ) : null}
                {preview.lastPhaseLabel ? <p>letzte erkannte Phase: {preview.lastPhaseLabel}</p> : null}
                <p>Gruppen gefunden: {analysis.groupCount}</p>
              </div>

              {preview.groups.length > 0 ? (
                <div className="flex flex-col gap-1 text-[14px] text-white/75">
                  {preview.groups.map((group) => (
                    <p key={group.label}>{formatGroupLine(group)}</p>
                  ))}
                </div>
              ) : null}

              <p className="text-[14px] font-medium text-white/90">
                {analysis.preliminaryMatchCount === 1
                  ? '1 Vorrundenspiel'
                  : `${analysis.preliminaryMatchCount} Vorrundenspiele`}
              </p>

              {resultCounts ? (
                <TournamentPlanResultPreviewSection
                  matchesWithResult={resultCounts.withResult}
                  matchesWithoutResult={resultCounts.withoutResult}
                  ownMatches={ownMatches}
                />
              ) : null}

              <TournamentImportRecognitionPanel
                recognition={recognition}
                ownMatchCount={ownTeamMatchCount}
                onAddAlias={onAddAlias}
              />
            </>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AppButton variant="secondary" onClick={onClose} disabled={importing} className="w-full sm:w-auto">
              Abbrechen
            </AppButton>
            <AppButton
              variant="primary"
              onClick={onImport}
              disabled={loading || importing || !analysis || Boolean(error)}
              className="w-full sm:w-auto"
            >
              {importing ? 'Importieren…' : 'Turnierplan importieren'}
            </AppButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
