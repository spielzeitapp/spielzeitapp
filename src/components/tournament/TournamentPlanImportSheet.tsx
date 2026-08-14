import React from 'react';
import { createPortal } from 'react-dom';
import { FileDown } from 'lucide-react';
import { AppButton } from '../ui/AppButton';
import {
  buildTournamentPlanImportPreviewSummary,
  countOwnTeamMatchesInAnalysis,
  type TournamentImportRecognition,
  type TournamentPlanAnalysis,
  type TournamentPlanAnalyzeDiagnostics,
  type TournamentPlanAnalyzeFailure,
} from '../../lib/tournamentPlanImport';
import { TournamentImportRecognitionPanel } from './TournamentImportRecognitionPanel';
import { TournamentPlanAnalyzeDebugPanel } from './TournamentPlanAnalyzeDebugPanel';

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
                <summary className="cursor-pointer text-[12px] text-white/45">Technische Details</summary>
                <div className="mt-2">
                  <TournamentPlanAnalyzeDebugPanel failure={analyzeFailure} diagnostics={analyzeDiagnostics} />
                </div>
              </details>
            </>
          ) : analysis && preview ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[14px] text-white/85">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">Turnierplan erkannt</p>
                {preview.tournamentName ? (
                  <p className="mt-1 text-[16px] font-bold text-white">{preview.tournamentName}</p>
                ) : null}
                <p className="mt-2 text-[14px] text-white/80">
                  {preview.teamCount} Mannschaften
                  <span className="text-white/35"> · </span>
                  {preview.matchCount} Spiele
                  {ownTeamMatchCount > 0 ? (
                    <>
                      <span className="text-white/35"> · </span>
                      {ownTeamMatchCount} {ownTeamMatchCount === 1 ? 'Spiel' : 'Spiele'} für{' '}
                      {preview.ownTeamName ?? 'unsere Mannschaft'}
                    </>
                  ) : null}
                </p>
                {preview.ownTeamRecognized && preview.ownTeamName ? (
                  <p className="mt-2 text-[13px] font-medium text-emerald-300/90">
                    Eigene Mannschaft erkannt
                    <span className="mt-0.5 block text-white/85">
                      {preview.ownTeamName} ✓
                    </span>
                  </p>
                ) : null}
              </div>

              <TournamentImportRecognitionPanel
                recognition={recognition}
                ownMatchCount={ownTeamMatchCount}
                onAddAlias={onAddAlias}
              />

              {analyzeDiagnostics ? (
                <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                  <summary className="cursor-pointer text-[12px] text-white/45">Technische Details</summary>
                  <div className="mt-2">
                    <TournamentPlanAnalyzeDebugPanel failure={null} diagnostics={analyzeDiagnostics} />
                  </div>
                </details>
              ) : null}
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
