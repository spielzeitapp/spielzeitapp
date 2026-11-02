import React, { useEffect, useState } from 'react';
import { OefbLiveReport, type OefbLiveReportData } from './OefbLiveReport';
import { fetchOefbAppearances } from '../../lib/stats/oefbAppearances';

type Source = { report: OefbLiveReportData | null; loading: boolean; error: string | null };
type Player = { id: string; name: string };
/** Keep native records authoritative, and reject a report for a different result. */
export function finishedOefbFallback(source: Source, score: string | null, native: { lineup: boolean; events: boolean }, enabled: boolean) {
  const mismatch = Boolean(source.report && score != null && source.report.score !== score);
  const verified: Source = mismatch ? { report: null, loading: false, error: 'ÖFB-Ergebnis weicht vom gespeicherten Ergebnis ab. Bitte Import prüfen.' } : source;
  const available = enabled && Boolean(verified.report || verified.loading || verified.error);
  return { source: verified, lineup: available && !native.lineup, timeline: available && !native.events, stats: available && !native.lineup && !native.events };
}

function OefbMatchMinutes({ matchId, players, report }: { matchId: string; players: Player[]; report: OefbLiveReportData }) {
  const [state, setState] = useState<{ matchId: string; rows: Awaited<ReturnType<typeof fetchOefbAppearances>>; error: string | null } | null>(null);
  useEffect(() => {
    let active = true;
    setState(null);
    void fetchOefbAppearances([matchId], new Set()).then(rows => {
      if (active) setState({ matchId, rows, error: null });
    }).catch(() => { if (active) setState({ matchId, rows: [], error: 'ÖFB-Einsatzzeiten konnten nicht geladen werden. Bitte erneut öffnen.' }); });
    return () => { active = false; };
  }, [matchId]);
  const current = state?.matchId === matchId ? state : null;
  const ownPlayers = report.ownSide === 'home' ? report.homePlayers : report.ownSide === 'away' ? report.awayPlayers : [];
  return <section className="rounded-2xl border border-white/10 bg-black/40 p-4 text-white">
    <h2 className="text-lg font-extrabold">Einsatzzeiten · ÖFB</h2>
    <p className="mt-2 text-xs text-white/55">Berechnet aus bestätigter Spieldauer und ÖFB-Aufstellung. Ein- und Auswechslungen werden berücksichtigt; bei unvollständigen oder widersprüchlichen Angaben bleibt die Spielzeit offen (—).</p>
    {!current ? <p role="status" className="mt-4 text-sm text-white/65">ÖFB-Einsätze werden geladen…</p> : current.error ? <p role="alert" className="mt-4 text-sm text-amber-200">{current.error}</p> : current.rows.length ? <ul className="mt-4 space-y-2">{current.rows.map(row => {
      const name = players.find(p => p.id === row.player_id)?.name || ownPlayers.find(p => p.profileId === row.player_id)?.name || 'Spielerprofil';
      return <li key={row.player_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
        <span className="min-w-0"><span className="block text-sm font-bold">{name}</span><span className="text-xs text-white/50">{row.payload.starter ? 'Startaufstellung' : 'Eingewechselt'}</span></span>
        <span className="shrink-0 text-sm font-bold tabular-nums">{row.payload.calculatedMinutes == null ? '—' : `${row.payload.calculatedMinutes} Min.`}</span>
      </li>;
    })}</ul> : <p className="mt-4 text-sm text-white/65">Noch keine bestätigten ÖFB-Spielerzuordnungen für dieses Spiel.</p>}
  </section>;
}

/** Source-only display; never creates or overwrites lineup or live events. */
export function OefbFinishedMatchSection({ source, view, matchId, players }: { source: Source; view: 'lineup' | 'timeline' | 'stats'; matchId: string; players: Player[] }) {
  if (source.loading) return <p role="status" className="p-4 text-sm text-white/65">ÖFB-Spielbericht wird geladen…</p>;
  if (source.error) return <p role="alert" className="p-4 text-sm text-amber-200">{source.error}</p>;
  if (!source.report) return null;
  if (view === 'stats') return <OefbMatchMinutes matchId={matchId} players={players} report={source.report} />;
  return <OefbLiveReport report={source.report} view={view === 'timeline' ? 'events' : 'lineup'} />;
}
