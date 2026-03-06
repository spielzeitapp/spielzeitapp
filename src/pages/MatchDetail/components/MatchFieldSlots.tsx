import React, { useMemo, useState } from 'react';
import type { Match } from '../../../types/match';
import type { FieldSlotId, FieldSlot } from '../../../types/match';

/** Spieler-Objekt für Bank-Chips (id + Anzeige). */
export type BenchCandidate = {
  id: string;
  display_name?: string;
  name?: string;
  number?: number;
};

interface MatchFieldSlotsProps {
  match: Match;
  teamSide: 'home' | 'away';
  canEdit: boolean;
  /** Spieler mit Zusage, die nicht in der Startelf stehen (Bank-Kandidaten). */
  benchCandidates?: BenchCandidate[];
  /** Spieler-IDs, die nicht auswählbar sein sollen (z. B. Absage). */
  unavailableIds?: string[];
  onAssign: (slotId: FieldSlotId, playerId: string) => void;
  onSwap: (slotId: FieldSlotId, incomingPlayerId: string) => void;
  onBench: (playerId: string) => void;
}

type SelectedFrom = 'bench' | FieldSlotId;

const FIELD_SLOTS: FieldSlot[] = [
  { id: 'GK', label: 'Torwart' },
  { id: 'LB', label: 'Links' },
  { id: 'RB', label: 'Rechts' },
  { id: 'CM', label: 'Zentrum' },
  { id: 'LW', label: 'Links vorn' },
  { id: 'RW', label: 'Rechts vorn' },
  { id: 'ST', label: 'Sturm' },
];

export const MatchFieldSlots: React.FC<MatchFieldSlotsProps> = ({
  match,
  teamSide,
  canEdit,
  benchCandidates = [],
  unavailableIds,
  onAssign,
  onSwap,
  onBench,
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedFrom, setSelectedFrom] = useState<SelectedFrom | null>(null);

  const team = teamSide === 'home' ? match.home : match.away;
  const fieldForTeam = match.field?.[teamSide] ?? {};

  const playersOnField = useMemo(() => {
    const ids = new Set<string>();
    (Object.values(fieldForTeam) as string[]).forEach((id) => {
      if (id) ids.add(id);
    });
    return ids;
  }, [fieldForTeam]);

  const selectedPlayer = useMemo(
    () =>
      team.players.find((p) => p.id === selectedPlayerId) ??
      benchCandidates.find((p) => p.id === selectedPlayerId) ??
      null,
    [team.players, benchCandidates, selectedPlayerId],
  );

  const clearSelection = () => {
    setSelectedPlayerId(null);
    setSelectedFrom(null);
  };

  const handlePlayerClick = (playerId: string, from: SelectedFrom) => {
    if (!canEdit) return;
    if (selectedPlayerId === playerId && selectedFrom === from) {
      clearSelection();
      return;
    }
    setSelectedPlayerId(playerId);
    setSelectedFrom(from);
  };

  const handleSlotClick = (slotId: FieldSlotId) => {
    if (!canEdit || !selectedPlayerId) return;

    const currentOccupant = fieldForTeam[slotId];
    if (selectedFrom === 'bench') {
      if (currentOccupant && currentOccupant !== selectedPlayerId) {
        onSwap(slotId, selectedPlayerId);
      } else if (!currentOccupant || currentOccupant === '') {
        onAssign(slotId, selectedPlayerId);
      }
      clearSelection();
      return;
    }

    // Slot->Slot Bewegung: einfacher Ansatz – wir behandeln es wie Assign auf neues Slot
    // und der Parent sorgt dafür, dass der Spieler nicht doppelt auf dem Feld ist.
    if (selectedFrom && selectedFrom !== slotId) {
      onAssign(slotId, selectedPlayerId);
      clearSelection();
    }
  };

  const handleBenchTap = () => {
    if (!canEdit || !selectedPlayerId) return;
    onBench(selectedPlayerId);
    clearSelection();
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    playerId: string,
    from: SelectedFrom,
  ) => {
    if (!canEdit) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', playerId);
    event.dataTransfer.setData('application/x-from', from === 'bench' ? 'bench' : `slot:${from}`);
  };

  const handleSlotDrop = (event: React.DragEvent<HTMLDivElement>, slotId: FieldSlotId) => {
    if (!canEdit) return;
    event.preventDefault();
    const playerId = event.dataTransfer.getData('text/plain');
    if (!playerId) return;
    const fromData = event.dataTransfer.getData('application/x-from');
    const currentOccupant = fieldForTeam[slotId];

    if (fromData === 'bench' || fromData === '') {
      if (currentOccupant && currentOccupant !== playerId) {
        onSwap(slotId, playerId);
      } else if (!currentOccupant || currentOccupant === '') {
        onAssign(slotId, playerId);
      }
      clearSelection();
      return;
    }

    if (fromData.startsWith('slot:')) {
      const fromSlotId = fromData.slice(5) as FieldSlotId;
      if (fromSlotId !== slotId) {
        onAssign(slotId, playerId);
        clearSelection();
      }
    }
  };

  const handleBenchDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    event.preventDefault();
    const playerId = event.dataTransfer.getData('text/plain');
    const fromData = event.dataTransfer.getData('application/x-from');
    if (!playerId) return;
    if (fromData.startsWith('slot:') || fromData === 'bench') {
      onBench(playerId);
      clearSelection();
    }
  };

  return (
    <section className="card space-y-3">
      <h2 className="card-title">
        Aufstellung {teamSide === 'home' ? 'Heim' : 'Auswärts'}
      </h2>

      <div className="fieldGrid">
        {FIELD_SLOTS.map((slot) => {
          const playerId = fieldForTeam[slot.id];
          const player = playerId ? team.players.find((p) => p.id === playerId) : undefined;
          const isSelected = selectedPlayerId && selectedFrom === slot.id && playerId === selectedPlayerId;

          return (
            <div
              key={slot.id}
              className="slotCard"
              onClick={() => handleSlotClick(slot.id)}
              onDragOver={(e) => {
                if (canEdit) e.preventDefault();
              }}
              onDrop={(e) => handleSlotDrop(e, slot.id)}
            >
              <div className="flex items-center justify-between mb-1 text-[0.7rem] text-[var(--text-sub)]">
                <span className="font-semibold">{slot.id}</span>
                <span>{slot.label}</span>
              </div>
              {player ? (
                <div
                  className={`playerBubble ${
                    canEdit ? 'cursor-pointer' : 'cursor-default'
                  } ${isSelected ? 'ring-2 ring-[var(--primary)]' : ''}`}
                  draggable={canEdit}
                  onDragStart={(e) => handleDragStart(e, player.id, slot.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayerClick(player.id, slot.id);
                  }}
                >
                  <span className="text-xs sm:text-sm text-[var(--text-main)]">
                    {player.number != null ? `#${player.number} ` : ''}
                    {player.display_name ?? player.name ?? 'Spieler'}
                  </span>
                </div>
              ) : (
                <div className="playerBubble playerBubble--empty text-[0.75rem] text-[var(--text-sub)]">
                  frei
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="benchRow mt-2 flex flex-wrap gap-2"
        onDragOver={(e) => {
          if (canEdit) e.preventDefault();
        }}
        onDrop={handleBenchDrop}
        onClick={() => {
          if (canEdit) handleBenchTap();
        }}
      >
        {benchCandidates.length === 0 ? (
          <span className="text-xs text-[var(--text-sub)]">Keine Spieler auf der Bank.</span>
        ) : (
          benchCandidates.map((player) => {
            const isSelected =
              selectedPlayerId === player.id && selectedFrom === 'bench';
            const label =
              player.number != null
                ? `#${player.number} ${player.display_name ?? player.name ?? 'Spieler'}`
                : (player.display_name ?? player.name ?? 'Spieler');
            return (
              <div
                key={player.id}
                className={`playerBubble ${
                  canEdit ? 'cursor-pointer' : 'cursor-default'
                } ${isSelected ? 'ring-2 ring-[var(--primary)]' : ''}`}
                draggable={canEdit}
                onDragStart={(e) => handleDragStart(e, player.id, 'bench')}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayerClick(player.id, 'bench');
                }}
              >
                <span className="text-xs sm:text-sm text-[var(--text-main)] whitespace-nowrap">
                  {label}
                </span>
              </div>
            );
          })
        )}
      </div>

      {!canEdit && (
        <p className="text-xs text-[var(--text-sub)] mt-2">
          Nur Trainer/Admin können Aufstellung ändern.
        </p>
      )}
      {canEdit && !selectedPlayer && (
        <p className="text-xs text-[var(--text-sub)] mt-2">
          Tippe Bank-Spieler an, dann Slot antippen.
        </p>
      )}
      {canEdit && selectedPlayer && (
        <p className="text-xs text-[var(--text-sub)] mt-1">
          Ausgewählt:{' '}
          <span className="text-[var(--text-main)]">
            {selectedPlayer.number != null ? `#${selectedPlayer.number} ` : ''}
            {selectedPlayer.display_name ?? selectedPlayer.name ?? 'Spieler'}
          </span>{' '}
          – tippe Slot oder Bank.
        </p>
      )}
    </section>
  );
};

