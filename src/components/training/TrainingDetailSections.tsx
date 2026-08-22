import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, Dumbbell, MapPin, Megaphone, Radio, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlayers } from '../../hooks/usePlayers';
import { useTeamTrainingSummary } from '../../hooks/useTeamTrainingSummary';
import { getAssignmentForEvent } from '../../lib/eventFieldAssignments';
import { getTrainingSessionByEvent, type TrainingSessionRow } from '../../lib/trainingSessions';
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
  trainingLocation?: string | null;
  /** Writes (Bearbeiten, Feed schreiben, Attendance ändern). */
  canManage: boolean;
  /** Archiv-Lesen: Teilnehmer/Stats/Kaiser ohne Writes. */
  canViewHistory?: boolean;
  trainerAttendanceSection?: React.ReactNode;
  trainerFeedSection?: React.ReactNode;
  trainerActions?: React.ReactNode;
};

export function TrainingDetailSections({
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
  trainerFeedSection = null,
  trainerActions = null,
}: Props) {
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
      return ['preparation', 'availability', 'topics', 'challenges', 'feed', 'participants', 'stats', 'admin'];
    }
    return ['topics', 'feed'];
  }, [trainingPhase, canManage, canViewHistory]);

  const topicsText = safeText(trainingTopics);

  const renderSection = (key: string) => {
    switch (key) {
      case 'preparation':
        if (!canManage) return null;
        return (
          <TrainingPreparationCard
            key={key}
            eventId={eventId}
            startsAtIso={startsAtIso}
            location={trainingLocation}
          />
        );
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
            icon={<Users aria-hidden />}
            prominent
            defaultExpanded={trainingPhase === 'before'}
          >
            {trainerAttendanceSection}
          </CenterCollapsibleSection>
        );
      case 'topics':
        if (!topicsText) {
          if (!canManage && !canViewHistory) return null;
          return (
            <CenterCollapsibleSection
              key={key}
              title="Trainingsthemen"
              icon={<ClipboardList aria-hidden />}
              prominent
              defaultExpanded={false}
            >
              <CenterEmptyState
                embedded
                icon={Dumbbell}
                title="Keine Trainingsthemen"
                description={
                  canManage
                    ? 'Trage Schwerpunkte und Übungen beim Bearbeiten des Trainings ein.'
                    : 'Für dieses historische Training sind keine Themen hinterlegt.'
                }
              />
            </CenterCollapsibleSection>
          );
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
              <TrainingChallengeTypesGrid variant="teaser" />
            </div>
          </CenterCollapsibleSection>
        );
      case 'feed':
        if (!canManage || !trainerFeedSection) return null;
        return (
          <CenterCollapsibleSection key={key} title="Feed & Kommunikation" icon={<Megaphone aria-hidden />} prominent defaultExpanded={false}>
            {trainerFeedSection}
          </CenterCollapsibleSection>
        );
      case 'participants':
        if (!canViewStaffReadouts || !trainerAttendanceSection) return null;
        return (
          <CenterCollapsibleSection
            key={key}
            title={canViewHistory && !canManage ? 'Trainingsteilnehmer (Archiv)' : 'Trainingsteilnehmer'}
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
          <CenterAdminAccordion key={key} prominent>
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

function TrainingPreparationCard({
  eventId,
  startsAtIso,
  location,
}: {
  eventId: string;
  startsAtIso: string;
  location: string | null;
}): React.ReactElement {
  const [plan, setPlan] = useState<TrainingSessionRow | null>(null);
  const [hasAssignment, setHasAssignment] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([getTrainingSessionByEvent(eventId), getAssignmentForEvent(eventId)]).then(
      ([planResult, assignmentResult]) => {
        if (!active) return;
        setPlan(planResult.data);
        setHasAssignment(Boolean(assignmentResult.data));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [eventId]);

  const dateKey = dayKeyFromIso(startsAtIso);
  const planReady = plan?.status === 'ready';
  const returnTo = `/app/events/${encodeURIComponent(eventId)}`;
  const planHref = plan
    ? `/manager/training/einheiten/${encodeURIComponent(plan.id)}?${new URLSearchParams({
        ...(planReady ? { view: 'training' } : {}),
        returnTo,
      }).toString()}`
    : `/manager/training/einheiten/neu?${new URLSearchParams({
        event: eventId,
        starts: startsAtIso,
        returnTo,
      }).toString()}`;
  const placeHref = hasAssignment
    ? `/app/platzbelegung?date=${encodeURIComponent(dateKey)}&event=${encodeURIComponent(eventId)}`
    : `/manager/platzbelegung?date=${encodeURIComponent(dateKey)}&event=${encodeURIComponent(eventId)}`;

  return (
    <section className={EC_CARD}>
      <div className={EC_CARD_INNER}>
        <div className="flex min-h-[46px] items-center gap-2.5">
          <ClipboardList className="h-5 w-5 shrink-0 text-red-400/80" strokeWidth={2.25} aria-hidden />
          <h2 className="text-[15px] font-bold tracking-tight text-white/90">Trainingsvorbereitung</h2>
        </div>
        {loading ? (
          <p className="mt-2 text-[12px] text-white/55">Plan und Platz werden geladen…</p>
        ) : (
          <div className="mt-1 grid gap-2">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Trainingsplan</p>
                  <p className={`mt-1 text-[13px] font-bold ${planReady ? 'text-emerald-300' : plan ? 'text-amber-200' : 'text-red-300'}`}>
                    {planReady ? '✓ Planung fertig' : plan ? 'In Bearbeitung' : 'Noch nicht geplant'}
                  </p>
                  {plan ? <p className="mt-0.5 truncate text-[11px] text-white/55">{plan.title} · {plan.planned_duration_minutes ?? 0} Min.</p> : null}
                </div>
                {planReady ? <Check className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden /> : <Dumbbell className="h-5 w-5 shrink-0 text-red-300" aria-hidden />}
              </div>
              <Link to={planHref} className={`mt-2 inline-flex min-h-[42px] w-full items-center justify-center rounded-xl px-3 text-[12px] font-bold ${planReady ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40' : plan ? 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/35' : 'bg-red-600 text-white'}`}>
                {planReady ? 'Trainingsplan ansehen' : plan ? 'Plan weiterbearbeiten' : 'Training planen'}
              </Link>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">Trainingsplatz</p>
                  <p className={`mt-1 text-[13px] font-bold ${hasAssignment ? 'text-emerald-300' : 'text-red-300'}`}>
                    {hasAssignment ? '✓ Platz zugeordnet' : 'Noch kein Platz zugeordnet'}
                  </p>
                  {hasAssignment && location ? <p className="mt-0.5 truncate text-[11px] text-white/55">{location}</p> : null}
                </div>
                <MapPin className={`h-5 w-5 shrink-0 ${hasAssignment ? 'text-emerald-300' : 'text-red-300'}`} aria-hidden />
              </div>
              <Link to={placeHref} className={`mt-2 inline-flex min-h-[42px] w-full items-center justify-center rounded-xl px-3 text-[12px] font-bold ${hasAssignment ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/35' : 'bg-red-600 text-white'}`}>
                {hasAssignment ? 'Platzbelegung ansehen' : 'Platz zuordnen'}
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
