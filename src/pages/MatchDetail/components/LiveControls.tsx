import React, { useState } from 'react';
import type { Match, MatchEvent, MatchEventType } from '../../../types/match';
import { Button } from '../../../app/components/ui/Button';
import { createEvent } from '../../../services/eventFactory';
import { Modal } from '../../../app/ui/Modal';
import { EventComposer } from './EventComposer';

interface LiveControlsProps {
  match: Match;
  currentMinute: number;
  /** Für Persistenz bei Pause/Abpfiff (live_elapsed_seconds). */
  currentSeconds?: number;
  onAddEvent: (event: MatchEvent) => void;
  onTimerCommand: (command: 'start' | 'pause' | 'stop', currentElapsedSeconds?: number) => void;
  /** Spieler, die aktuell wirklich auf dem Feld stehen (pro Team). */
  onFieldPlayersByTeam?: {
    home: Match['home']['players'];
    away: Match['away']['players'];
  };
  /** Bank-Spieler (Zusage, nicht auf dem Feld, nicht abgesagt) pro Team. */
  benchPlayersByTeam?: {
    home: Match['home']['players'];
    away: Match['away']['players'];
  };
  /** Tor Auswärts ohne Modal: sofort score_away +1 und optional match_events. */
  onAddAwayGoalQuick?: () => void;
  /** Macht das letzte Tor Auswärts rückgängig. */
  onUndoAwayGoal?: () => void;
}

export const LiveControls: React.FC<LiveControlsProps> = ({
  match,
  currentMinute,
  currentSeconds = 0,
  onAddEvent,
  onTimerCommand,
  onFieldPlayersByTeam,
  benchPlayersByTeam,
  onAddAwayGoalQuick,
  onUndoAwayGoal,
}) => {
  const [composerMode, setComposerMode] = useState<
    'goal' | 'sub' | 'card' | 'note' | null
  >(null);
  const [composerTeam, setComposerTeam] = useState<'home' | 'away' | undefined>();

  const base = (type: MatchEventType) =>
    ({
      type,
      period: match.period,
    } as const);

  const addKickoff = () => {
    onTimerCommand('start');
    onAddEvent(
      createEvent({
        ...base('kickoff'),
        note: 'Anpfiff',
      }),
    );
  };

  const addPause = () => {
    onTimerCommand('pause', currentSeconds);
    onAddEvent(
      createEvent({
        ...base('period_end'),
        period: match.period ?? 1,
        note: 'Pause',
      }),
    );
  };

  const addNextPeriod = () => {
    const current = match.period ?? 1;
    const next: 1 | 2 | 3 = (current === 1 ? 2 : current === 2 ? 3 : 3);
    onTimerCommand('start');
    onAddEvent(
      createEvent({
        ...base('period_start'),
        period: next,
        note: `Start Abschnitt ${next}`,
      }),
    );
  };

  const addFinalWhistle = () => {
    onTimerCommand('stop', currentSeconds);
    onAddEvent(
      createEvent({
        ...base('final_whistle'),
        note: 'Abpfiff',
      }),
    );
  };

  const addNote = () => {
    onAddEvent(
      createEvent({
        ...base('note'),
        note: 'Notiz (Platzhalter)',
      }),
    );
  };

  const openComposer = (
    mode: 'goal' | 'sub' | 'card' | 'note',
    team?: 'home' | 'away',
  ) => {
    setComposerMode(mode);
    setComposerTeam(team);
  };

  const closeComposer = () => {
    setComposerMode(null);
    setComposerTeam(undefined);
  };

  const handleCreateFromComposer = (event: MatchEvent) => {
    onAddEvent(event);
    closeComposer();
  };

  if (match.status !== 'live') {
    return null;
  }

  const homeOnFieldEmpty = (onFieldPlayersByTeam?.home?.length ?? 0) === 0;
  // Für Auswärts kein Feld-/Bank-UI → Button nicht sperren
  const awayOnFieldEmpty = false;

  const canUndoAwayGoal =
    typeof onUndoAwayGoal === 'function' &&
    match.score.away > 0 &&
    match.events.some(
      (e) => e.type === 'goal' && e.teamId === match.away.id,
    );

  return (
    <>
      <div className="card space-y-3">
        <h2 className="card-title">Live Controls</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={addKickoff}>
            Anpfiff
          </Button>
          <Button size="sm" variant="soft" onClick={addPause}>
            Pause
          </Button>
          <Button size="sm" variant="soft" onClick={addNextPeriod}>
            Weiter
          </Button>
          <Button size="sm" variant="soft" onClick={addFinalWhistle}>
            Abpfiff
          </Button>
        </div>
        {homeOnFieldEmpty && awayOnFieldEmpty && (
          <p className="text-xs text-[var(--text-sub)]">
            Keine Aufstellung gesetzt.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => openComposer('goal', 'home')}
            disabled={homeOnFieldEmpty}
          >
            Tor Heim
          </Button>
          <div className="flex items-center gap-1">
            {typeof onAddAwayGoalQuick === 'function' ? (
              <Button size="sm" onClick={onAddAwayGoalQuick}>
                Tor Auswärts
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => openComposer('goal', 'away')}
                disabled={awayOnFieldEmpty}
              >
                Tor Auswärts
              </Button>
            )}
            {canUndoAwayGoal && (
              <Button
                size="sm"
                variant="soft"
                onClick={onUndoAwayGoal}
              >
                ↩ Undo
              </Button>
            )}
          </div>
          <Button size="sm" variant="soft" onClick={() => openComposer('sub', 'home')}>
            Wechsel Heim
          </Button>
          <Button size="sm" variant="soft" onClick={() => openComposer('sub', 'away')}>
            Wechsel Auswärts
          </Button>
          <Button size="sm" variant="soft" onClick={() => openComposer('card', 'home')}>
            Karte Heim
          </Button>
          <Button size="sm" variant="soft" onClick={() => openComposer('card', 'away')}>
            Karte Auswärts
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openComposer('note')}>
            Notiz
          </Button>
        </div>
      </div>

      <Modal
        isOpen={composerMode !== null}
        onClose={closeComposer}
        title={
          composerMode === 'goal'
            ? 'Tor erfassen'
            : composerMode === 'sub'
              ? 'Wechsel erfassen'
              : composerMode === 'card'
                ? 'Karte erfassen'
                : composerMode === 'note'
                  ? 'Notiz hinzufügen'
                  : undefined
        }
      >
        {composerMode && (
          <EventComposer
            match={match}
            mode={composerMode === 'note' ? 'note' : composerMode}
            teamPreset={composerTeam}
            onCancel={closeComposer}
            onCreate={handleCreateFromComposer}
            onFieldPlayersByTeam={onFieldPlayersByTeam}
            benchPlayersByTeam={benchPlayersByTeam}
          />
        )}
      </Modal>
    </>
  );
};

