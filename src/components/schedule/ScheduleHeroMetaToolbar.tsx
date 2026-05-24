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

const labelClass = 'mt-1 text-[8px] font-semibold uppercase tracking-[0.06em] text-white/42 leading-none';

function splitMetaValue(value: string): { primary: string; showUhr: boolean } {
  const v = value.trim();
  if (!v || v === 'Offen' || v === '—') return { primary: v || 'Offen', showUhr: false };
  const m = v.match(/^(.+?)\s+Uhr$/i);
  if (m?.[1]) return { primary: m[1].trim(), showUhr: true };
  return { primary: v, showUhr: false };
}

function MetaBlock({ item, withBorder }: { item: ScheduleHeroMetaItem; withBorder: boolean }) {
  if (item.hidden) {
    return <div className={withBorder ? 'border-l border-white/[0.05]' : ''} aria-hidden />;
  }

  const { primary, showUhr } = splitMetaValue(item.value);

  return (
    <div
      className={`flex min-h-[56px] min-w-0 flex-col items-center justify-center px-0.5 py-1.5 text-center sm:px-1 ${
        withBorder ? 'border-l border-white/[0.05]' : ''
      } ${item.accent ? 'bg-[rgba(58,18,24,0.18)]' : ''}`}
    >
      <span className="flex h-[17px] shrink-0 items-center text-[#B85C68] [&_svg]:h-[17px] [&_svg]:w-[17px]">
        {item.icon}
      </span>
      <span className={`w-full ${labelClass}`}>{item.label}</span>
      <div className="mt-0.5 flex w-full flex-col items-center leading-none">
        <span className="max-w-full truncate whitespace-nowrap text-[15px] font-bold tabular-nums text-white">
          {primary}
        </span>
        {showUhr ? (
          <span className="mt-0.5 text-[10px] font-medium text-white/65">Uhr</span>
        ) : null}
      </div>
    </div>
  );
}

/** Beginn | Treffpunkt | Ende | Chevron — ruhige Meta-Bar. */
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
      className={`mt-2.5 border-t border-white/[0.04] bg-[rgba(0,0,0,0.22)] ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-[1fr_1fr_1fr_42px] items-center">
        <MetaBlock item={blocks[0]!} withBorder={false} />
        <MetaBlock item={blocks[1]!} withBorder />
        <MetaBlock item={blocks[2]!} withBorder />
        {showChevron && onChevronClick ? (
          <button
            type="button"
            className="flex h-[56px] w-[42px] shrink-0 items-center justify-center border-l border-white/[0.05] text-white/80 opacity-[0.82] transition-colors hover:bg-white/[0.03] hover:opacity-95 active:bg-white/[0.04]"
            aria-label="Termin öffnen"
            onClick={(e) => {
              e.stopPropagation();
              onChevronClick();
            }}
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </button>
        ) : (
          <div className="h-[56px] border-l border-white/[0.05]" aria-hidden />
        )}
      </div>
    </div>
  );
}
