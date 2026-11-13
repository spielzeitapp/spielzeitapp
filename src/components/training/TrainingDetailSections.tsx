import { HallTrainingPlanner } from './HallTrainingPlanner';
import { isHallTraining } from '../../lib/hallTraining';
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, Radio, Trophy, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
import { useTeamTrainingSummary } from '../../hooks/useTeamTrainingSummary';
import { useDemoMode } from '../../demo/DemoContext';
import { getAssignmentForEvent } from '../../lib/eventFieldAssignments';
import { getTrainingSessionByEvent, type TrainingSessionRow } from '../../lib/trainingSessions';
import { resolveTrainingCenterPhase, type TrainingCenterPhase } from '../../lib/trainingCenterPhase';
import { safeText } from '../../lib/safeText';
import { dsStatusChipClass } from '../../lib/premiumDesignSystem';
import { TrainingChallengeTypesGrid } from '../team/TrainingChallengeTypesGrid';
import { SprintChallengeCard } from '../team/SprintChallengeCard';
import { JugglingChallengeCard } from '../team/JugglingChallengeCard';
import { TrainingKaiserCard } from '../team/TrainingKaiserCard';
import { TrainingOverviewHero } from '../team/TrainingOverviewHero';
import { CenterCollapsibleSection } from '../center/CenterCollapsibleSection';
import { EC_CARD, EC_CARD_INNER, EC_SECTION_LABEL, EC_STACK_GAP } from '../center/eventCenterStyles';
import { Modal } from '../../app/ui/Modal';
import { CenterPreparationAssistant } from '../center/CenterPreparationAssistant';
import { trainingPlanManagerHref } from '../../manager/trainingManagerEntry';

type Props = {
  attendanceSummary?: { playerCount: number; openCount: number; yesCount: number; loading: boolean };
  availablePlayerIds?: string[];
  eventId: string;
  teamSeasonId: string;
  startsAtIso: string;
  status?: string | null;
  trainingTitle: string;
  trainingTopics?: string | null;
  trainingLocation?: string | null;
  /** Writes (Bearbeiten, Feed schreiben, Attendance ändern). */
  canManage: boolean;
  /** Archiv-Lesen: Teilnehmer/Stats/Kaiser ohne Writes. */
  canViewHistory?: boolean;
  trainerAttendanceSection?: React.ReactNode;
};

export function TrainingDetailSections({
  attendanceSummary,
  availablePlayerIds = [],
  eventId,
  teamSeasonId,
  startsAtIso,
  status = null,
  trainingTitle,
  trainingTopics = null,
  trainingLocation = null,
  canManage,
  canViewHistory = false,
  trainerAttendanceSection = null,
}: Props) {
  const location = useLocation();
  const hall = isHallTraining(trainingTitle, trainingLocation);
  const [hallOpen, setHallOpen] = useState(false);
  const [hallPrepared, setHallPrepared] = useState(false);
  const demo = useDemoMode();
  const [hasAssignment, setHasAssignment] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [plan, setPlan] = useState<TrainingSessionRow | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setPlanError(null);
    if (demo || !canManage || hall) { setPlanLoading(false); return; }
    setPlanLoading(true);
    Promise.all([getTrainingSessionByEvent(eventId), getAssignmentForEvent(eventId)]).then(([result, assignment]) => {
      if (!active) return;
      setHasAssignment(Boolean(assignment.data));
      setPlan(result.data); setPlanError(result.error ? 'Trainingsplanung konnte nicht geladen werden.' : null); setPlanLoading(false);
    }).catch(() => { if (active) { setPlanError('Trainingsplanung konnte nicht geladen werden.'); setPlanLoading(false); } });
    return () => { active = false; };
  }, [eventId, canManage, demo, hall]);
  const canViewStaffReadouts = canManage || canViewHistory;
  /** Saisonweite Stats/Kaiser: immer active-only. Event-Teilnehmer kommen separat aus EventDetail. */
  const { players } = usePlayers(teamSeasonId, { mode: 'active' });
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
  } = useTeamTrainingSummary(players, teamSeasonId, canViewStaffReadouts, {
    squadMode: 'active_only',
  });

  const overviewSectionOrder = useMemo((): string[] => {
    if (trainingPhase === 'after' || canViewHistory) {
      return [
        'participants',
        'stats',
        'kaiser',
        'challenges',
        ...(canManage || canViewHistory ? ['topics'] : []),
      ];
    }
    if (trainingPhase === 'during') {
      return [
        'live',

        'participants',
        'challenges',
        'stats',
        ...(canManage ? ['topics'] : []),
      ];
    }
    if (canManage) {
      return ['topics', 'challenges', 'stats'];
    }
    return ['topics'];
  }, [trainingPhase, canManage, canViewHistory]);

  const topicsText = safeText(trainingTopics);
  const teamTrainingBasePath = location.pathname.startsWith('/demo/') ? '/demo/team' : '/app/team';
  const teamTrainingHref = `${teamTrainingBasePath}?${new URLSearchParams({
    tab: 'training',
    returnTo: `${location.pathname}${location.search}`,
  }).toString()}`;

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
            title="Teilnehmer"
            icon={<Users aria-hidden />}
            prominent
            defaultExpanded={trainingPhase === 'before'}
          >
            {trainerAttendanceSection}
          </CenterCollapsibleSection>
        );
      case 'topics':
        if (!topicsText) {
          return null;
        }
        return (
          <CenterCollapsibleSection key={key} title="Trainingsthemen" icon={<ClipboardList aria-hidden />} prominent defaultExpanded={trainingPhase === 'before'}>
            <p className="text-[12px] leading-snug text-white/75 whitespace-pre-wrap">{topicsText}</p>
          </CenterCollapsibleSection>
        );
      case 'challenges':
        return (
          <CenterCollapsibleSection key={key} title="Challenges" icon={<Trophy aria-hidden />} prominent defaultExpanded={false}>
            <div className="flex flex-col gap-2">
              <JugglingChallengeCard variant="teaser" awards={jugglingAwards} loading={jugglingLoading} />
              {canManage ? <SprintChallengeCard eventId={eventId} /> : null}
              <TrainingChallengeTypesGrid variant="teaser" />
            </div>
          </CenterCollapsibleSection>
        );
      case 'participants':
        if (!canViewStaffReadouts || !trainerAttendanceSection) return null;
        return (
          <CenterCollapsibleSection
            key={key}
            title={canViewHistory && !canManage ? 'Teilnehmer (Archiv)' : 'Teilnehmer'}
            icon={<Users aria-hidden />}
            prominent
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
          <CenterCollapsibleSection key={key} title="Saisonstatistik" icon={<BarChart3 aria-hidden />} prominent defaultExpanded={false}>
            <TrainingOverviewHero
              sessionsCount={ratedTrainingsCount}
              participationLabel={rankingLoading ? '…' : participationLabel}
              sessions={ranking.sessionParticipations}
              loading={rankingLoading}
            />
            <Link
              to={teamTrainingHref}
              className="mt-2.5 flex min-h-11 w-full items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-[13px] font-bold text-red-100 transition-colors hover:bg-red-500/15"
            >
              Gesamte Saisonstatistik ansehen
            </Link>
          </CenterCollapsibleSection>
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
      default:
        return null;
    }
  };

  return (
    <div className={`flex min-w-0 flex-col overflow-x-hidden ${EC_STACK_GAP}`}>
      {canManage && trainingPhase !== 'after' ? <>
        <CenterPreparationAssistant title="Trainings-Assistent" readyLabel="Training vorbereitet" loading={planLoading || attendanceSummary?.loading} error={planError} steps={[
          { id: 'availability', title: 'Teilnehmer', detail: attendanceSummary ? `${attendanceSummary.yesCount} dabei · ${attendanceSummary.openCount} offen` : 'Rückmeldungen prüfen', done: Boolean(attendanceSummary && attendanceSummary.playerCount > 0 && attendanceSummary.openCount === 0 && !attendanceSummary.loading), onClick: () => setAttendanceOpen(true) },
          ...(hall ? [{ id: 'hall', title: 'Hallenspieltag planen', detail: 'Teams einteilen · Spielzeit berechnen · intern spielen', done: hallPrepared, onClick: () => setHallOpen(true) }] : [
          { id: 'plan', title: 'Trainingseinheit planen', detail: plan ? `${plan.title} · ${plan.planned_duration_minutes ?? 0} Min.` : 'Übungen und Ablauf auswählen', done: plan?.status === 'ready', to: demo ? '/demo/trainingsplanung' : trainingPlanManagerHref({ sessionId: plan?.id, eventId, teamSeasonId, startsAtIso }) },
          { id: 'place', title: 'Platzbelegung prüfen', detail: 'Trainingsplatz und Zonen', optional: true, done: false, to: `${demo ? '/demo' : hasAssignment ? '/app' : '/manager'}/platzbelegung?date=${encodeURIComponent(dayKeyFromIso(startsAtIso))}&event=${encodeURIComponent(eventId)}` },
          ]),
        ]} />
        <Modal open={attendanceOpen} onClose={() => setAttendanceOpen(false)} title="Teilnehmer">{trainerAttendanceSection}</Modal>
      </> : null}
      {hall && canViewStaffReadouts ? <>
        {trainingPhase === 'after' ? <button type="button" onClick={() => setHallOpen(true)} className="sz-club-event-action min-h-14 rounded-2xl border p-4 text-left text-[18px] font-bold">Hallenspieltag · interne Ergebnisse ansehen</button> : null}
        <HallTrainingPlanner eventId={eventId} startsAt={startsAtIso} players={players} availableIds={availablePlayerIds} open={hallOpen} onClose={() => setHallOpen(false)} onReadyChange={setHallPrepared} readOnly={!canManage || status === 'finished' || status === 'canceled'} />
      </> : null}
      {overviewSectionOrder.map((sectionKey) => renderSection(sectionKey))}
    </div>
  );
}

function dayKeyFromIso(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Vienna',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}
