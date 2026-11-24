import { useRef, useState } from 'react';
import { Modal } from '../../app/ui/Modal';
import {
  analyzeTournamentUrl,
  fetchTournamentImportRecognition,
  isRecognizedTournamentPlanHost,
  replaceTournamentPlanFromAnalysis,
  type TournamentPlanAnalysis,
} from '../../lib/tournamentPlanImport';
import { validateOfficialTournamentUrl } from '../../lib/tournamentOfficialPlanUrl';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { AppButton } from '../ui/AppButton';

type Props = {
  tournamentEventId: string;
  teamSeasonId: string;
  officialTournamentUrl: string | null;
  existingSlots: TournamentMatchSlotView[];
  onClose: () => void;
  onReplaced: (url: string) => void;
};

type Preview = {
  previousUrl: string | null;
  previousSlotIds: string[];
  url: string;
  analysis: TournamentPlanAnalysis;
  knownNames: string[];
};

export function TournamentPlanReplaceDialog({
  tournamentEventId,
  teamSeasonId,
  officialTournamentUrl,
  existingSlots,
  onClose,
  onReplaced,
}: Props) {
  const [draftUrl, setDraftUrl] = useState(officialTournamentUrl ?? '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  const run = async (action: () => Promise<void>) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Der Turnierplan konnte nicht geladen werden.');
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const loadPreview = () => run(async () => {
    const validated = validateOfficialTournamentUrl(draftUrl);
    if (!validated.ok) throw new Error(validated.error);
    if (!isRecognizedTournamentPlanHost(validated.url)) {
      throw new Error('Bitte einen Link von MeinTurnierplan oder Tournament Live eingeben.');
    }
    const [result, recognition] = await Promise.all([
      analyzeTournamentUrl(validated.url),
      fetchTournamentImportRecognition(teamSeasonId),
    ]);
    if (!result.ok) throw new Error(result.error);
    if (!result.analysis.rawMatches.length || !result.analysis.teams.length) {
      throw new Error('Im neuen Plan wurden keine Spiele oder Mannschaften gefunden.');
    }
    setPreview({
      previousUrl: officialTournamentUrl,
      previousSlotIds: existingSlots.map((slot) => slot.id),
      url: validated.url,
      analysis: result.analysis,
      knownNames: recognition.knownNames,
    });
  });

  const replace = () => run(async () => {
    if (!preview) return;
    const { error } = await replaceTournamentPlanFromAnalysis({ tournamentEventId, ...preview });
    if (error) {
      setPreview(null);
      throw new Error(error);
    }
    onReplaced(preview.url);
  });

  return (
    <Modal
      className="tournamentWorkflowModal"
      isOpen
      title="Turnierplan ersetzen"
      onClose={() => { if (!requestInFlight.current) onClose(); }}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>Abbrechen</AppButton>
          {preview ? (
            <AppButton variant="danger" onClick={() => void replace()} disabled={busy}>
              {busy ? 'Wird ersetzt…' : 'Spielplan ersetzen'}
            </AppButton>
          ) : (
            <AppButton variant="primary" onClick={() => void loadPreview()} disabled={busy}>
              {busy ? 'Wird geladen…' : 'Vorschau laden'}
            </AppButton>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <p>Alle bisherigen Spiele samt Spielaufstellungen und die ausgeschiedenen Mannschaften samt ihren Anmeldungen werden entfernt. Der Turniertermin und der Turnierkader bleiben erhalten.</p>
        <p>Der Plan kann bis zum ersten Spielbeginn oder Ergebnis ersetzt werden.</p>
        <label className="block space-y-1">
          <span>Link zum neuen Turnierplan</span>
          <input
            className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[16px] text-white"
            value={draftUrl}
            onChange={(event) => {
              setDraftUrl(event.target.value);
              setPreview(null);
              setError(null);
            }}
            placeholder="https://…"
            disabled={busy}
            inputMode="url"
            autoComplete="url"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>
        {error ? <p className="text-red-300" role="alert">{error}</p> : null}
        {preview ? (
          <div className="space-y-1 rounded-xl border border-white/15 bg-white/[0.04] p-3" role="status">
            {preview.analysis.tournamentName ? <p className="font-semibold">{preview.analysis.tournamentName}</p> : null}
            <p>{preview.previousSlotIds.length} bisherige Spiele werden entfernt.</p>
            <p>Der neue Plan enthält {preview.analysis.teams.length} Mannschaften und {preview.analysis.rawMatches.length} Spiele.</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
