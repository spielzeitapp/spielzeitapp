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

const labelClass = 'text-[9px] font-bold uppercase tracking-[0.1em] text-white/48 leading-none';
const valueClass =
  'mt-1 max-w-full truncate whitespace-nowrap text-[15px] font-bold tabular-nums leading-none text-white sm:text-[16px]';

function MetaBlock({ item, withBorder }: { item: ScheduleHeroMetaItem; withBorder: boolean }) {
  if (item.hidden) {
    return <div className={withBorder ? 'border-l border-white/[0.05]' : ''} aria-hidden />;
  }
  return (
    <div
      className={`flex min-h-[48px] min-w-0 flex-col items-center justify-center px-0.5 py-2 text-center sm:px-1 ${
        withBorder ? 'border-l border-white/[0.05]' : ''
      } ${item.accent ? 'bg-[rgba(58,18,24,0.2)]' : ''}`}
    >
      <span className="flex h-5 shrink-0 items-center text-[#B85C68] [&_svg]:h-[18px] [&_svg]:w-[18px] sm:[&_svg]:h-5 sm:[&_svg]:w-5">
        {item.icon}
      </span>
      <span className={`w-full ${labelClass}`}>{item.label}</span>
      <span className={`w-full ${valueClass}`} title={item.value}>
        {item.value}
      </span>
    </div>
  );
}

/** Beginn | Treffpunkt | Ende | Chevron — Meta-Bar mit klarer Lesbarkeit. */
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
      className={`mt-2.5 border-t border-white/[0.05] bg-[rgba(0,0,0,0.24)] py-1.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-[1fr_1fr_1fr_28px] items-center">
        <MetaBlock item={blocks[0]!} withBorder={false} />
        <MetaBlock item={blocks[1]!} withBorder />
        <MetaBlock item={blocks[2]!} withBorder />
        {showChevron && onChevronClick ? (
          <button
            type="button"
            className="flex h-[48px] items-center justify-center border-l border-white/[0.05] text-white/40 opacity-50 transition-colors hover:bg-white/[0.02] hover:opacity-65 active:bg-white/[0.03]"
            aria-label="Termin öffnen"
            onClick={(e) => {
              e.stopPropagation();
              onChevronClick();
            }}
          >
            <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <div className="h-[48px] border-l border-white/[0.05]" aria-hidden />
        )}
      </div>
    </div>
  );
}
