import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSession } from '../auth/useSession';
import { isTournamentLiveMatchForTeam } from '../lib/matchCenterTournamentLive';
import { LivePageHeader, LivePremiumShell, LiveScheduleCtaLink } from '../components/live/LivePremiumShell';
import { MatchCenterIdleView } from '../components/live/MatchCenterIdleView';
import { LiveMatchScreen } from './live/LiveMatchScreen';
import { PremiumCard, PremiumEmptyState } from '../ui';
import { cn } from '../ui/lib/cn';
import { dsPrimaryCtaClass } from '../lib/premiumDesignSystem';
import { useDemoMode } from '../demo/DemoContext';
import { useInternalBasePath } from '../demo/demoPaths';
import { DEMO_MATCH_ID_LIVE } from '../demo/demoMatchState';

type LiveMatchRow = {
  id: string;
  opponent: string | null;
  match_date: string | null;
  team_season_id: string | null;
};

/**
 * Haupt-Liveticker unter /app/live: roter LiveMatchScreen für alle Rollen (Trainer vs. Zuschauer nur Berechtigung).
 * Ohne ?matchId: bei genau einem live-Match wird derselbe Screen genutzt (intern erste Live-Zeile); bei mehreren zuerst Auswahl.
 * Turnierspiele: Match Center zeigt Live-Card mit CTA statt Auto-Sprung in den Liveticker.
 */
export const LivePage: React.FC = () => {
  const { effectiveRole, selectedTeamSeasonId: teamSeasonId } = useSession();
  const { id: idFromRoute } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const demo = useDemoMode();
  const isDemo = Boolean(demo);
  const basePath = useInternalBasePath();
  const matchIdParam =
    searchParams.get('matchId')?.trim() || idFromRoute?.trim() || null;

  const [loading, setLoading] = useState(!matchIdParam);
  const [error, setError] = useState<string | null>(null);
  const [liveMatches, setLiveMatches] = useState<LiveMatchRow[] | null>(null);
  const [tournamentLiveMatchId, setTournamentLiveMatchId] = useState<string | null>(null);
  const [tournamentCheckDone, setTournamentCheckDone] = useState(false);

  useEffect(() => {
    if (matchIdParam || isDemo) {
      setLoading(false);
      setLiveMatches(null);
      setError(null);
      setTournamentLiveMatchId(null);
      setTournamentCheckDone(true);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setTournamentCheckDone(false);

      let query = supabase
        .from('matches')
        .select('id, opponent, match_date, team_season_id')
        .eq('status', 'live')
        .order('match_date', { ascending: false });

      if (teamSeasonId?.trim()) {
        query = query.eq('team_season_id', teamSeasonId.trim());
      }

      const { data, error: err } = await query.returns<LiveMatchRow[]>();

      if (cancelled) return;
      if (err) {
        setError('Fehler beim Laden der Live-Spiele.');
        setLiveMatches([]);
        setTournamentLiveMatchId(null);
        setTournamentCheckDone(true);
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      setLiveMatches(rows);

      if (rows.length === 1 && teamSeasonId?.trim()) {
        const onlyId = String(rows[0]!.id);
        const isTournament = await isTournamentLiveMatchForTeam(onlyId, teamSeasonId.trim());
        if (!cancelled) {
          setTournamentLiveMatchId(isTournament ? onlyId : null);
        }
      } else {
        setTournamentLiveMatchId(null);
      }

      if (!cancelled) {
        setTournamentCheckDone(true);
        setLoading(false);
      }
    })().catch(() => {
      if (cancelled) return;
      setError('Fehler beim Laden der Live-Spiele.');
      setLiveMatches([]);
      setTournamentLiveMatchId(null);
      setTournamentCheckDone(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [matchIdParam, teamSeasonId, isDemo]);

  if (matchIdParam) {
    return <LiveMatchScreen />;
  }

  if (isDemo) {
    const demoLiveMatchId = demo?.liveRuntimeMatchId ?? null;
    const demoRuntimeStarted =
      demo?.liveRuntimeStatus === 'live' || demo?.liveRuntimeStatus === 'finished';
    if (demoRuntimeStarted && demoLiveMatchId) {
      return (
        <Navigate
          to={`${basePath}/live?matchId=${encodeURIComponent(demoLiveMatchId)}`}
          replace
        />
      );
    }
    return (
      <LivePremiumShell matchCenter>
        <LivePageHeader
          title="Match Center"
          subtitle="Noch kein Anpfiff — Aufstellung vorbereiten und LIVE starten."
        />
        <PremiumEmptyState
          variant="subtle"
          title="Aktuell kein Livespiel."
          description="Stelle das Demo-Spiel gegen SV Loosdorf U12 auf und starte den Liveticker."
          className="py-8"
        >
          <Link
            to={`${basePath}/match-preparation?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`}
            className={cn(
              dsPrimaryCtaClass(),
              'inline-flex min-h-[48px] touch-manipulation items-center justify-center px-5 py-3',
            )}
          >
            Spiel vorbereiten
          </Link>
        </PremiumEmptyState>
      </LivePremiumShell>
    );
  }

  if (loading || !tournamentCheckDone) {
    return (
      <LivePremiumShell centerContent>
        <p className="text-sm text-white/60">Lade Live-Status…</p>
      </LivePremiumShell>
    );
  }

  if (error) {
    return (
      <LivePremiumShell>
        <LivePageHeader />
        <PremiumEmptyState variant="subtle" title={error} className="py-6">
          <LiveScheduleCtaLink />
        </PremiumEmptyState>
      </LivePremiumShell>
    );
  }

  const rows = liveMatches ?? [];
  const isFan = effectiveRole === 'fan';

  if (rows.length === 0 || tournamentLiveMatchId) {
    return (
      <MatchCenterIdleView
        isFan={isFan}
        prioritizedLiveMatchId={tournamentLiveMatchId}
      />
    );
  }

  if (rows.length === 1) {
    return <LiveMatchScreen />;
  }

  return (
    <LivePremiumShell>
      <LivePageHeader subtitle="Mehrere Livespiele aktiv – wähle ein Spiel aus." />
      <div className="space-y-3">
        {rows.map((m) => (
          <PremiumCard key={m.id} matchday showAmbientGlow className="p-4">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">
              {m.opponent?.trim() || 'Gegner'}
            </p>
            <p className="mt-1 text-xs text-white/55">
              {m.match_date ? new Date(m.match_date).toLocaleString('de-AT') : '—'}
            </p>
            <Link
              to={`${basePath}/live?matchId=${encodeURIComponent(m.id)}`}
              className={cn(
                dsPrimaryCtaClass(),
                'mt-3 inline-flex min-h-[48px] touch-manipulation items-center justify-center px-5 py-3',
              )}
            >
              Zum Liveticker
            </Link>
          </PremiumCard>
        ))}
      </div>
    </LivePremiumShell>
  );
};
