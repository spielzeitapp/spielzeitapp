import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTeamPlayerParentLinks } from '../../hooks/useTeamPlayerParentLinks';

/** Kompakter Trainer-Hinweis im Spielerprofil — volle Verwaltung unter Mehr. */
export const TrainerParentAccessHint: React.FC<{
  teamSeasonId: string;
  playerId: string;
}> = ({ teamSeasonId, playerId }) => {
  const [linkedCount, setLinkedCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetchTeamPlayerParentLinks(teamSeasonId);
      if (!alive) return;
      const row = res.rows.find((r) => r.player_id === playerId);
      setLinkedCount(row?.parent_count ?? 0);
    })();
    return () => {
      alive = false;
    };
  }, [teamSeasonId, playerId]);

  const label =
    linkedCount == null
      ? 'Elternzugang wird geladen…'
      : linkedCount === 1
        ? 'Elternzugang: 1 verknüpft'
        : `Elternzugang: ${linkedCount} verknüpft`;

  return (
    <div className="mb-3 mt-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
      <p className="text-sm font-medium text-white/90">{label}</p>
      <Link
        to={`/app/mehr/parent-access?player=${encodeURIComponent(playerId)}`}
        className="mt-1 inline-flex text-sm font-semibold text-red-300 hover:text-red-200"
      >
        Zugänge verwalten →
      </Link>
    </div>
  );
};
