import React, { useCallback, useState } from 'react';
import { Copy } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
import { AppButton } from '../ui/AppButton';

type Props = {
  isOpen: boolean;
  reportText: string;
  onClose: () => void;
};

export const TournamentReportModal: React.FC<Props> = ({ isOpen, reportText, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [reportText]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Turnierbericht">
      <p className="mb-3 text-[13px] text-white/65">
        Vorschlag für einen Feed-Beitrag. Noch nicht automatisch veröffentlicht.
      </p>
      <textarea
        readOnly
        value={reportText}
        className="min-h-[220px] w-full resize-y rounded-xl border border-white/12 bg-black/35 px-3 py-2.5 text-[14px] leading-relaxed text-white"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <AppButton variant="primary" onClick={() => void handleCopy()} className="inline-flex items-center gap-2">
          <Copy className="h-4 w-4" aria-hidden />
          {copied ? 'Kopiert' : 'Text kopieren'}
        </AppButton>
        <AppButton variant="secondary" onClick={onClose}>
          Schließen
        </AppButton>
      </div>
    </Modal>
  );
};
