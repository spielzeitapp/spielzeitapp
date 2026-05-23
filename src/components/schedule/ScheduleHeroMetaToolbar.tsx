import React from 'react';
import { ChevronRight } from 'lucide-react';

export type ScheduleHeroMetaItem = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

type Props = {
  items: ScheduleHeroMetaItem[];
  /** Chevron öffnet Detail (stoppt Card-Bubble). */
  onChevronClick?: () => void;
  showChevron?: boolean;
  className?: string;
};

const labelClass = 'text-[10px] font-medium uppercase tracking-[0.06em] text-white/48';
const valueClass = 'mt-0.5 text-[12px] font-semibold tabular-nums leading-snug text-white/92';

function MetaBlock({ item, withBorder }: { item: ScheduleHeroMetaItem; withBorder: boolean }) {
  return (
    <div
      className={`flex min-h-[52px] min-w-0 flex-col items-start justify-center px-2.5 py-1.5 sm:px-3 ${
        withBorder ? 'border-l border-white/10' : ''
      }`}
    >
      <span className="text-[#B85C68] [&_svg]:h-3.5 [&_svg]:w-3.5">{item.icon}</span>
      <span className={`mt-1 ${labelClass}`}>{item.label}</span>
      <span className={valueClass}>{item.value}</span>
    </div>
  );
}

/** Beginn · Treffpunkt · Ende — 3 Blöcke + Chevron (Termine-Hero). */
export function ScheduleHeroMetaToolbar({
  items,
  onChevronClick,
  showChevron = true,
  className = '',
}: Props) {
  const blocks: ScheduleHeroMetaItem[] = [
    items[0] ?? { icon: null, label: 'Beginn', value: '—' },
    items[1] ?? { icon: null, label: 'Treffpunkt', value: '—' },
    items[2] ?? { icon: null, label: 'Ende', value: '—' },
  ];

  return (
    <div
      className={`border-t border-white/[0.08] pt-2.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-stretch">
        <MetaBlock item={blocks[0]!} withBorder={false} />
        <MetaBlock item={blocks[1]!} withBorder />
        <MetaBlock item={blocks[2]!} withBorder />
        {showChevron && onChevronClick ? (
          <button
            type="button"
            className="flex min-h-[52px] min-w-[44px] items-center justify-center border-l border-white/10 px-2 text-white/35 transition-colors hover:bg-white/[0.03] hover:text-white/55 active:bg-white/[0.05]"
            aria-label="Termin öffnen"
            onClick={(e) => {
              e.stopPropagation();
              onChevronClick();
            }}
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <div className="min-w-[44px] border-l border-white/10" aria-hidden />
        )}
      </div>
    </div>
  );
}
