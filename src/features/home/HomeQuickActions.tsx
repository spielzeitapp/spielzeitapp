import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MessageSquare, Radio, Users } from 'lucide-react';
import { PremiumCard, SectionTitle } from '../../ui';
import { useInternalBasePath } from '../../demo/demoPaths';

export const HomeQuickActions: React.FC = () => {
  const base = useInternalBasePath();
  return (
    <section className="pt-2" aria-label="Schnellzugriff">
      <SectionTitle variant="subtle" as="h2" className="mb-3 !text-xs !font-bold !uppercase !tracking-[0.2em]">
        Schnellzugriff
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Link to={`${base}/nachrichten`} className="block">
          <PremiumCard
            variant="interactive"
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 py-4 text-center text-sm font-semibold text-white"
          >
            <MessageSquare className="h-6 w-6 text-red-500" strokeWidth={2} aria-hidden />
            Nachrichten
          </PremiumCard>
        </Link>
        <Link to={`${base}/team`} className="block">
          <PremiumCard
            variant="interactive"
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 py-4 text-center text-sm font-semibold text-white"
          >
            <Users className="h-6 w-6 text-red-500" strokeWidth={2} aria-hidden />
            Team
          </PremiumCard>
        </Link>
        <Link to={`${base}/termine`} className="block">
          <PremiumCard
            variant="interactive"
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 py-4 text-center text-sm font-semibold text-white"
          >
            <CalendarDays className="h-6 w-6 text-red-500" strokeWidth={2} aria-hidden />
            Termine
          </PremiumCard>
        </Link>
        <Link to={`${base}/live`} className="block">
          <PremiumCard
            variant="interactive"
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 py-4 text-center text-sm font-semibold text-white"
          >
            <Radio className="h-6 w-6 text-red-500" strokeWidth={2} aria-hidden />
            Live
          </PremiumCard>
        </Link>
      </div>
    </section>
  );
};
