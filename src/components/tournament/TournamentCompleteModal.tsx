import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../app/ui/Modal';
import { AppButton } from '../ui/AppButton';
import { buildTournamentCompletionDefaults, placementLabelFromRank } from '../../lib/tournamentCompletionDisplay';
import type { TournamentFinalSummary } from '../../lib/tournamentFinalSummary';
import { isTournamentCompletionFeedPublished } from '../../lib/tournamentCompletionFeed';

export type TournamentCompleteFormValues = {
  placementRank: number | null;
  teamsCount: number | null;
  label: string | null;
  comment: string;
  publishFeed: boolean;
};

type Props = {
  isOpen: boolean;
  tournamentEventId: string;
  summary: TournamentFinalSummary | null;
  participantCount: number;
  planTeamCount: number | null;
  completing?: boolean;
  onClose: () => void;
  onConfirm: (values: TournamentCompleteFormValues) => void;
};

export function TournamentCompleteModal({
  isOpen,
  tournamentEventId,
  summary,
  participantCount,
  planTeamCount,
  completing = false,
  onClose,
  onConfirm,
}: Props) {
  const defaults = useMemo(
    () =>
      buildTournamentCompletionDefaults({
        summary,
        participantCount,
        planTeamCount,
      }),
    [summary, participantCount, planTeamCount],
  );

  const [placementInput, setPlacementInput] = useState('');
  const [teamsInput, setTeamsInput] = useState('');
  const [comment, setComment] = useState('');
  const [publishFeed, setPublishFeed] = useState(true);
  const [feedAlreadyPosted, setFeedAlreadyPosted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPlacementInput(defaults.placementRank != null ? String(defaults.placementRank) : '');
    setTeamsInput(defaults.teamsCount != null ? String(defaults.teamsCount) : '');
    setComment('');
    setPublishFeed(true);
    void isTournamentCompletionFeedPublished(tournamentEventId).then(setFeedAlreadyPosted);
  }, [isOpen, defaults, tournamentEventId]);

  const handleSubmit = () => {
    const placementRank = Number.parseInt(placementInput, 10);
    const teamsCount = Number.parseInt(teamsInput, 10);
    const rank = Number.isFinite(placementRank) && placementRank > 0 ? placementRank : null;
    const teams = Number.isFinite(teamsCount) && teamsCount > 0 ? teamsCount : null;
    const label = rank != null ? placementLabelFromRank(rank) : defaults.label;

    onConfirm({
      placementRank: rank,
      teamsCount: teams,
      label,
      comment: comment.trim(),
      publishFeed: publishFeed && !feedAlreadyPosted,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Turnier abschließen">
      <p className="mb-3 text-[13px] leading-snug text-white/65">
        Alle Turnierspiele sind beendet. Trage die Endplatzierung ein und schließe das Turnier ab.
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-white/70">Platzierung (Rang)</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white"
            value={placementInput}
            onChange={(e) => setPlacementInput(e.target.value)}
            placeholder="z. B. 2"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-white/70">Anzahl Teams</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white"
            value={teamsInput}
            onChange={(e) => setTeamsInput(e.target.value)}
            placeholder="z. B. 8"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-white/70">Abschluss-Kommentar (optional)</span>
          <textarea
            className="min-h-[88px] w-full resize-y rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[14px] text-white"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Kurzer Abschluss-Kommentar für Bericht oder Feed…"
          />
        </label>

        <label className="flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-1"
            checked={publishFeed}
            disabled={feedAlreadyPosted}
            onChange={(e) => setPublishFeed(e.target.checked)}
          />
          <span className="text-[13px] leading-snug text-white/75">
            {feedAlreadyPosted
              ? 'Feed-Beitrag wurde bereits veröffentlicht.'
              : 'Abschluss-Beitrag im Team-Feed veröffentlichen (ohne Push-Benachrichtigung).'}
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AppButton variant="primary" disabled={completing} onClick={handleSubmit}>
          {completing ? 'Wird abgeschlossen…' : 'Turnier abschließen'}
        </AppButton>
        <AppButton variant="secondary" disabled={completing} onClick={onClose}>
          Abbrechen
        </AppButton>
      </div>
    </Modal>
  );
}
