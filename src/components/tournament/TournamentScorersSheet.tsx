import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { PlayerItem } from '../../hooks/usePlayers';
import type { TournamentGoalScorer } from '../../lib/tournamentGoalScorers';
import {
  premiumPlayerAvatarSrc,
  premiumPlayerInitials,
} from '../../lib/premiumPlayerCard';

type Props = {
  isOpen: boolean;
  scorers: TournamentGoalScorer[];
  players: PlayerItem[];
  onClose: () => void;
};

function SheetScorerAvatar({
  playerId,
  playerName,
  players,
}: {
  playerId: string;
  playerName: string;
  players: PlayerItem[];
}) {
  const [failed, setFailed] = useState(false);
  const player = players.find((p) => p.id === playerId);
  const src = player ? premiumPlayerAvatarSrc(player) : null;
  const initials = premiumPlayerInitials(playerName);
  const showPhoto = Boolean(src && src !== '/avatars/player-placeholder.png') && !failed;

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,71,71,0.2)] bg-black/45">
      {showPhoto ? (
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[11px] font-bold text-white/70">{initials}</span>
      )}
    </div>
  );
}

export function TournamentScorersSheet({ isOpen, scorers, players, onClose }: Props) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modalOverlay !z-[1002]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="modalSheet max-h-[min(92dvh,calc(100dvh-var(--app-header-h)-env(safe-area-inset-top,0px)-12px))] border border-[rgba(255,71,71,0.22)] shadow-[0_0_40px_rgba(255,71,71,0.1)] sm:max-w-[480px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-scorers-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div id="tournament-scorers-sheet-title" className="modalTitle text-white">
            Torschützen
          </div>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>

        <div className="modalBody">
          {scorers.length === 0 ? (
            <p className="text-[14px] text-white/55">Noch kein Tor erfasst.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {scorers.map((scorer, index) => (
                <li
                  key={scorer.playerId}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
                >
                  <span className="w-5 shrink-0 text-center text-[12px] font-bold tabular-nums text-white/45">
                    {index + 1}
                  </span>
                  <SheetScorerAvatar
                    playerId={scorer.playerId}
                    playerName={scorer.playerName}
                    players={players}
                  />
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">
                    {scorer.playerName}
                  </p>
                  <p className="shrink-0 text-[16px] font-bold tabular-nums text-red-200/95">
                    {scorer.goals}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
