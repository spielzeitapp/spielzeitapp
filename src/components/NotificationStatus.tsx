import { Bell, BellOff, BellRing } from 'lucide-react';

type Props = {
  tone?: 'active' | 'neutral' | 'warning';
  title: string;
  description: string;
};

export function NotificationStatus({ tone = 'neutral', title, description }: Props) {
  const Icon = tone === 'active' ? BellRing : tone === 'warning' ? BellOff : Bell;
  const colors = {
    active: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200 [[data-app-appearance=light]_&]:text-emerald-900',
    neutral: 'border-slate-500/25 bg-slate-500/10 text-[var(--text-main)]',
    warning: 'border-amber-400/35 bg-amber-500/10 text-amber-200 [[data-app-appearance=light]_&]:text-amber-900',
  };

  return (
    <div role="status" data-tone={tone} className={`group flex items-center gap-3 rounded-2xl border p-4 ${colors[tone]}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-500/15 group-data-[tone=active]:bg-emerald-500/20 group-data-[tone=warning]:bg-amber-500/20">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-base font-bold leading-snug">{title}</p>
        <p className="text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
