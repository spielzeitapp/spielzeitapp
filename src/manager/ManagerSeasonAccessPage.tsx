import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { isPlatformAdminRole } from '../lib/platformClubAdmin';
import { TeamParentsTab } from '../components/team/TeamParentsTab';
import { useTeamPlayerParentLinks } from '../hooks/useTeamPlayerParentLinks';
import { useTeamPlayerAppStatus } from '../hooks/useTeamPlayerAppStatus';
import { useManagerWorkMode } from './ManagerWorkModeContext';
export function ManagerSeasonAccessPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { backendRole, loading } = useSession();
  const { supportSession } = useManagerWorkMode();
  const allowed = isPlatformAdminRole(backendRole);
  const links = useTeamPlayerParentLinks(seasonId ?? null, allowed && !loading);
  const status = useTeamPlayerAppStatus(seasonId ?? null, allowed && !loading);
  const season = supportSession?.teamSeasons.find(s => s.id === seasonId);
  if (!loading && !allowed) return <Navigate to="/manager" replace />;
  return <section className="space-y-4"><h1 className="text-2xl font-bold text-slate-900">Eltern & Spielerzugänge</h1><p className="text-sm text-slate-600">Eltern verknüpfen oder einladen und Spielerzugänge prüfen.</p><div className="rounded-2xl bg-[#111114] p-4"><TeamParentsTab teamSeasonId={seasonId ?? null} teamSeasonLabel={season?.display_name ?? 'Mannschaftssaison'} focusPlayerId={null} tsLoading={loading} rows={links.rows} loading={links.loading} error={links.error} rpcMissing={links.rpcMissing} appStatusRows={status.rows} appStatusLoading={status.loading} appStatusError={status.error} appStatusRpcMissing={status.rpcMissing} onLinksChanged={() => { void links.refetch(); }} /></div></section>;
}
