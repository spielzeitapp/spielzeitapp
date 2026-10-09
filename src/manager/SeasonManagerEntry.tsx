import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';

/** Keep old App bookmarks, but open the shared Manager workspace. */
export function SeasonManagerEntry({ championship = false }: { championship?: boolean }): React.ReactElement {
  const { selectedTeamSeasonId } = useSession();
  const params = new URLSearchParams({ workMode: 'trainer' });
  if (selectedTeamSeasonId) params.set('teamSeason', selectedTeamSeasonId);
  return <Navigate replace to={`/manager/saisons/${championship ? 'meisterschaft' : 'verwaltung'}?${params}`} />;
}
