import React from 'react';
import { TRAINING_CHALLENGE_TYPES } from '../../lib/trainingChallengeTypes';
import { PremiumCard, SectionTitle } from '../../ui';
import { cn } from '../../ui/lib/cn';

type Props = {
  variant?: 'teaser' | 'full';
  className?: string;
};

const CARD_CLASS =
  'rounded-xl border border-[rgba(220,38,38,0.16)] bg-[rgba(8,8,10,0.72)] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

export const TrainingChallengeTypesGrid: React.FC<Props> = ({ variant = 'full', className }) => {
  const isTeaser = variant === 'teaser';

  return (
    <PremiumCard
      variant="subtle"
      showAmbientGlow={false}
      className={cn(isTeaser ? 'w-full sm:p-4' : 'w-full sm:p-5', className)}
    >
      <SectionTitle
        as={isTeaser ? 'h3' : 'h2'}
        subtitle={
          isTeaser
            ? 'Neue Trainings-Challenges — Auswertung folgt.'
            : 'Vorbereitete Challenge-Typen für die Trainingszentrale. Noch ohne Datenbank-Anbindung.'
        }
        subtitleClassName="mt-1.5 text-[11px] leading-relaxed text-white/45"
        className={
          isTeaser
            ? '[&>h3]:text-base [&>h3]:font-semibold [&>h3]:normal-case'
            : '[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case'
        }
      >
        <span className="mr-1.5" aria-hidden>
          🎯
        </span>
        Trainings-Challenges
      </SectionTitle>

      <div className={cn('grid gap-2', isTeaser ? 'mt-3 grid-cols-2' : 'mt-4 grid-cols-1 sm:grid-cols-2')}>
        {TRAINING_CHALLENGE_TYPES.map((challenge) => (
          <div key={challenge.id} className={CARD_CLASS}>
            <p className="whitespace-nowrap text-[12px] font-semibold text-white/85">
              <span className="mr-1" aria-hidden>
                {challenge.emoji}
              </span>
              {challenge.title}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-white/45">{challenge.description}</p>
            <p className="mt-2 whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-amber-200/70">
              {challenge.placeholderHint}
            </p>
          </div>
        ))}
      </div>
    </PremiumCard>
  );
};
