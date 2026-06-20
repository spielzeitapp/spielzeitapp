import React, { useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import type { PlayerItem } from '../../hooks/usePlayers';
import type { TournamentGoalScorer } from '../../lib/tournamentGoalScorers';
import { safeText } from '../../lib/safeText';
import {
  premiumPlayerAvatarSrc,
  premiumPlayerInitials,
} from '../../lib/premiumPlayerCard';
import { AppButton } from '../ui/AppButton';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';
import { CenterEmptyState } from '../center/CenterEmptyState';
import { TournamentScorersSheet } from './TournamentScorersSheet';

const TOP_SCORERS_PREVIEW = 5;

type Props = {
  scorers: TournamentGoalScorer[];
  players?: PlayerItem[];
  loading?: boolean;
};

function ScorerAvatar({
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
  const initials = premiumPlayerInitials(safeText(playerName));
  const showPhoto = Boolean(src && src !== '/avatars/player-placeholder.png') && !failed;

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,71,71,0.18)] bg-black/40">
      {showPhoto ? (
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[10px] font-bold text-white/70">{initials}</span>
      )}
    </div>
  );
}

function ScorerRow({
  rank,
  scorer,
  players,
}: {
  rank: number;
  scorer: TournamentGoalScorer;
  players: PlayerItem[];
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
      <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-white/40">
        {rank}
      </span>
      <ScorerAvatar playerId={scorer.playerId} playerName={scorer.playerName} players={players} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-white/92">{safeText(scorer.playerName) || 'Spieler'}</p>
      </div>
      <p className="shrink-0 text-[15px] font-bold tabular-nums text-red-200/95">
        {scorer.goals}
        <span className="ml-0.5 text-[10px] font-semibold text-white/45">
          {scorer.goals === 1 ? 'Tor' : 'Tore'}
        </span>
      </p>
    </li>
  );
}

export function TournamentScorersOverviewCard({
  scorers,
  players = [],
  loading = false,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const preview = useMemo(() => scorers.slice(0, TOP_SCORERS_PREVIEW), [scorers]);
  const hasMore = scorers.length > TOP_SCORERS_PREVIEW;

  return (
    <>
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className={`${TC_SECTION_LABEL} flex items-center gap-1.5`}>
            <Target className="h-3.5 w-3.5 text-red-400/85" strokeWidth={2} aria-hidden />
            Torschützen
          </p>

          {loading ? (
            <p className="mt-2.5 text-[14px] text-white/55">Torschützen werden geladen…</p>
          ) : scorers.length === 0 ? (
            <CenterEmptyState
              embedded
              icon={Target}
              title="Keine Torschützen vorhanden"
              description="Tore aus Live-Spielen und beendeten Turnierspielen erscheinen hier automatisch."
            />
          ) : (
            <>
              <ol className="mt-2.5 flex list-none flex-col gap-1.5 p-0">
                {preview.map((scorer, index) => (
                  <ScorerRow
                    key={scorer.playerId}
                    rank={index + 1}
                    scorer={scorer}
                    players={players}
                  />
                ))}
              </ol>
              {hasMore ? (
                <AppButton
                  variant="secondary"
                  onClick={() => setSheetOpen(true)}
                  className="mt-2.5 w-full"
                >
                  Alle Torschützen anzeigen ({scorers.length})
                </AppButton>
              ) : null}
            </>
          )}
        </div>
      </section>

      <TournamentScorersSheet
        isOpen={sheetOpen}
        scorers={scorers}
        players={players}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
