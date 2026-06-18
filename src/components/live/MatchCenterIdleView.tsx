import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../../auth/useSession';
import { useEvents } from '../../hooks/useEvents';
import {
  fetchTournamentMatchSlots,
  fetchTournamentParticipants,
  computeTournamentHeroSummary,
} from '../../lib/tournamentPlan';
import {
  pickNextUpcomingMatch,
  pickNextUpcomingTournament,
} from '../../lib/matchCenterUtils';
import { LivePageHeader, LivePremiumShell, LiveScheduleCtaLink } from './LivePremiumShell';
import { PremiumEmptyState } from '../../ui';
import { MatchCenterNextMatchCard } from './MatchCenterNextMatchCard';
import { MatchCenterTournamentCard } from './MatchCenterTournamentCard';

type Props = {
  isFan: boolean;
};

export function MatchCenterIdleView({ isFan }: Props) {
  const { selectedTeamSeasonId: teamSeasonId, selectedTeamSeason } = useSession();
  const { events, loading: eventsLoading } = useEvents(teamSeasonId);
  const teamName = (selectedTeamSeason?.team?.name ?? 'Unser Team').trim() || 'Unser Team';

  const [now, setNow] = useState(() => new Date());
  const [participantNames, setParticipantNames] = useState<string[]>([]);
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [tournamentExtrasLoading, setTournamentExtrasLoading] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const nextMatch = useMemo(
    () => (eventsLoading ? null : pickNextUpcomingMatch(events, now)),
    [events, eventsLoading, now],
  );
  const nextTournament = useMemo(
    () => (eventsLoading || nextMatch ? null : pickNextUpcomingTournament(events, now)),
    [events, eventsLoading, nextMatch, now],
  );

  useEffect(() => {
    if (!nextTournament) {
      setParticipantNames([]);
      setTeamCount(null);
      setMatchCount(null);
      setTournamentExtrasLoading(false);
      return;
    }

    let cancelled = false;
    setTournamentExtrasLoading(true);

    void (async () => {
      const [participantsRes, slotsRes] = await Promise.all([
        fetchTournamentParticipants(nextTournament.id),
        fetchTournamentMatchSlots(nextTournament.id),
      ]);
      if (cancelled) return;

      const participants = participantsRes.data ?? [];
      const slots = slotsRes.data ?? [];
      const summary = computeTournamentHeroSummary(participants, slots);

      setParticipantNames(participants.map((p) => p.team_name.trim()).filter(Boolean));
      setTeamCount(summary.teamCount > 0 ? summary.teamCount : null);
      setMatchCount(summary.matchCount > 0 ? summary.matchCount : null);
      setTournamentExtrasLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setParticipantNames([]);
        setTeamCount(null);
        setMatchCount(null);
        setTournamentExtrasLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [nextTournament?.id]);

  const subtitle = isFan
    ? 'Sobald dein Team live spielt, erscheint der Liveticker hier.'
    : 'Sobald ein Spiel auf LIVE steht, erscheint der Liveticker hier.';

  if (eventsLoading) {
    return (
      <LivePremiumShell centerContent matchCenter>
        <p className="text-sm text-white/60">Lade Match Center…</p>
      </LivePremiumShell>
    );
  }

  if (nextMatch) {
    return (
      <LivePremiumShell matchCenter>
        <LivePageHeader title="Match Center" subtitle="Nächstes Spiel — Countdown bis Anpfiff" />
        <MatchCenterNextMatchCard event={nextMatch} ourTeamName={teamName} now={now} />
      </LivePremiumShell>
    );
  }

  if (nextTournament) {
    return (
      <LivePremiumShell matchCenter>
        <LivePageHeader title="Match Center" subtitle="Nächstes Turnier — Countdown bis Beginn" />
        <MatchCenterTournamentCard
          event={nextTournament}
          now={now}
          teamCount={teamCount}
          matchCount={matchCount}
          participantNames={participantNames}
          loadingExtras={tournamentExtrasLoading}
        />
      </LivePremiumShell>
    );
  }

  return (
    <LivePremiumShell matchCenter>
      <LivePageHeader title="Match Center" subtitle={subtitle} />
      <PremiumEmptyState
        variant="subtle"
        title={
          isFan
            ? 'Aktuell läuft kein Live-Spiel für dein Team.'
            : 'Aktuell kein Livespiel.'
        }
        description={
          isFan
            ? 'Schau im Spielplan nach dem nächsten Termin oder komm später wieder.'
            : 'Starte ein Spiel im Spielplan oder warte, bis ein Match auf LIVE gesetzt wird.'
        }
        className="py-8"
      >
        <LiveScheduleCtaLink />
      </PremiumEmptyState>
    </LivePremiumShell>
  );
}
