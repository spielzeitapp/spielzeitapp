import React, { useState } from 'react';
import { CalendarClock, CalendarPlus, MapPin, Pencil, Share2, Trash2, XCircle } from 'lucide-react';

type Props = {
  onAddToCalendar: () => void;
  onNavigate?: () => void;
  showNavigation?: boolean;
  onShare?: () => Promise<boolean>;
  onEdit?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  onDelete?: () => void;
  layout?: 'scroll' | 'grid';
};

export function CenterQuickActionBar({
  onAddToCalendar,
  onNavigate,
  showNavigation = false,
  onShare,
  onEdit,
  onReschedule,
  onCancel,
  cancelLabel = 'Training absagen',
  onDelete,
  layout = 'scroll',
}: Props) {
  const [shareHint, setShareHint] = useState<string | null>(null);

  const handleShare = async () => {
    if (!onShare) return;
    const ok = await onShare();
    setShareHint(ok ? 'Link kopiert' : 'Teilen nicht verfügbar');
    window.setTimeout(() => setShareHint(null), 2200);
  };

  return (
    <div className="relative">
      <div
        className={
          layout === 'grid'
            ? 'grid grid-cols-2 gap-2'
            : 'flex items-stretch gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        }
        role="toolbar"
        aria-label="Schnellaktionen"
      >
        <ActionChip icon={CalendarPlus} label="Kalender" onClick={onAddToCalendar} layout={layout} />
        {showNavigation && onNavigate ? (
          <ActionChip icon={MapPin} label="Navigation" onClick={onNavigate} layout={layout} />
        ) : null}
        {onShare ? <ActionChip icon={Share2} label="Teilen" onClick={() => void handleShare()} layout={layout} /> : null}
        {onEdit ? <ActionChip icon={Pencil} label="Bearbeiten" onClick={onEdit} layout={layout} /> : null}
        {onReschedule ? <ActionChip icon={CalendarClock} label="Verschieben" onClick={onReschedule} layout={layout} /> : null}
        {onCancel ? <ActionChip icon={XCircle} label={cancelLabel} onClick={onCancel} dangerTone="cancel" layout={layout} /> : null}
        {onDelete ? <ActionChip icon={Trash2} label="Löschen" onClick={onDelete} dangerTone="delete" layout={layout} /> : null}
      </div>
      {shareHint ? (
        <span
          className="pointer-events-none absolute -bottom-6 right-0 z-10 rounded-md border border-white/10 bg-black/90 px-2 py-0.5 text-[10px] text-white/75"
          role="status"
        >
          {shareHint}
        </span>
      ) : null}
    </div>
  );
}

function ActionChip({
  icon: Icon,
  label,
  onClick,
  dangerTone,
  layout = 'scroll',
}: {
  icon: typeof CalendarPlus;
  label: string;
  onClick: () => void;
  dangerTone?: 'cancel' | 'delete';
  layout?: 'scroll' | 'grid';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-0 shrink-0 items-center justify-center gap-2 text-center leading-tight touch-manipulation transition active:scale-[0.98] ${
        layout === 'grid'
          ? 'sz-club-event-action min-h-[56px] w-full rounded-[15px] border px-2 py-2.5 text-[14px] font-bold'
          : 'min-h-[34px] rounded-full px-3 py-1.5 text-[11px] font-semibold'
      } ${dangerTone ? layout === 'grid' ? 'sz-club-event-action--danger text-white/90' : 'border border-red-400/35 bg-red-950/35 text-red-200 hover:bg-red-900/45' : layout === 'grid' ? 'text-white/90' : 'border border-[rgba(255,71,71,0.18)] bg-[rgba(255,71,71,0.05)] text-white/88 hover:border-[rgba(255,71,71,0.3)] hover:bg-[rgba(255,71,71,0.1)]'}`}
    >
      <Icon className={`${layout === 'grid' ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5'} shrink-0 ${dangerTone === 'cancel' ? 'text-amber-300' : dangerTone === 'delete' ? 'text-rose-300' : 'sz-club-accent-text'}`} strokeWidth={2.25} aria-hidden />
      {label}
    </button>
  );
}
