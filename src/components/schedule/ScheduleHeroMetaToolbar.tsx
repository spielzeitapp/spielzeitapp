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

const labelClass = 'text-[9px] font-semibold uppercase tracking-[0.12em] text-white/42';
const valueClass = 'mt-1 text-[14px] font-bold tabular-nums leading-tight text-white';

function MetaBlock({ item, withBorder }: { item: ScheduleHeroMetaItem; withBorder: boolean }) {
  if (item.hidden) {
    return <div className={withBorder ? 'border-l border-white/[0.08]' : ''} aria-hidden />;
  }
  return (
    <div
      className={`flex min-h-[62px] min-w-0 flex-col items-center justify-center px-1 py-2.5 text-center sm:px-1.5 ${
        withBorder ? 'border-l border-white/[0.08]' : ''
      } ${item.accent ? 'bg-[rgba(58,18,24,0.32)]' : ''}`}
    >
      <span className="text-[#B85C68] [&_svg]:h-3.5 [&_svg]:w-3.5">{item.icon}</span>
      <span className={`mt-1.5 w-full ${labelClass}`}>{item.label}</span>
      <span className={`w-full ${valueClass}`}>{item.value}</span>
    </div>
  );
}

/** Beginn | Treffpunkt | Ende | Chevron — Meta-Bar wie Zielbild. */
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
      className={`mt-3 border-t border-white/[0.08] bg-[rgba(0,0,0,0.22)] ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-[1fr_1fr_1fr_36px] items-stretch">
        <MetaBlock item={blocks[0]!} withBorder={false} />
        <MetaBlock item={blocks[1]!} withBorder />
        <MetaBlock item={blocks[2]!} withBorder />
        {showChevron && onChevronClick ? (
          <button
            type="button"
            className="flex min-h-[62px] items-center justify-center border-l border-white/[0.08] text-white/65 opacity-65 transition-colors hover:bg-white/[0.03] hover:opacity-80 active:bg-white/[0.05]"
            aria-label="Termin öffnen"
            onClick={(e) => {
              e.stopPropagation();
              onChevronClick();
            }}
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <div className="min-h-[62px] border-l border-white/[0.08]" aria-hidden />
        )}
      </div>
    </div>
  );
}
