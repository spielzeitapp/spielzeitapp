import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { JugglingAwards } from '../../lib/challengeTypes';
import { PremiumCard, SectionTitle } from '../../ui';
import { dsPanelRowClass } from '../../lib/premiumDesignSystem';
import { cn } from '../../ui/lib/cn';

type Props = {
  variant?: 'teaser' | 'full';
  awards?: JugglingAwards | null;
  loading?: boolean;
};

function AwardPreview({
  emoji,
  label,
  name,
}: {
  emoji: string;
  label: string;
  name: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-2">
      <p className="text-[10px] font-semibold text-white/55">
        <span aria-hidden>{emoji}</span> {label}
      </p>
      <p className="mt-0.5 truncate text-[12px] font-semibold text-white">{name ?? '—'}</p>
    </div>
  );
}

export const JugglingChallengeCard: React.FC<Props> = ({ variant = 'full', awards, loading = false }) => {
  const isTeaser = variant === 'teaser';

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className={isTeaser ? 'sm:p-4' : 'sm:p-5'}>
      <SectionTitle
        as={isTeaser ? 'h3' : 'h2'}
        subtitle={
          isTeaser
            ? 'Start- und Endwert erfassen — Rankings automatisch.'
            : 'Startwert und Endwert erfassen — Rankings und Awards werden automatisch berechnet.'
        }
        subtitleClassName="mt-1.5 text-[12px] leading-relaxed text-white/55"
        className={
          isTeaser
            ? '[&>h3]:text-base [&>h3]:font-semibold [&>h3]:normal-case'
            : '[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case'
        }
      >
        <span className="mr-1.5" aria-hidden>
          ⚽
        </span>
        Jonglier-Challenge
      </SectionTitle>

      {!isTeaser && awards && !loading ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <AwardPreview emoji="🏆" label="König" name={awards.king?.playerName ?? null} />
          <AwardPreview emoji="🚀" label="Aufsteiger" name={awards.riser?.playerName ?? null} />
          <AwardPreview emoji="⭐" label="Entwicklung" name={awards.development?.playerName ?? null} />
        </div>
      ) : null}

      <Link
        to="/app/team/juggling-challenge"
        className={cn(dsPanelRowClass(), 'mt-3 flex items-center justify-between gap-3 !py-3')}
      >
        <span className="text-[14px] font-semibold text-white">Challenge öffnen</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
      </Link>
    </PremiumCard>
  );
};
