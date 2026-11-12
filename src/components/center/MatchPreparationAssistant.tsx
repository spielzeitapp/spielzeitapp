import React, { useEffect, useState } from 'react';
import { CenterPreparationAssistant } from './CenterPreparationAssistant';
import { fetchLineupForLiveMatch, fetchMatchById } from '../../lib/liveMatchService';
import { isStartelfCompleteFromStartingIds } from '../../pages/MatchDetail/lineupGuards';
import { subscribeLiveMatchStateChanged } from '../../lib/liveMatchBroadcast';

export function MatchPreparationAssistant({ matchId, basePath, playerCount, openCount, yesCount, attendanceLoading, onOpenAttendance, onOpenPlan }: {
  matchId?: string | null; basePath: string; playerCount: number; openCount: number; yesCount: number; attendanceLoading: boolean; onOpenAttendance: () => void; onOpenPlan: () => void;
}) {
  const [state, setState] = useState({ loading: true, squad: 0, lineup: false, error: null as string | null });
  useEffect(() => {
    let active = true;
    let revision = 0;
    const load = async () => {
      const request = ++revision;
      if (!matchId) { setState({ loading: false, squad: 0, lineup: false, error: 'Die Spielvorbereitung wird eingerichtet. Bitte kurz warten.' }); return; }
      setState(previous => ({ ...previous, loading: true }));
      try {
        const [lineup, match] = await Promise.all([fetchLineupForLiveMatch(matchId), fetchMatchById(matchId)]);
        if (!active || request !== revision) return;
        const error = lineup.error || match.error;
        setState({ loading: false, squad: error ? 0 : lineup.data.squadPlayerIds.length, lineup: !error && isStartelfCompleteFromStartingIds(lineup.data.startingPlayerIds, match.data?.u11_formation_id), error: error ? 'Kader und Aufstellung konnten nicht geladen werden.' : null });
      } catch { if (active && request === revision) setState({ loading: false, squad: 0, lineup: false, error: 'Vorbereitung konnte nicht geladen werden.' }); }
    };
    void load();
    const refresh = () => { void load(); };
    const unsubscribe = subscribeLiveMatchStateChanged(refresh);
    window.addEventListener('focus', refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener('focus', refresh); };
  }, [matchId]);
  return <CenterPreparationAssistant title="Match-Assistent" readyLabel="Match vorbereitet" loading={state.loading || attendanceLoading} error={state.error} steps={[
    { id: 'availability', title: 'Verfügbarkeit klären', detail: `${yesCount} zugesagt · ${openCount} offen`, done: !attendanceLoading && playerCount > 0 && openCount === 0, onClick: onOpenAttendance },
    { id: 'squad', title: 'Kader wählen', detail: state.squad ? `${state.squad} Spieler ausgewählt` : 'Spieler für das Match auswählen', done: state.squad > 0, disabled: !matchId, to: matchId ? `${basePath}/match-preparation?matchId=${encodeURIComponent(matchId)}` : undefined },
    { id: 'lineup', title: 'Aufstellung vorbereiten', detail: 'Formation und Startelf festlegen', done: state.lineup, disabled: !matchId, to: matchId ? `${basePath}/match-lineup?matchId=${encodeURIComponent(matchId)}` : undefined },
    { id: 'notes', title: 'Matchplan ergänzen', detail: 'Taktik und Hinweise zum Spiel', done: false, optional: true, onClick: onOpenPlan },
  ]} />;
}
