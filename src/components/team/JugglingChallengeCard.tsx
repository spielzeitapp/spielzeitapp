import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { JugglingAwards } from '../../lib/challengeTypes';
import { formatImprovementPercent } from '../../lib/challengeScoring';
import { PremiumCard, SectionTitle } from '../../ui';
import { dsPanelRowClass } from '../../lib/premiumDesignSystem';
import { cn } from '../../ui/lib/cn';

type Props = {
  variant?: 'teaser' | 'full';
  awards?: JugglingAwards | null;
  loading?: boolean;
};

const TEASER_HERO_CLASS =
  'relative overflow-hidden rounded-2xl border border-[rgba(220,38,38,0.28)] bg-gradient-to-br from-[rgba(25,25,28,0.96)] to-[rgba(80,12,20,0.22)] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_rgba(220,38,38,0.12)]';

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
    <div className="rounded-xl border border-[rgba(220,38,38,0.16)] bg-[rgba(8,8,10,0.72)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="whitespace-nowrap text-[10px] font-semibold text-white/55">
        <span aria-hidden>{emoji}</span> {label}
      </p>
      <p className="mt-0.5 truncate text-[12px] font-semibold leading-snug text-white">{name ?? '—'}</p>
    </div>
  );
}

export const JugglingChallengeCard: React.FC<Props> = ({ variant = 'full', awards, loading = false }) => {
  const isTeaser = variant === 'teaser';
  const king = awards?.king ?? null;
  const kingPct = king?.percentImprovement ?? null;
  const onGoldCourse = kingPct != null && kingPct >= 50;

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className={isTeaser ? 'w-full sm:p-4' : 'w-full sm:p-5'}>
      {isTeaser ? (
        <div className={TEASER_HERO_CLASS}>
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(220,38,38,0.14)_0%,transparent_55%)]"
            aria-hidden
          />
          <div className="relative">
            <p className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-300/90">
              <span className="mr-1" aria-hidden>
                🏆
              </span>
              Challenge des Monats
            </p>
            {loading ? (
              <p className="mt-2 text-[12px] text-white/55">Lade Challenge…</p>
            ) : king ? (
              <>
                <p className="mt-2 text-[11px] text-white/50">Top Spieler</p>
                <p className="mt-0.5 truncate text-[17px] font-bold leading-tight text-white">{king.playerName}</p>
                <p className="mt-1.5 whitespace-nowrap text-[13px] font-semibold text-amber-200/90">
                  {king.endValue} Gaberls
                  {kingPct != null ? ` · ${formatImprovementPercent(kingPct)}` : ''}
                </p>
                {onGoldCourse ? (
                  <p className="mt-1.5 whitespace-nowrap text-[11px] font-medium text-amber-200/75">
                    Aktuell auf Gold-Kurs
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-[12px] text-white/55">Start- und Endwert erfassen — Rankings automatisch.</p>
            )}
          </div>
        </div>
      ) : (
        <SectionTitle
          as="h2"
          subtitle="Startwert und Endwert erfassen — Rankings und Awards werden automatisch berechnet."
          subtitleClassName="mt-1.5 text-[12px] leading-relaxed text-white/55"
          className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case"
        >
          <span className="mr-1.5" aria-hidden>
            ⚽
          </span>
          Gaberl-Challenge
        </SectionTitle>
      )}

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
        <span className="whitespace-nowrap text-[14px] font-semibold text-white">Gaberl-Challenge öffnen</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
      </Link>
    </PremiumCard>
  );
};
