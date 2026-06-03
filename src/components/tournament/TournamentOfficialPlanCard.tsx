import React, { useEffect, useState } from 'react';
import { ClipboardList, ExternalLink, Link2, Pencil } from 'lucide-react';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { AppButton } from '../ui/AppButton';
import { Modal } from '../../app/ui/Modal';
import {
  dsPrimaryCtaClass,
  dsScheduleGlassButtonClass,
  dsSecondaryCtaClass,
  dsStatusChipClass,
} from '../../lib/premiumDesignSystem';
import {
  displayDomainFromOfficialPlanUrl,
  openOfficialTournamentPlanUrl,
  saveOfficialTournamentPlanUrl,
  validateOfficialTournamentUrl,
} from '../../lib/tournamentOfficialPlanUrl';

type Props = {
  tournamentEventId: string;
  officialTournamentUrl: string | null;
  canManage: boolean;
  onUrlUpdated: (url: string | null) => void;
};

const inputClass =
  'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white placeholder:text-white/40 focus:border-purple-500/45 focus:outline-none';

export const TournamentOfficialPlanCard: React.FC<Props> = ({
  tournamentEventId,
  officialTournamentUrl,
  canManage,
  onUrlUpdated,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasUrl = Boolean(officialTournamentUrl?.trim());
  const domain = displayDomainFromOfficialPlanUrl(officialTournamentUrl);

  useEffect(() => {
    if (modalOpen) {
      setDraftUrl(officialTournamentUrl?.trim() ?? '');
      setModalError(null);
    }
  }, [modalOpen, officialTournamentUrl]);

  const openEditor = () => {
    setSaveError(null);
    setModalOpen(true);
  };

  const handleOpen = () => {
    const url = officialTournamentUrl?.trim();
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
  };

  return (
    <>
      <Card className="relative border border-purple-500/20 bg-purple-950/15">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="!mb-0 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-purple-300/90" strokeWidth={2} aria-hidden />
              Offizieller Turnierplan
            </CardTitle>
            <span className={dsStatusChipClass(hasUrl ? 'present' : 'neutral')}>
              {hasUrl ? 'Link hinterlegt' : 'Kein Link hinterlegt'}
            </span>
          </div>

          {saveError ? (
            <p className="text-[13px] text-red-300/90" role="alert">
              {saveError}
            </p>
          ) : null}

          {hasUrl ? (
            <>
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2.5">
                <Link2 className="h-4 w-4 shrink-0 text-emerald-300/85" strokeWidth={2} aria-hidden />
                <p className="min-w-0 truncate text-[15px] font-semibold text-white">{domain}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 touch-manipulation sm:w-auto ${dsPrimaryCtaClass()}`}
                  onClick={handleOpen}
                >
                  <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Turnierplan öffnen
                </button>
                {canManage ? (
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
                    <button
                      type="button"
                      className={`inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 touch-manipulation ${dsScheduleGlassButtonClass()}`}
                      onClick={handleOpen}
                    >
                      Öffnen
                    </button>
                    <button
                      type="button"
                      className={`inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 touch-manipulation ${dsScheduleGlassButtonClass()}`}
                      onClick={openEditor}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      Bearbeiten
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="text-[14px] text-white/65">Noch kein Turnierplan hinterlegt</p>
              {canManage ? (
                <button
                  type="button"
                  className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 touch-manipulation sm:w-auto ${dsSecondaryCtaClass()}`}
                  onClick={openEditor}
                >
                  <Link2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Link hinzufügen
                </button>
              ) : null}
            </>
          )}
        </div>
      </Card>

      {canManage ? (
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
      ) : null}
    </>
  );
};
