import React, { useMemo } from 'react';
import { Dumbbell, Radio } from 'lucide-react';
import { usePlayers } from '../../hooks/usePlayers';
import { useTeamTrainingSummary } from '../../hooks/useTeamTrainingSummary';
import { resolveTrainingCenterPhase, type TrainingCenterPhase } from '../../lib/trainingCenterPhase';
import { safeText } from '../../lib/safeText';
import { dsStatusChipClass } from '../../lib/premiumDesignSystem';
import { TrainingChallengeTypesGrid } from '../team/TrainingChallengeTypesGrid';
import { JugglingChallengeCard } from '../team/JugglingChallengeCard';
import { TrainingKaiserCard } from '../team/TrainingKaiserCard';
import { CenterAdminAccordion, CenterAdminSection } from '../center/CenterAdminAccordion';
import { CenterCollapsibleSection } from '../center/CenterCollapsibleSection';
import { CenterEmptyState } from '../center/CenterEmptyState';
import { EC_CARD, EC_CARD_INNER, EC_SECTION_LABEL, EC_STACK_GAP } from '../center/eventCenterStyles';

type Props = {
  eventId: string;
  teamSeasonId: string;
  startsAtIso: string;
  status?: string | null;
  trainingTitle: string;
  trainingTopics?: string | null;
  /** Writes (Bearbeiten, Feed schreiben, Attendance ändern). */
  canManage: boolean;
  /** Archiv-Lesen: Teilnehmer/Stats/Kaiser ohne Writes. */
  canViewHistory?: boolean;
  trainerAttendanceSection?: React.ReactNode;
  trainerFeedSection?: React.ReactNode;
  trainerActions?: React.ReactNode;
};

export function TrainingDetailSections({
  teamSeasonId,
  startsAtIso,
  status = null,
  trainingTitle,
  trainingTopics = null,
  canManage,
  canViewHistory = false,
  trainerAttendanceSection = null,
  trainerFeedSection = null,
  trainerActions = null,
}: Props) {
  const canViewStaffReadouts = canManage || canViewHistory;
  const { players } = usePlayers(teamSeasonId, {
    mode: canViewHistory ? 'all' : 'active',
  });
  const trainingPhase = useMemo(
    (): TrainingCenterPhase => resolveTrainingCenterPhase({ startsAtIso, status }),
    [startsAtIso, status],
  );

  const {
    ranking,
    rankingLoading,
    rankingError,
    ratedTrainingsCount,
    participationLabel,
    jugglingAwards,
    jugglingLoading,
  } = useTeamTrainingSummary(players, teamSeasonId, canViewStaffReadouts);

  const overviewSectionOrder = useMemo((): string[] => {
    if (trainingPhase === 'after' || canViewHistory) {
      return [
        'participants',
        'stats',
        'kaiser',
        'challenges',
        ...(canManage ? ['topics', 'feed', 'admin'] : canViewHistory ? ['topics'] : ['feed']),
      ];
    }
    if (trainingPhase === 'during') {
      return [
        'live',
        'participants',
        'challenges',
        ...(canManage ? ['topics', 'feed', 'admin'] : ['feed']),
      ];
    }
    if (canManage) {
      return ['availability', 'topics', 'challenges', 'feed', 'participants', 'stats', 'admin'];
    }
    return ['topics', 'feed'];
  }, [trainingPhase, canManage, canViewHistory]);

  const topicsText = safeText(trainingTopics);

  const renderSection = (key: string) => {
    switch (key) {
      case 'live':
        return (
          <section key={key} className={EC_CARD}>
            <div className={`${EC_CARD_INNER} flex items-center justify-between gap-2`}>
              <div>
                <p className={EC_SECTION_LABEL}>Live-Status</p>
                <p className="mt-1 text-[14px] font-bold text-white">{trainingTitle}</p>
                <p className="text-[11px] text-white/55">Training läuft oder startet in Kürze</p>
              </div>
              <span className={dsStatusChipClass('selected')}>
                <Radio className="mr-1 inline h-3 w-3 animate-pulse" strokeWidth={2.5} aria-hidden />
                Aktiv
              </span>
            </div>
          </section>
        );
      case 'availability':
        if (!canManage || !trainerAttendanceSection) return null;
        return (
          <CenterCollapsibleSection
            key={key}
            title="Verfügbarkeit"
            icon="👥"
            defaultExpanded={trainingPhase === 'before'}
          >
            {trainerAttendanceSection}
          </CenterCollapsibleSection>
        );
      case 'topics':
        if (!topicsText) {
          if (!canManage && !canViewHistory) return null;
          return (
            <CenterEmptyState
              key={key}
              icon={Dumbbell}
              title="Keine Trainingsthemen"
              description={
                canManage
                  ? 'Trage Schwerpunkte und Übungen beim Bearbeiten des Trainings ein.'
                  : 'Für dieses historische Training sind keine Themen hinterlegt.'
              }
            />
          );
        }
        return (
          <CenterCollapsibleSection key={key} title="Trainingsthemen" icon="📋" defaultExpanded={trainingPhase === 'before'}>
            <p className="text-[12px] leading-snug text-white/75 whitespace-pre-wrap">{topicsText}</p>
          </CenterCollapsibleSection>
        );
      case 'challenges':
        return (
          <CenterCollapsibleSection key={key} title="Challenges" icon="🏆" defaultExpanded={false}>
            <div className="flex flex-col gap-2">
              <JugglingChallengeCard variant="teaser" awards={jugglingAwards} loading={jugglingLoading} />
              <TrainingChallengeTypesGrid variant="teaser" />
            </div>
          </CenterCollapsibleSection>
        );
      case 'feed':
        if (!canManage || !trainerFeedSection) return null;
        return (
          <CenterCollapsibleSection key={key} title="Feed & Kommunikation" icon="📢" defaultExpanded={false}>
            {trainerFeedSection}
          </CenterCollapsibleSection>
        );
      case 'participants':
        if (!canViewStaffReadouts || !trainerAttendanceSection) return null;
        return (
          <CenterCollapsibleSection
            key={key}
            title={canViewHistory && !canManage ? 'Trainingsteilnehmer (Archiv)' : 'Trainingsteilnehmer'}
            icon="👥"
            defaultExpanded={trainingPhase !== 'before' || canViewHistory}
          >
            {canViewHistory && !canManage ? (
              <p className="mb-3 text-[11px] text-amber-200/90">
                Abgeschlossene Saison — nur Lesen. Keine Änderungen an der Teilnahme.
              </p>
            ) : null}
            {trainerAttendanceSection}
          </CenterCollapsibleSection>
        );
      case 'stats':
        if (!canViewStaffReadouts) return null;
        return (
          <section key={key} className={EC_CARD}>
            <div className={EC_CARD_INNER}>
              <p className={EC_SECTION_LABEL}>Trainingsstatistik</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wide text-white/42">Bewertete Trainings</p>
                  <p className="text-[16px] font-bold text-white">{ratedTrainingsCount}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-wide text-white/42">Beteiligung</p>
                  <p className="text-[16px] font-bold text-white">{participationLabel}</p>
                </div>
              </div>
            </div>
          </section>
        );
      case 'kaiser':
        if (!canViewStaffReadouts) return null;
        return (
          <div key={key}>
            <TrainingKaiserCard
              players={players}
              teamSeasonId={teamSeasonId}
              variant="overview"
              embedded
              ranking={ranking}
              loading={rankingLoading}
              error={rankingError}
            />
          </div>
        );
      case 'admin':
        if (!canManage) return null;
        return (
          <CenterAdminAccordion key={key}>
            {trainerActions ? (
              <CenterAdminSection title="Training bearbeiten">{trainerActions}</CenterAdminSection>
            ) : null}
          </CenterAdminAccordion>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex min-w-0 flex-col overflow-x-hidden ${EC_STACK_GAP}`}>
      {overviewSectionOrder.map((sectionKey) => renderSection(sectionKey))}
    </div>
  );
}
