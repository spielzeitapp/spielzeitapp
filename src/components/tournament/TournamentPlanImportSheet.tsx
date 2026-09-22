import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FileDown, ShieldCheck } from 'lucide-react';
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
  onManualAddMatch?: () => void;
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
  onManualAddMatch,
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
            {error ? 'Turnierplan nicht verfügbar' : 'Turnierplan erkannt'}
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
              <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 px-3.5 py-3.5" role="alert">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" strokeWidth={2} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-white">Automatischer Import derzeit nicht möglich</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/68">
                      Der Anbieter liefert aktuell keinen vollständigen Spielplan. Bereits gespeicherte Spiele,
                      Live-Ergebnisse und Torschützen bleiben unverändert.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-2.5 py-2 text-[12px] font-semibold text-emerald-200/90">
                  <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  Vorhandene Turnierdaten sind geschützt
                </div>
              </div>
              {showIncompleteActions ? (
                <div className="flex flex-col gap-2">
                  {onManualAddMatch ? (
                    <AppButton variant="primary" onClick={onManualAddMatch} className="w-full">
                      Turnierspiel manuell ergänzen
                    </AppButton>
                  ) : null}
                  {onRetry ? (
                    <AppButton variant="secondary" onClick={onRetry} className="w-full">
                      Erneut prüfen
                    </AppButton>
                  ) : null}
                  {onEditLink ? (
                    <AppButton variant="secondary" onClick={onEditLink} className="w-full">
                      QR oder Link ändern
                    </AppButton>
                  ) : null}
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
              {error ? 'Schließen' : 'Abbrechen'}
            </AppButton>
            {!error ? (
              <AppButton
                variant="primary"
                onClick={onImport}
                disabled={loading || importing || !analysis}
                className="w-full sm:w-auto"
              >
                {importing ? 'Importieren…' : 'Turnierplan importieren'}
              </AppButton>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
