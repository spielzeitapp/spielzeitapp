import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PremiumCard, SectionTitle } from '../../ui';
import { dsPanelRowClass } from '../../lib/premiumDesignSystem';
import { cn } from '../../ui/lib/cn';

export const JugglingChallengeCard: React.FC = () => {
  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className="mb-4 sm:p-5">
      <SectionTitle
        as="h2"
        subtitle="Startwert und Endwert erfassen — Rankings und Awards werden automatisch berechnet."
        subtitleClassName="mt-1.5 text-[12px] leading-relaxed text-white/55"
        className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case"
      >
        <span className="mr-1.5" aria-hidden>
          ⚽
        </span>
        Jonglier-Challenge
      </SectionTitle>

      <Link
        to="/app/team/juggling-challenge"
        className={cn(dsPanelRowClass(), 'mt-4 flex items-center justify-between gap-3 !py-3')}
      >
        <span className="text-[14px] font-semibold text-white">Challenge öffnen</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
      </Link>
    </PremiumCard>
  );
};
