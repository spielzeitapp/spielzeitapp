import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '../../app/ui/Modal';
import { CenterPreparationAssistant } from './CenterPreparationAssistant';
import { fetchLineupForLiveMatch, fetchMatchById } from '../../lib/liveMatchService';
import { subscribeLiveMatchStateChanged } from '../../lib/liveMatchBroadcast';
import { isMatchSquadEditable, liveMatchWithoutLineupPath, matchLineupPath, matchPreparationPath } from '../../lib/matchPreparationAccess';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';
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
const choiceClass = 'flex min-h-[70px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left';

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

      <Modal open={choiceOpen && canChoose} title="Spiel starten" onClose={closeChoice}>
        <div className="space-y-2.5">
          <p className="mb-3 text-sm font-semibold text-white/65">{matchLabel}</p>
          {matchId && !state.hasStarters && basePath !== '/demo' ? (
            <Link
              to={liveMatchWithoutLineupPath(matchId, basePath)}
              onClick={closeChoice}
              className={`${choiceClass} border-red-400/35 bg-red-950/45 text-white hover:bg-red-950/70`}
            >
              <span>
                <span className="block text-base font-bold">Ohne Aufstellung</span>
                <span className="mt-1 block text-sm text-white/65">Direkt zum Liveticker</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-red-200" aria-hidden />
            </Link>
          ) : null}
          {withLineupPath ? (
            <Link
              to={withLineupPath}
              onClick={closeChoice}
              className={`${choiceClass} border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]`}
            >
              <span>
                <span className="block text-base font-bold">Mit Aufstellung</span>
                <span className="mt-1 block text-sm text-white/65">
                  {state.squad > 0 ? 'Startaufstellung festlegen' : 'Zuerst den Spielkader wählen'}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/55" aria-hidden />
            </Link>
          ) : null}
          <button type="button" onClick={closeChoice} className={`${dsSecondaryCtaClass()} min-h-11 w-full px-4 text-sm font-semibold`}>
            Abbrechen
          </button>
        </div>
      </Modal>
    </>
  );
}
