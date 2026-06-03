import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LivePageHeader, LivePremiumShell, LiveScheduleCtaLink } from '../components/live/LivePremiumShell';
import { LiveMatchScreen } from './live/LiveMatchScreen';
import { PremiumCard, PremiumEmptyState } from '../ui';
import { cn } from '../ui/lib/cn';
import { dsPrimaryCtaClass } from '../lib/premiumDesignSystem';

type LiveMatchRow = {
  id: string;
  opponent: string | null;
  match_date: string | null;
};

/**
 * Haupt-Liveticker unter /app/live: roter LiveMatchScreen für alle Rollen (Trainer vs. Zuschauer nur Berechtigung).
 * Ohne ?matchId: bei genau einem live-Match wird derselbe Screen genutzt (intern erste Live-Zeile); bei mehreren zuerst Auswahl.
 */
export const LivePage: React.FC = () => {
  const { id: idFromRoute } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const matchIdParam =
    searchParams.get('matchId')?.trim() || idFromRoute?.trim() || null;

  const [loading, setLoading] = useState(!matchIdParam);
  const [error, setError] = useState<string | null>(null);
  const [liveMatches, setLiveMatches] = useState<LiveMatchRow[] | null>(null);

  useEffect(() => {
    if (matchIdParam) {
      setLoading(false);
      setLiveMatches(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('matches')
        .select('id, opponent, match_date')
        .eq('status', 'live')
        .order('match_date', { ascending: false })
        .returns<LiveMatchRow[]>();

      if (cancelled) return;
      if (err) {
        setError('Fehler beim Laden der Live-Spiele.');
        setLiveMatches([]);
        setLoading(false);
        return;
      }
      setLiveMatches(data ?? []);
      setLoading(false);
    })().catch(() => {
      if (cancelled) return;
      setError('Fehler beim Laden der Live-Spiele.');
      setLiveMatches([]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [matchIdParam]);

  if (matchIdParam) {
    return <LiveMatchScreen />;
  }

  if (loading) {
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
  if (rows.length === 0) {
    return (
      <LivePremiumShell>
        <LivePageHeader subtitle="Sobald ein Spiel auf LIVE steht, erscheint der Liveticker hier." />
        <PremiumEmptyState
          variant="subtle"
          title="Aktuell kein Livespiel."
          description="Starte ein Spiel im Spielplan oder warte, bis ein Match auf LIVE gesetzt wird."
          className="py-8"
        >
          <LiveScheduleCtaLink />
        </PremiumEmptyState>
      </LivePremiumShell>
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
              to={`/app/live?matchId=${encodeURIComponent(m.id)}`}
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
