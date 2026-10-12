import React from 'react';
import { ChallengeAwardList } from './ChallengeAwardList';
import { ChallengeParticipantList } from './ChallengeParticipantList';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { JugglingAwards, JugglingChallengePlayerRow } from '../../lib/challengeTypes';
import { buildEndValueRanking, buildAbsoluteImprovementRanking, buildPercentImprovementRanking, formatImprovementDelta, formatImprovementPercent } from '../../lib/challengeScoring';
import { PremiumCard, SectionTitle } from '../../ui';
import { dsPanelRowClass } from '../../lib/premiumDesignSystem';
import { cn } from '../../ui/lib/cn';

type Props = {
  variant?: 'teaser' | 'full';
  awards?: JugglingAwards | null;
  loading?: boolean;
  rows?: JugglingChallengePlayerRow[];
  minStart?: number;
};

const TEASER_HERO_CLASS =
  'relative overflow-hidden rounded-2xl border sz-club-surface sz-club-surface--quiet px-3.5 py-3.5';

export const JugglingChallengeCard: React.FC<Props> = ({ variant = 'full', awards, loading = false, rows, minStart = 3 }) => {
  const isTeaser = variant === 'teaser';
  const king = awards?.king ?? null;
  const kingPct = king?.percentImprovement ?? null;
  const onGoldCourse = kingPct != null && kingPct >= 50;
  const inputs = (rows ?? []).map(row => ({ playerId: row.player.id, playerName: row.player.display_name, startValue: row.startValue, endValue: row.endValue }));
  const rankings = [
    {id:'best',label:'Bestwert',rows:buildEndValueRanking(inputs).map(row => ({id:row.playerId,rank:row.rank,name:row.playerName,value:row.endValue + ' Gaberln',detail:'Startwert: ' + row.startValue}))},
    {id:'improvement',label:'Verbesserung',rows:buildAbsoluteImprovementRanking(inputs).map(row => ({id:row.playerId,rank:row.rank,name:row.playerName,value:formatImprovementDelta(row.absoluteImprovement),detail:row.startValue + ' → ' + row.endValue + ' Gaberln'}))},
    {id:'development',label:'Entwicklung',rows:buildPercentImprovementRanking(inputs,minStart).map(row => ({id:row.playerId,rank:row.rank,name:row.playerName,value:formatImprovementPercent(row.percentImprovement),detail:row.startValue + ' → ' + row.endValue + ' Gaberln'}))},
  ];

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className={isTeaser ? 'w-full min-w-0 sm:p-4' : 'w-full min-w-0 sm:p-5'}>
      {isTeaser ? (
        <div className={TEASER_HERO_CLASS}>
          <div
            className="pointer-events-none absolute inset-0 sz-club-card-glow"
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
                <p className="mt-0.5 break-words text-[17px] font-bold leading-tight text-white">{king.playerName}</p>
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
          subtitle="Bestleistung und persönliche Entwicklung auf einen Blick."
          subtitleClassName="mt-1.5 text-[12px] leading-relaxed text-white/55"
          className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case"
        >
          <span className="mr-1.5" aria-hidden>
            ⚽
          </span>
          <span>Gaberl-Challenge</span>
        </SectionTitle>
      )}

      {!isTeaser ? <ChallengeAwardList loading={loading} awards={[
        { emoji: '🏆', label: 'Gaberl-König', name: awards?.king?.playerName ?? null, value: awards?.king ? awards.king.endValue + ' Gaberln' : null },
        { emoji: '🚀', label: 'Größte Verbesserung', name: awards?.riser?.playerName ?? null, value: awards?.riser ? '+' + awards.riser.absoluteImprovement + ' Gaberln' : null },
        { emoji: '⭐', label: 'Beste Entwicklung', name: awards?.development?.playerName ?? null, value: awards?.development?.percentImprovement != null ? formatImprovementPercent(awards.development.percentImprovement) : null },
      ]} /> : null}

      {!isTeaser && rows && !loading ? <ChallengeParticipantList rankings={rankings} participants={rows.map(row => ({
        id:row.player.id,name:row.player.display_name,
        detail:row.endValue == null
          ? row.startValue > 0 ? 'Startwert: ' + row.startValue + ' Gaberln · Neue Messung offen' : 'Noch keine Messwerte'
          : 'Startwert: ' + row.startValue + ' · Endwert: ' + row.endValue + ' · Entwicklung ab Startwert ' + minStart,
      }))} /> : null}

      <Link
        to="/app/team/juggling-challenge"
        className={cn(dsPanelRowClass(), 'mt-3 flex items-center justify-between gap-3 !py-3')}
      >
        <span className="min-w-0 break-words text-[14px] font-semibold text-white">Gaberl-Challenge öffnen</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
      </Link>
    </PremiumCard>
  );
};
