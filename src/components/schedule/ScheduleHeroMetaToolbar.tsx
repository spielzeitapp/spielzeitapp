import React from 'react';
import { ChevronRight } from 'lucide-react';

export type ScheduleHeroMetaItem = {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Treffpunkt-Spalte: Deep-Red-Akzent (Spiel-Hero). */
  accent?: boolean;
};

type Props = {
  items: ScheduleHeroMetaItem[];
  onChevronClick?: () => void;
  showChevron?: boolean;
  className?: string;
};

const labelClass = 'text-[9px] font-semibold uppercase tracking-[0.1em] text-white/45';
const valueClass = 'mt-0.5 text-[13px] font-bold tabular-nums leading-tight text-white';

function MetaBlock({ item, withBorder }: { item: ScheduleHeroMetaItem; withBorder: boolean }) {
  return (
    <div
      className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center px-1.5 py-2 text-center sm:px-2 ${
        withBorder ? 'border-l border-white/10' : ''
      } ${item.accent ? 'bg-[rgba(58,18,24,0.35)]' : ''}`}
    >
      <span className="text-white/75 [&_svg]:h-4 [&_svg]:w-4">{item.icon}</span>
      <span className={`mt-1.5 w-full ${labelClass}`}>{item.label}</span>
      <span className={`w-full ${valueClass}`}>{item.value}</span>
    </div>
  );
}

/** Beginn | Treffpunkt | Ende | Chevron — strukturierte Meta-Row (Termine-Hero). */
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
      className={`border-t border-white/[0.1] bg-[rgba(0,0,0,0.12)] pt-0 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-stretch">
        <MetaBlock item={blocks[0]!} withBorder={false} />
        <MetaBlock item={blocks[1]!} withBorder />
        <MetaBlock item={blocks[2]!} withBorder />
        {showChevron && onChevronClick ? (
          <button
            type="button"
            className="flex min-h-[58px] min-w-[44px] items-center justify-center border-l border-white/10 px-2 text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/65 active:bg-white/[0.06]"
            aria-label="Termin öffnen"
            onClick={(e) => {
              e.stopPropagation();
              onChevronClick();
            }}
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <div className="min-h-[58px] min-w-[44px] border-l border-white/10" aria-hidden />
        )}
      </div>
    </div>
  );
}
