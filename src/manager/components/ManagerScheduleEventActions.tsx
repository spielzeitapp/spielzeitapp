import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';

type Props = {
  allowed: boolean;
  eventId: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function ManagerScheduleEventActions({ allowed, eventId, onEdit, onDelete }: Props): React.ReactElement | null {
  if (!allowed) return null;
  return <div role="toolbar" aria-label="Termin verwalten" data-event-id={eventId}
    className="my-2 flex flex-wrap justify-end gap-2" onClick={event => event.stopPropagation()}>
    <button type="button" onClick={onEdit} aria-label="Termin bearbeiten"
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
      <Pencil className="h-4 w-4" aria-hidden />Bearbeiten
    </button>
    <button type="button" onClick={onDelete} aria-label="Termin löschen"
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50">
      <Trash2 className="h-4 w-4" aria-hidden />Löschen
    </button>
  </div>;
}
