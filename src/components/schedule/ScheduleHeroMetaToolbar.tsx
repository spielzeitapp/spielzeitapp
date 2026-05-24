import React from 'react';
import { ChevronRight } from 'lucide-react';

export type ScheduleHeroMetaItem = {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  hidden?: boolean;
};

type Props = {
  items: ScheduleHeroMetaItem[];
  onChevronClick?: () => void;
  showChevron?: boolean;
  className?: string;
};

const labelClass = 'text-[8px] font-semibold uppercase tracking-[0.11em] text-white/40';
const valueClass =
  'mt-0.5 max-w-full truncate whitespace-nowrap text-[13px] font-bold tabular-nums leading-none text-white';

function MetaBlock({ item, withBorder }: { item: ScheduleHeroMetaItem; withBorder: boolean }) {
  if (item.hidden) {
    return <div className={withBorder ? 'border-l border-white/[0.08]' : ''} aria-hidden />;
  }
  return (
    <div
      className={`flex min-h-[50px] min-w-0 flex-col items-center justify-center px-0.5 py-1.5 text-center sm:px-1 ${
        withBorder ? 'border-l border-white/[0.07]' : ''
      } ${item.accent ? 'bg-[rgba(58,18,24,0.28)]' : ''}`}
    >
      <span className="text-[#B85C68] [&_svg]:h-3 [&_svg]:w-3">{item.icon}</span>
      <span className={`mt-1 w-full ${labelClass}`}>{item.label}</span>
      <span className={`w-full ${valueClass}`} title={item.value}>
        {item.value}
      </span>
    </div>
  );
}

/** Beginn | Treffpunkt | Ende | Chevron — kompakte Meta-Bar. */
export function ScheduleHeroMetaToolbar({
  items,
  onChevronClick,
  showChevron = true,
  className = '',
}: Props) {
  const blocks: ScheduleHeroMetaItem[] = [
    items[0] ?? { icon: null, label: 'Beginn', value: 'Offen' },
    items[1] ?? { icon: null, label: 'Treffpunkt', value: 'Offen' },
    items[2] ?? { icon: null, label: 'Ende', value: 'Offen' },
  ];

  return (
    <div
      className={`mt-2.5 border-t border-white/[0.07] bg-[rgba(0,0,0,0.24)] ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-[1fr_1fr_1fr_32px] items-stretch">
        <MetaBlock item={blocks[0]!} withBorder={false} />
        <MetaBlock item={blocks[1]!} withBorder />
        <MetaBlock item={blocks[2]!} withBorder />
        {showChevron && onChevronClick ? (
          <button
            type="button"
            className="flex min-h-[50px] items-center justify-center border-l border-white/[0.07] text-white/50 opacity-60 transition-colors hover:bg-white/[0.02] hover:opacity-75 active:bg-white/[0.04]"
            aria-label="Termin öffnen"
            onClick={(e) => {
              e.stopPropagation();
              onChevronClick();
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <div className="min-h-[50px] border-l border-white/[0.07]" aria-hidden />
        )}
      </div>
    </div>
  );
}
