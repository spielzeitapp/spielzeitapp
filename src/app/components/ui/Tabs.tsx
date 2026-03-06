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
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeId, onChange }) => {
  return (
    <div className="flex w-full overflow-x-auto no-scrollbar border-b border-[var(--border)]/60">
      <div className="flex min-w-full gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex-1 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors',
                isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)] hover:text-slate-300',
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-6 -bottom-0.5 h-0.5 rounded-full bg-[var(--primary)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

