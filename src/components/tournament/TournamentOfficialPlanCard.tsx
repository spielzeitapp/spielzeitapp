import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, ExternalLink, FileDown, Link2, Pencil, RefreshCw, ScanLine } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { AppButton } from '../ui/AppButton';
import { Modal } from '../../app/ui/Modal';
import {
  dsPrimaryCtaClass,
  dsScheduleGlassButtonClass,
  dsSecondaryCtaClass,
  dsStatusChipClass,
} from '../../lib/premiumDesignSystem';
import { INVALID_QR_TOURNAMENT_LINK_MESSAGE } from '../../lib/tournamentPlanQrScanner';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import {
  analyzeTournamentUrl,
  computeTournamentPlanRefreshPreview,
  fetchTournamentImportRecognition,
  importTournamentPlanFromAnalysis,
  TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE,
  type TournamentImportRecognition,
  type TournamentPlanAnalysis,
  type TournamentPlanAnalyzeDiagnostics,
  type TournamentPlanAnalyzeFailure,
  type TournamentPlanRefreshPreview,
} from '../../lib/tournamentPlanImport';
import {
  displayDomainFromOfficialPlanUrl,
  openOfficialTournamentPlanUrl,
  saveOfficialTournamentPlanUrl,
  validateOfficialTournamentUrl,
} from '../../lib/tournamentOfficialPlanUrl';
import { markOfficialTournamentSynced } from '../../lib/tournamentPlanSync';
import { safeOptionalText, safeText } from '../../lib/safeText';
import { TournamentPlanImportSheet } from './TournamentPlanImportSheet';
import { TournamentPlanRefreshSheet } from './TournamentPlanRefreshSheet';
import { TournamentPlanQrScannerSheet } from './TournamentPlanQrScannerSheet';

type Props = {
  tournamentEventId: string;
  teamSeasonId: string;
  tournamentDayIso: string;
  location: string | null;
  officialTournamentUrl: string | null;
  existingTeamNames: string[];
  existingSlots: TournamentMatchSlotView[];
  canManage: boolean;
  tournamentArchived?: boolean;
  onUrlUpdated: (url: string | null) => void;
  onImportComplete: () => void;
  onScrollToAliases?: () => void;
  /** Kompakte Darstellung im Trainer-Accordion ohne eigene Card-Hülle. */
  embedded?: boolean;
  /** Externer Trigger für Import/QR/Link-Workflow (z. B. aus Überblick). */
  workflowRequest?: { action: 'import' | 'qr' | 'link'; key: number } | null;
};

const inputClass =
  'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white placeholder:text-white/40 focus:border-purple-500/45 focus:outline-none';

export const TournamentOfficialPlanCard: React.FC<Props> = ({
  tournamentEventId,
  teamSeasonId,
  tournamentDayIso,
  location,
  officialTournamentUrl,
  existingTeamNames,
  existingSlots,
  canManage,
  tournamentArchived = false,
  onUrlUpdated,
  onImportComplete,
  onScrollToAliases,
  embedded = false,
  workflowRequest = null,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrScanError, setQrScanError] = useState<string | null>(null);
  const [qrSaving, setQrSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const qrSaveInFlightRef = useRef(false);

  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importAnalyzeFailure, setImportAnalyzeFailure] = useState<TournamentPlanAnalyzeFailure | null>(null);
  const [importAnalyzeDiagnostics, setImportAnalyzeDiagnostics] =
    useState<TournamentPlanAnalyzeDiagnostics | null>(null);
  const [importAnalysis, setImportAnalysis] = useState<TournamentPlanAnalysis | null>(null);
  const [recognition, setRecognition] = useState<TournamentImportRecognition | null>(null);

  const [refreshSheetOpen, setRefreshSheetOpen] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshAnalyzeFailure, setRefreshAnalyzeFailure] = useState<TournamentPlanAnalyzeFailure | null>(null);
  const [refreshAnalyzeDiagnostics, setRefreshAnalyzeDiagnostics] =
    useState<TournamentPlanAnalyzeDiagnostics | null>(null);
  const [refreshAnalysis, setRefreshAnalysis] = useState<TournamentPlanAnalysis | null>(null);
  const [refreshPreview, setRefreshPreview] = useState<TournamentPlanRefreshPreview | null>(null);

  const hasUrl = Boolean(safeText(officialTournamentUrl));
  const domain = displayDomainFromOfficialPlanUrl(officialTournamentUrl);

  useEffect(() => {
    if (modalOpen) {
      setDraftUrl(safeText(officialTournamentUrl));
      setModalError(null);
    }
  }, [modalOpen, officialTournamentUrl]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const openEditor = () => {
    setSaveError(null);
    setModalOpen(true);
  };

  const openQrScanner = () => {
    setSaveError(null);
    setQrScanError(null);
    setQrScannerOpen(true);
  };

  const handleOpen = () => {
    const url = safeText(officialTournamentUrl);
    if (url) openOfficialTournamentPlanUrl(url);
  };

  const handleSave = async () => {
    const validated = validateOfficialTournamentUrl(draftUrl);
    if (!validated.ok) {
      setModalError(validated.error);
      return;
    }
    setSaving(true);
    setModalError(null);
    const { error } = await saveOfficialTournamentPlanUrl(tournamentEventId, validated.url);
    setSaving(false);
    if (error) {
      setModalError(error);
      setSaveError(error);
      return;
    }
    onUrlUpdated(validated.url);
    setModalOpen(false);
    setToastMessage('Turnierplan gespeichert');
  };

  const handleQrScan = useCallback(
    async (rawValue: string) => {
      if (qrSaveInFlightRef.current) return;

      const validated = validateOfficialTournamentUrl(rawValue);
      if (!validated.ok) {
        setQrScanError(INVALID_QR_TOURNAMENT_LINK_MESSAGE);
        return;
      }

      qrSaveInFlightRef.current = true;
      setQrScanError(null);
      setQrSaving(true);

      const { error } = await saveOfficialTournamentPlanUrl(tournamentEventId, validated.url);
      setQrSaving(false);
      qrSaveInFlightRef.current = false;

      if (error) {
        setQrScanError(error);
        return;
      }

      onUrlUpdated(validated.url);
      setQrScannerOpen(false);
      setToastMessage('Turnierplan gespeichert');
    },
    [onUrlUpdated, tournamentEventId],
  );

  const startImport = useCallback(async () => {
    const url = safeText(officialTournamentUrl);
    if (!url) return;

    setImportSheetOpen(true);
    setImportLoading(true);
    setImportBusy(false);
    setImportError(null);
    setImportAnalyzeFailure(null);
    setImportAnalyzeDiagnostics(null);
    setImportAnalysis(null);

    try {
      const rec = await fetchTournamentImportRecognition(teamSeasonId);
      setRecognition(rec);

      const result = await analyzeTournamentUrl(url);
      if (!result.ok) {
        setImportError(result.error);
        setImportAnalyzeFailure(result.failure ?? null);
        setImportAnalyzeDiagnostics(result.failure?.diagnostics ?? null);
        return;
      }

      setImportAnalyzeDiagnostics(result.diagnostics ?? null);
      setImportAnalysis(result.analysis);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE);
      setImportAnalyzeFailure(null);
      setImportAnalyzeDiagnostics(null);
    } finally {
      setImportLoading(false);
    }
  }, [officialTournamentUrl, teamSeasonId]);

  useEffect(() => {
    if (!workflowRequest || !canManage) return;
    if (workflowRequest.action === 'import') void startImport();
    else if (workflowRequest.action === 'qr') openQrScanner();
    else openEditor();
  }, [workflowRequest?.key, canManage, startImport]);

  const handleImportConfirm = useCallback(async () => {
    if (!importAnalysis) return;

    setImportBusy(true);
    setImportError(null);

    const { importedTeams, importedMatches, updatedResults, error } = await importTournamentPlanFromAnalysis({
      tournamentEventId,
      teamSeasonId,
      tournamentDayIso,
      location,
      analysis: importAnalysis,
      existingTeamNames,
      existingSlots,
      knownNames: recognition?.knownNames ?? [],
    });

    setImportBusy(false);

    if (error) {
      setImportError(error);
      return;
    }

    setImportSheetOpen(false);
    markOfficialTournamentSynced(tournamentEventId);
    onImportComplete();

    if (importedMatches === 0 && importedTeams === 0 && updatedResults === 0) {
      setToastMessage('Keine neuen Einträge – alles bereits importiert');
    } else if (updatedResults > 0 && importedMatches === 0 && importedTeams === 0) {
      setToastMessage(
        updatedResults === 1 ? '1 Ergebnis importiert' : `${updatedResults} Ergebnisse importiert`,
      );
    } else if (importedMatches > 0) {
      const resultSuffix =
        updatedResults > 0
          ? updatedResults === 1
            ? ', 1 Ergebnis'
            : `, ${updatedResults} Ergebnisse`
          : '';
      setToastMessage(
        importedMatches === 1
          ? `1 neues Spiel importiert${resultSuffix}`
          : `${importedMatches} neue Spiele importiert${resultSuffix}`,
      );
    } else {
      const teamMsg =
        importedTeams === 1 ? '1 neues Team importiert' : `${importedTeams} neue Teams importiert`;
      setToastMessage(
        updatedResults > 0
          ? `${teamMsg}, ${updatedResults === 1 ? '1 Ergebnis' : `${updatedResults} Ergebnisse`}`
          : teamMsg,
      );
    }
  }, [
    existingSlots,
    existingTeamNames,
    importAnalysis,
    location,
    onImportComplete,
    recognition,
    teamSeasonId,
    tournamentDayIso,
    tournamentEventId,
  ]);

  const scrollToAliases = useCallback(() => {
    setImportSheetOpen(false);
    setRefreshSheetOpen(false);
    onScrollToAliases?.();
  }, [onScrollToAliases]);

  const startRefresh = useCallback(async () => {
    const url = safeText(officialTournamentUrl);
    if (!url) return;

    setRefreshSheetOpen(true);
    setRefreshLoading(true);
    setRefreshBusy(false);
    setRefreshError(null);
    setRefreshAnalyzeFailure(null);
    setRefreshAnalyzeDiagnostics(null);
    setRefreshAnalysis(null);
    setRefreshPreview(null);

    try {
      const rec = await fetchTournamentImportRecognition(teamSeasonId);
      setRecognition(rec);

      const result = await analyzeTournamentUrl(url);
      if (!result.ok) {
        setRefreshError(result.error);
        setRefreshAnalyzeFailure(result.failure ?? null);
        setRefreshAnalyzeDiagnostics(result.failure?.diagnostics ?? null);
        return;
      }

      setRefreshAnalyzeDiagnostics(result.diagnostics ?? null);
      setRefreshAnalysis(result.analysis);
      const preview = await computeTournamentPlanRefreshPreview({
        analysis: result.analysis,
        existingTeamNames,
        existingSlots,
        knownNames: rec.knownNames,
      });
      setRefreshPreview(preview);
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : TOURNAMENT_IMPORT_FETCH_ERROR_MESSAGE);
      setRefreshAnalyzeFailure(null);
      setRefreshAnalyzeDiagnostics(null);
    } finally {
      setRefreshLoading(false);
    }
  }, [existingSlots, existingTeamNames, officialTournamentUrl, teamSeasonId]);

  const handleRefreshConfirm = useCallback(async () => {
    if (!refreshAnalysis) return;

    setRefreshBusy(true);
    setRefreshError(null);

    const { importedTeams, importedMatches, updatedResults, error } = await importTournamentPlanFromAnalysis({
      tournamentEventId,
      teamSeasonId,
      tournamentDayIso,
      location,
      analysis: refreshAnalysis,
      existingTeamNames,
      existingSlots,
      knownNames: recognition?.knownNames ?? [],
    });

    setRefreshBusy(false);

    if (error) {
      setRefreshError(error);
      return;
    }

    setRefreshSheetOpen(false);
    markOfficialTournamentSynced(tournamentEventId);
    onImportComplete();

    if (importedMatches === 0 && importedTeams === 0 && updatedResults === 0) {
      setToastMessage('Keine neuen Spiele oder Ergebnisse gefunden.');
    } else if (updatedResults > 0 && importedMatches === 0 && importedTeams === 0) {
      setToastMessage(
        updatedResults === 1 ? '1 Ergebnis aktualisiert' : `${updatedResults} Ergebnisse aktualisiert`,
      );
    } else if (importedMatches > 0) {
      const resultSuffix =
        updatedResults > 0
          ? updatedResults === 1
            ? ', 1 Ergebnis'
            : `, ${updatedResults} Ergebnisse`
          : '';
      setToastMessage(
        importedMatches === 1
          ? `1 neues Spiel importiert${resultSuffix}`
          : `${importedMatches} neue Spiele importiert${resultSuffix}`,
      );
    } else {
      const teamMsg =
        importedTeams === 1 ? '1 neues Team importiert' : `${importedTeams} neue Teams importiert`;
      setToastMessage(
        updatedResults > 0
          ? `${teamMsg}, ${updatedResults === 1 ? '1 Ergebnis' : `${updatedResults} Ergebnisse`}`
          : teamMsg,
      );
    }
  }, [
    existingSlots,
    existingTeamNames,
    location,
    onImportComplete,
    recognition,
    refreshAnalysis,
    teamSeasonId,
    tournamentDayIso,
    tournamentEventId,
  ]);

  const btnH = embedded ? 'min-h-[34px]' : 'min-h-[44px]';
  const btnText = embedded ? 'text-[11px]' : 'text-sm';
  const iconCls = embedded ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const panelBody = (
    <div className={`flex flex-col ${embedded ? 'gap-2' : 'gap-3'}`}>
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="!mb-0 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
            Offizieller Turnierplan
          </CardTitle>
          <span className={dsStatusChipClass(hasUrl ? 'present' : 'neutral')}>
            {hasUrl ? 'Link hinterlegt' : 'Kein Link hinterlegt'}
          </span>
        </div>
      ) : (
        <span className={`w-fit ${dsStatusChipClass(hasUrl ? 'present' : 'neutral')}`}>
          {hasUrl ? 'Link hinterlegt' : 'Kein Link hinterlegt'}
        </span>
      )}

      {saveError ? (
        <p className="text-[12px] text-red-300/90" role="alert">
          {saveError}
        </p>
      ) : null}

      {tournamentArchived ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-950/15 px-2.5 py-1.5 text-[11px] leading-snug text-white/60">
          Turnier abgeschlossen — Aktualisieren ergänzt Daten, überschreibt keine Live-Daten.
        </p>
      ) : null}

      {hasUrl ? (
        <>
          <div
            className={`flex min-w-0 items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 ${embedded ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}
          >
            <Link2 className={`${iconCls} shrink-0 text-emerald-300/85`} strokeWidth={2} aria-hidden />
            <p className={`min-w-0 truncate font-semibold text-white ${embedded ? 'text-[12px]' : 'text-[15px]'}`}>
              {domain}
            </p>
          </div>
          <div className={embedded ? 'grid grid-cols-2 gap-1.5' : 'flex flex-col gap-2'}>
            <button
              type="button"
              className={`inline-flex ${btnH} w-full items-center justify-center gap-1.5 touch-manipulation ${btnText} font-semibold ${embedded ? '' : 'gap-2'} ${dsPrimaryCtaClass()} ${embedded ? 'col-span-2' : ''}`}
              onClick={handleOpen}
            >
              <ExternalLink className={iconCls} strokeWidth={2} aria-hidden />
              Öffnen
            </button>
            {canManage ? (
              <>
                <button
                  type="button"
                  className={`inline-flex ${btnH} w-full items-center justify-center gap-1.5 touch-manipulation ${btnText} font-semibold ${dsSecondaryCtaClass()}`}
                  onClick={() => void startImport()}
                >
                  <FileDown className={iconCls} strokeWidth={2} aria-hidden />
                  Importieren
                </button>
                <button
                  type="button"
                  className={`inline-flex ${btnH} w-full items-center justify-center gap-1.5 touch-manipulation ${btnText} font-semibold ${dsSecondaryCtaClass()}`}
                  onClick={() => void startRefresh()}
                >
                  <RefreshCw className={iconCls} strokeWidth={2} aria-hidden />
                  Aktualisieren
                </button>
                <button
                  type="button"
                  className={`inline-flex ${btnH} w-full items-center justify-center gap-1 touch-manipulation ${btnText} font-semibold ${dsScheduleGlassButtonClass()}`}
                  onClick={openQrScanner}
                >
                  <ScanLine className={iconCls} strokeWidth={2} aria-hidden />
                  QR scannen
                </button>
                <button
                  type="button"
                  className={`inline-flex ${btnH} w-full items-center justify-center gap-1 touch-manipulation ${btnText} font-semibold ${dsScheduleGlassButtonClass()}`}
                  onClick={openEditor}
                >
                  <Pencil className={iconCls} strokeWidth={2} aria-hidden />
                  Link
                </button>
              </>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p className={`text-white/65 ${embedded ? 'text-[12px]' : 'text-[14px]'}`}>
            Noch kein Turnierplan hinterlegt
          </p>
          {canManage ? (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                className={`inline-flex ${btnH} w-full items-center justify-center gap-1.5 touch-manipulation ${btnText} font-semibold ${dsSecondaryCtaClass()}`}
                onClick={openQrScanner}
              >
                <ScanLine className={iconCls} strokeWidth={2} aria-hidden />
                QR scannen
              </button>
              <button
                type="button"
                className={`inline-flex ${btnH} w-full items-center justify-center gap-1.5 touch-manipulation ${btnText} font-semibold ${dsSecondaryCtaClass()}`}
                onClick={openEditor}
              >
                <Link2 className={iconCls} strokeWidth={2} aria-hidden />
                Link
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <>
      {embedded ? panelBody : <Card className="relative border border-purple-500/20 bg-purple-950/15">{panelBody}</Card>}

      {toastMessage ? (
        <div
          className="pointer-events-none fixed left-1/2 z-[1003] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-emerald-500/35 bg-[rgba(10,8,18,0.96)] px-4 py-2.5 text-center text-[14px] font-medium text-white shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-sm bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:top-4 sm:bottom-auto"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      ) : null}

      {canManage ? (
        <>
          <TournamentPlanQrScannerSheet
            isOpen={qrScannerOpen}
            onClose={() => {
              if (qrSaving) return;
              setQrScannerOpen(false);
              setQrScanError(null);
              qrSaveInFlightRef.current = false;
            }}
            onScanSuccess={(rawValue) => void handleQrScan(rawValue)}
            scanError={qrScanError}
            onScanError={setQrScanError}
            saving={qrSaving}
            onEnterLink={() => {
              setQrScannerOpen(false);
              openEditor();
            }}
          />

          <TournamentPlanRefreshSheet
            isOpen={refreshSheetOpen}
            loading={refreshLoading}
            importing={refreshBusy}
            error={refreshError}
            analyzeFailure={refreshAnalyzeFailure}
            analyzeDiagnostics={refreshAnalyzeDiagnostics}
            preview={refreshPreview}
            analysis={refreshAnalysis}
            recognition={recognition}
            onClose={() => {
              if (refreshBusy) return;
              setRefreshSheetOpen(false);
            }}
            onImport={() => void handleRefreshConfirm()}
            onAddAlias={scrollToAliases}
          />

          <TournamentPlanImportSheet
            isOpen={importSheetOpen}
            loading={importLoading}
            importing={importBusy}
            error={importError}
            analyzeFailure={importAnalyzeFailure}
            analyzeDiagnostics={importAnalyzeDiagnostics}
            analysis={importAnalysis}
            recognition={recognition}
            onClose={() => {
              if (importBusy) return;
              setImportSheetOpen(false);
            }}
            onImport={() => void handleImportConfirm()}
            onAddAlias={scrollToAliases}
            onRetry={() => void startImport()}
            onEditLink={() => {
              setImportSheetOpen(false);
              openEditor();
            }}
          />

          <Modal
            isOpen={modalOpen}
            onClose={() => !saving && setModalOpen(false)}
            title="Offizieller Turnierplan"
            footer={
              <div className="flex justify-end gap-2">
                <AppButton variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                  Abbrechen
                </AppButton>
                <AppButton variant="primary" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? 'Speichern…' : 'Speichern'}
                </AppButton>
              </div>
            }
          >
            <div className="flex flex-col gap-3">
              {modalError ? (
                <p className="text-[13px] text-red-300/90" role="alert">
                  {modalError}
                </p>
              ) : null}
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] text-white/65">Turnierplan URL</span>
                <input
                  className={inputClass}
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  placeholder="https://..."
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </label>
            </div>
          </Modal>
        </>
      ) : null}
    </>
  );
};
