import React, { useMemo, useState } from 'react';
import type { Match, MatchEvent, CardType } from '../../../types/match';
import { createEvent } from '../../../services/eventFactory';
import { Button } from '../../../app/components/ui/Button';

type ComposerMode = 'goal' | 'sub' | 'card' | 'note';

interface EventComposerProps {
  match: Match;
  mode: ComposerMode;
  teamPreset?: 'home' | 'away';
  onCancel: () => void;
  onCreate: (event: MatchEvent) => void;
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
}

export const EventComposer: React.FC<EventComposerProps> = ({
  match,
  mode,
  teamPreset,
  onCancel,
  onCreate,
  onFieldPlayersByTeam,
  benchPlayersByTeam,
}) => {
  const [teamSide, setTeamSide] = useState<'home' | 'away' | ''>(teamPreset ?? '');
  const [playerId, setPlayerId] = useState<string>('');
  const [playerOutId, setPlayerOutId] = useState<string>('');
  const [playerInId, setPlayerInId] = useState<string>('');
  const [cardType, setCardType] = useState<CardType>('yellow');
  const [note, setNote] = useState<string>('');
  const [fieldError, setFieldError] = useState<string>('');

  const currentMinute = match.currentMinute ?? undefined;
  const currentPeriod = match.period ?? undefined;

  const { homePlayers, awayPlayers } = useMemo(
    () => ({
      homePlayers: match.home.players,
      awayPlayers: match.away.players,
    }),
    [match],
  );

  const onFieldHomePlayers = onFieldPlayersByTeam?.home ?? homePlayers;
  const onFieldAwayPlayers = onFieldPlayersByTeam?.away ?? awayPlayers;
  const benchHomePlayers = benchPlayersByTeam?.home ?? [];
  const benchAwayPlayers = benchPlayersByTeam?.away ?? [];

  const onFieldTeamPlayers = useMemo(() => {
    if (teamSide === 'home') return onFieldHomePlayers;
    if (teamSide === 'away') return onFieldAwayPlayers;
    return [];
  }, [teamSide, onFieldHomePlayers, onFieldAwayPlayers]);

  const benchTeamPlayers = useMemo(() => {
    if (teamSide === 'home') return benchHomePlayers;
    if (teamSide === 'away') return benchAwayPlayers;
    return [];
  }, [teamSide, benchHomePlayers, benchAwayPlayers]);

  const isSubInvalid =
    mode === 'sub' &&
    (!!playerOutId === false || !!playerInId === false || playerOutId === playerInId);

  // Für Tore ist nur die Team-Auswahl Pflicht; Spieler ist optional (Team-Tor).
  const isGoalInvalid = mode === 'goal' && !teamSide;
  const isCardInvalid = mode === 'card' && (!teamSide || !playerId || !cardType);
  const isNoteInvalid = mode === 'note' && note.trim().length === 0;

  const disableSave = isSubInvalid || isGoalInvalid || isCardInvalid || isNoteInvalid;

  const onFieldIds = useMemo(
    () => new Set(onFieldTeamPlayers.map((p) => p.id)),
    [onFieldTeamPlayers],
  );
  const benchIds = useMemo(
    () => new Set(benchTeamPlayers.map((p) => p.id)),
    [benchTeamPlayers],
  );

  const handleSave = () => {
    setFieldError('');
    if (disableSave) return;

    const base = {
      minute: currentMinute,
      period: currentPeriod,
    };

    if (mode === 'goal' && teamSide) {
      if (playerId && !onFieldIds.has(playerId)) {
        setFieldError('Spieler steht nicht am Feld.');
        return;
      }
      const team = teamSide === 'home' ? match.home : match.away;
      const payload: Parameters<typeof createEvent>[0] = {
        ...base,
        type: 'goal',
        teamId: team.id,
        note: note || undefined,
      };
      if (playerId) {
        (payload as any).playerId = playerId;
      }
      const event = createEvent(payload);
      onCreate(event);
      return;
    }

    if (mode === 'sub' && teamSide) {
      if (!onFieldIds.has(playerOutId)) {
        setFieldError('Spieler steht nicht am Feld.');
        return;
      }
      if (!benchIds.has(playerInId)) {
        setFieldError('Spieler steht nicht am Feld.');
        return;
      }
      const team = teamSide === 'home' ? match.home : match.away;
      const event = createEvent({
        ...base,
        type: 'sub',
        teamId: team.id,
        playerOutId,
        playerInId,
        note: note || undefined,
      });
      onCreate(event);
      return;
    }

    if (mode === 'card' && teamSide) {
      if (!onFieldIds.has(playerId)) {
        setFieldError('Spieler steht nicht am Feld.');
        return;
      }
      const team = teamSide === 'home' ? match.home : match.away;
      const event = createEvent({
        ...base,
        type: 'card',
        teamId: team.id,
        playerId,
        cardType,
        note: note || undefined,
      });
      onCreate(event);
      return;
    }

    if (mode === 'note') {
      const event = createEvent({
        ...base,
        type: 'note',
        note: note.trim(),
      });
      onCreate(event);
      return;
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(mode === 'goal' || mode === 'sub' || mode === 'card') && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-sub)]">Team</span>
            <select
              value={teamSide}
              onChange={(e) => {
                const value = e.target.value as 'home' | 'away' | '';
                setTeamSide(value);
                setPlayerId('');
                setPlayerOutId('');
                setPlayerInId('');
              }}
              className="rounded-lg bg-black/40 border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="">Team wählen</option>
              <option value="home">
                Heim: {match.home.shortName ?? match.home.name}
              </option>
              <option value="away">
                Auswärts: {match.away.shortName ?? match.away.name}
              </option>
            </select>
          </label>
        )}

        {(((mode === 'goal' && teamSide === 'home') || mode === 'card')) && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-sub)]">Spieler</span>
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              disabled={!teamSide}
              className="rounded-lg bg-black/40 border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-40"
            >
              <option value="">Spieler wählen</option>
              {onFieldTeamPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.number != null ? `${player.number} · ` : ''}
                  {player.display_name ?? player.name ?? 'Spieler'}
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === 'sub' && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--text-sub)]">Spieler raus</span>
              <select
                value={playerOutId}
                onChange={(e) => setPlayerOutId(e.target.value)}
                disabled={!teamSide}
                className="rounded-lg bg-black/40 border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-40"
              >
                <option value="">Spieler wählen</option>
                {onFieldTeamPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.number != null ? `${player.number} · ` : ''}
                    {player.display_name ?? player.name ?? 'Spieler'}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--text-sub)]">Spieler rein</span>
              <select
                value={playerInId}
                onChange={(e) => setPlayerInId(e.target.value)}
                disabled={!teamSide}
                className="rounded-lg bg-black/40 border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-40"
              >
                <option value="">Spieler wählen</option>
                {benchTeamPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.number != null ? `${player.number} · ` : ''}
                    {player.display_name ?? player.name ?? 'Spieler'}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {mode === 'card' && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--text-sub)]">Kartenart</span>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value as CardType)}
              className="rounded-lg bg-black/40 border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="yellow">Gelb</option>
              <option value="red">Rot</option>
            </select>
          </label>
        )}
      </div>

      {(((mode === 'goal' && teamSide === 'home') || mode === 'card' || mode === 'sub') &&
        teamSide &&
        onFieldTeamPlayers.length === 0) && (
          <p className="text-xs text-red-400">
            Keine Aufstellung gesetzt – zuerst Spieler in Slots eintragen.
          </p>
        )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--text-sub)]">Notiz (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded-lg bg-black/40 border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          placeholder={
            mode === 'note'
              ? 'Kurze Notiz zum Ereignis...'
              : 'Optionaler Kommentar (z.B. Art des Tores, Situation)...'
          }
        />
      </label>

      {mode === 'sub' && isSubInvalid && (
        <p className="text-xs text-red-400">
          Bitte zwei unterschiedliche Spieler für Wechsel auswählen.
        </p>
      )}
      {fieldError && (
        <p className="text-xs text-red-400">{fieldError}</p>
      )}

      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button size="sm" disabled={disableSave} onClick={handleSave}>
          Speichern
        </Button>
      </div>
    </div>
  );
};

