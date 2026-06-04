import React from 'react';
import { createPortal } from 'react-dom';
import { FileDown } from 'lucide-react';
import { AppButton } from '../ui/AppButton';
import { countOwnTeamMatchesInAnalysis, type TournamentImportRecognition } from '../../lib/tournamentPlanImport';
import type { TournamentPlanAnalysis } from '../../lib/tournamentPlanImport';
import { TournamentImportRecognitionPanel } from './TournamentImportRecognitionPanel';

type Props = {
  isOpen: boolean;
  loading: boolean;
  importing: boolean;
  error: string | null;
  analysis: TournamentPlanAnalysis | null;
  recognition: TournamentImportRecognition | null;
  onClose: () => void;
  onImport: () => void;
  onAddAlias: () => void;
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
  analysis,
  recognition,
  onClose,
  onImport,
  onAddAlias,
}) => {
  if (!isOpen || typeof document === 'undefined') return null;

  const ownTeamMatchCount =
    analysis && recognition ? countOwnTeamMatchesInAnalysis(analysis, recognition.knownNames) : 0;

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
            <p className="text-[13px] text-red-300/90" role="alert">
              {error}
            </p>
          ) : analysis ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[14px] text-white/85">
                <p>Teams gefunden: {analysis.teamCount}</p>
                <p>Gruppen gefunden: {analysis.groupCount}</p>
                <p>Spiele gefunden: {analysis.preliminaryMatchCount}</p>
              </div>

              {analysis.groupSummaries.length > 0 ? (
                <div className="flex flex-col gap-1 text-[14px] text-white/75">
                  {analysis.groupSummaries.map((group) => (
                    <p key={group.label}>{formatGroupLine(group)}</p>
                  ))}
                </div>
              ) : null}

              <p className="text-[14px] font-medium text-white/90">
                {analysis.preliminaryMatchCount === 1
                  ? '1 Vorrundenspiel'
                  : `${analysis.preliminaryMatchCount} Vorrundenspiele`}
              </p>

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
              {importing ? 'Importieren…' : 'Importieren'}
            </AppButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
