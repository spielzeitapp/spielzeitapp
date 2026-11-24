import React, { useEffect, useState } from 'react';
import { MatchStartChoiceDialog } from '../match/MatchStartChoiceDialog';
import { CenterPreparationAssistant } from './CenterPreparationAssistant';
import { fetchLineupForLiveMatch, fetchMatchById } from '../../lib/liveMatchService';
import { subscribeLiveMatchStateChanged } from '../../lib/liveMatchBroadcast';
import { isMatchSquadEditable, liveMatchWithoutLineupPath, matchLineupPath, matchPreparationPath } from '../../lib/matchPreparationAccess';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import type { InternalBasePath } from '../../demo/demoPaths';

type Props = {
  matchId?: string | null;
  matchLabel: string;
  basePath: InternalBasePath;
  playerCount: number;
  openCount: number;
  yesCount: number;
  attendanceLoading: boolean;
  onOpenAttendance: () => void;
};

const initialState = { matchId: null as string | null, loading: true, squad: 0, hasStarters: false, openForKickoff: false, error: null as string | null };

export function MatchPreparationAssistant({ matchId, matchLabel, basePath, playerCount, openCount, yesCount, attendanceLoading, onOpenAttendance }: Props) {
  const [state, setState] = useState(initialState);
  const [choiceOpen, setChoiceOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const load = async () => {
      const request = ++revision;
      if (!matchId) {
        setState({ ...initialState, loading: false, error: 'Die Spielvorbereitung wird eingerichtet. Bitte kurz warten.' });
        return;
      }
      setState(previous => ({ ...previous, loading: true }));
      try {
        const [lineup, match] = await Promise.all([fetchLineupForLiveMatch(matchId), fetchMatchById(matchId)]);
        if (!active || request !== revision) return;
        const error = lineup.error || match.error || !match.data;
        setState({
          matchId,
          loading: false,
          squad: error ? 0 : lineup.data.squadPlayerIds.length,
          hasStarters: !error && lineup.data.startingPlayerIds.some(Boolean),
          openForKickoff: !error && isMatchSquadEditable({ status: match.data?.status, live_started_at: match.data?.live_started_at }),
          error: error ? 'Kader und Aufstellung konnten nicht geladen werden.' : null,
        });
      } catch {
        if (active && request === revision) {
          setState({ ...initialState, matchId, loading: false, error: 'Vorbereitung konnte nicht geladen werden.' });
        }
      }
    };
    void load();
    const refresh = () => { void load(); };
    const unsubscribe = subscribeLiveMatchStateChanged(refresh);
    window.addEventListener('focus', refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener('focus', refresh); };
  }, [matchId]);

  const canChoose = Boolean(matchId && state.matchId === matchId && state.openForKickoff && !state.error);
  const canOpen = canChoose && !state.loading;
  const closeChoice = () => setChoiceOpen(false);
  const withLineupPath = matchId && (state.squad > 0
    ? matchLineupPath(matchId, basePath)
    : matchPreparationPath(matchId, basePath));

  return (
    <>
      <CenterPreparationAssistant
        title="Match-Assistent"
        readyLabel="Kader vorbereitet"
        loading={state.loading || attendanceLoading}
        error={state.error}
        steps={[
          { id: 'availability', title: 'Verfügbarkeit klären', detail: `${yesCount} zugesagt · ${openCount} offen`, done: !attendanceLoading && playerCount > 0 && openCount === 0, onClick: onOpenAttendance },
          { id: 'squad', title: 'Kader wählen', detail: state.squad ? `${state.squad} Spieler ausgewählt` : 'Spieler für das Match auswählen', done: state.squad > 0, disabled: !matchId, to: matchId ? matchPreparationPath(matchId, basePath) : undefined },
        ]}
      >
        <button
          type="button"
          aria-haspopup="dialog"
          disabled={!canOpen}
          onClick={() => setChoiceOpen(true)}
          className={`${dsPrimaryCtaClass()} mt-3 flex min-h-12 w-full items-center justify-center px-4 text-base font-bold disabled:opacity-45`}
        >
          Spiel starten
        </button>
      </CenterPreparationAssistant>

      {withLineupPath ? (
        <MatchStartChoiceDialog
          open={choiceOpen && canChoose}
          matchLabel={matchLabel}
          onClose={closeChoice}
          withLineupPath={withLineupPath}
          withoutLineupPath={matchId && !state.hasStarters && basePath !== '/demo' ? liveMatchWithoutLineupPath(matchId, basePath) : undefined}
          needsSquad={state.squad === 0}
          lineupState={state.squad === 0 ? { continueWithLineup: true } : undefined}
        />
      ) : null}
    </>
  );
}
