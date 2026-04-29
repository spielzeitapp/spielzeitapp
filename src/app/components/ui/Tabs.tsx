import React from 'react';

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

export interface TabOption {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabOption[];
  activeId: string;
  onChange: (id: string) => void;
  /** Stadium: rote Unterstreichung, inaktiv grau. */
  variant?: 'default' | 'stadium';
  /** Engere Tabs für viele Einträge (z. B. Team-Screen auf Mobil). */
  compact?: boolean;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeId, onChange, variant = 'default', compact = false }) => {
  const stadium = variant === 'stadium';
  return (
    <div
      className={cn(
        'flex w-full overflow-x-auto no-scrollbar border-b',
        stadium ? 'border-white/10' : 'border-[var(--border)]/60',
      )}
    >
      <div className="flex min-w-full gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex-1 whitespace-nowrap font-semibold uppercase transition-colors',
                compact ? 'px-1.5 py-2 text-[10px] tracking-tight sm:px-2 sm:text-xs sm:tracking-wide' : 'px-3 py-2.5 text-xs tracking-wide',
                stadium
                  ? isActive
                    ? 'text-red-400'
                    : 'text-white/45 hover:text-white/70'
                  : isActive
                    ? 'text-[var(--primary)]'
                    : 'text-[var(--muted)] hover:text-slate-300',
              )}
            >
              {tab.label}
              {isActive && (
                <span
                  className={cn(
                    'absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full',
                    stadium ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'bg-[var(--primary)]',
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

