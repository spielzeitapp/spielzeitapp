import React from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import { AppButton } from '../ui/AppButton';
import type { TournamentPlanRefreshPreview } from '../../lib/tournamentPlanImport';

type Props = {
  isOpen: boolean;
  loading: boolean;
  importing: boolean;
  error: string | null;
  preview: TournamentPlanRefreshPreview | null;
  onClose: () => void;
  onImport: () => void;
};

export const TournamentPlanRefreshSheet: React.FC<Props> = ({
  isOpen,
  loading,
  importing,
  error,
  preview,
  onClose,
  onImport,
}) => {
  if (!isOpen || typeof document === 'undefined') return null;

  const noNewMatches = preview && preview.newMatches === 0;
  const canImport = Boolean(preview && (preview.newMatches > 0 || preview.newTeams > 0));

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
        aria-labelledby="tournament-plan-refresh-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div id="tournament-plan-refresh-title" className="modalTitle flex items-center gap-2 text-white">
            <RefreshCw className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
            Turnierplan aktualisiert
          </div>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Schließen" disabled={importing}>
            ×
          </button>
        </div>

        <div className="modalBody flex flex-col gap-3">
          {loading ? (
            <p className="text-[14px] text-white/70">Turnierplan wird geladen…</p>
          ) : error ? (
            <p className="text-[13px] text-red-300/90" role="alert">
              {error}
            </p>
          ) : preview ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[14px] text-white/85">
                <p>Neue Teams: {preview.newTeams}</p>
                <p>Neue Spiele: {preview.newMatches}</p>
                <p>Bereits vorhanden: {preview.existingMatches}</p>
              </div>
              {noNewMatches ? (
                <p className="text-[14px] text-white/70">Keine neuen Spiele gefunden.</p>
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
              disabled={loading || importing || !preview || Boolean(error) || !canImport}
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
