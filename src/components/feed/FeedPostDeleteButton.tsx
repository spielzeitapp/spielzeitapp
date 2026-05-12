import React, { useCallback, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteTeamFeedPostClient, type FeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';

type Props = {
  input: FeedPostDeleteInput;
  onDeleted: () => void;
};

export const FeedPostDeleteButton: React.FC<Props> = ({ input, onDeleted }) => {
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    if (!window.confirm('Diesen Beitrag wirklich löschen?')) return;
    setBusy(true);
    try {
      const res = await deleteTeamFeedPostClient(input);
      if (!res.ok) {
        window.alert(`Beitrag konnte nicht gelöscht werden: ${res.dbError ?? 'Unbekannter Fehler'}`);
        return;
      }
      if (res.storageWarnings.length > 0) {
        window.alert(
          `Beitrag wurde aus dem Feed entfernt. Datei im Speicher konnte nicht vollständig gelöscht werden: ${res.storageWarnings.join(' · ')}`,
        );
      }
      onDeleted();
    } finally {
      setBusy(false);
    }
  }, [input, onDeleted]);

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className="inline-flex min-h-[36px] min-w-[36px] shrink-0 touch-manipulation items-center justify-center gap-1 rounded-full border border-white/15 bg-black/50 px-2 py-1.5 text-[11px] font-semibold text-amber-200/95 backdrop-blur-sm transition hover:border-amber-500/35 hover:bg-black/70 disabled:opacity-45"
      aria-label="Beitrag löschen"
    >
      <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="hidden sm:inline">Löschen</span>
    </button>
  );
};
