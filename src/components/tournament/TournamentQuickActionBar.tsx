import React, { useState } from 'react';
import { CalendarPlus, MapPin, Share2 } from 'lucide-react';
import { shareTournamentCenter } from './tournamentCenterUtils';

type Props = {
  shareTitle: string;
  onAddToCalendar: () => void;
  onNavigate?: () => void;
  showNavigation?: boolean;
};

export function TournamentQuickActionBar({
  shareTitle,
  onAddToCalendar,
  onNavigate,
  showNavigation = false,
}: Props) {
  const [shareHint, setShareHint] = useState<string | null>(null);

  const handleShare = async () => {
    const ok = await shareTournamentCenter(shareTitle);
    setShareHint(ok ? 'Link kopiert' : 'Teilen nicht verfügbar');
    window.setTimeout(() => setShareHint(null), 2200);
  };

  return (
    <div className="relative">
      <div
        className="flex items-stretch gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="toolbar"
        aria-label="Schnellaktionen"
      >
        <ActionChip icon={CalendarPlus} label="Kalender" onClick={onAddToCalendar} />
        {showNavigation && onNavigate ? (
          <ActionChip icon={MapPin} label="Navigation" onClick={onNavigate} />
        ) : null}
        <ActionChip icon={Share2} label="Teilen" onClick={() => void handleShare()} />
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
}: {
  icon: typeof CalendarPlus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border border-[rgba(255,71,71,0.18)] bg-[rgba(255,71,71,0.05)] px-3 py-1.5 text-[11px] font-semibold text-white/88 touch-manipulation transition hover:border-[rgba(255,71,71,0.3)] hover:bg-[rgba(255,71,71,0.1)] active:scale-[0.98]"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-red-300/85" strokeWidth={2.25} aria-hidden />
      {label}
    </button>
  );
}
