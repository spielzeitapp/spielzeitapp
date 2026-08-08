import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { normalizeRole, canViewParentLinks } from '../lib/roles';
import { dsPanelRowClass } from '../lib/premiumDesignSystem';
import { PageShell, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';
import { TeamParentsTab } from '../components/team/TeamParentsTab';
import { useTeamPlayerParentLinks } from '../hooks/useTeamPlayerParentLinks';
import { useTeamPlayerAppStatus } from '../hooks/useTeamPlayerAppStatus';

/** Eltern & Spielerzugänge — organisatorische Verwaltung (nicht Team-Sportansicht). */
export const ParentAccessPage: React.FC = () => {
  const { teamSeasonId, role, loading: tsLoading } = useActiveTeamSeason();
  const roleNormalized = normalizeRole(role);
  const allowed = canViewParentLinks(roleNormalized);
  const dataActive = allowed && !tsLoading;

  const {
    rows: parentLinkRows,
    loading: parentLinksLoading,
    error: parentLinksError,
    rpcMissing: parentLinksRpcMissing,
    refetch: refetchParentLinks,
  } = useTeamPlayerParentLinks(teamSeasonId, dataActive);

  const {
    rows: playerAppStatusRows,
    loading: playerAppStatusLoading,
    error: playerAppStatusError,
    rpcMissing: playerAppStatusRpcMissing,
  } = useTeamPlayerAppStatus(teamSeasonId, dataActive);

  if (!tsLoading && !allowed) {
    return <Navigate to="/app/mehr" replace />;
  }

  return (
    <PageShell
      background="more"
      className="min-h-[60vh] w-full px-3 py-6 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-lg space-y-4"
    >
      <Link
        to="/app/mehr"
        className={cn(dsPanelRowClass(), '!min-h-[40px] !py-2 text-sm font-semibold text-white/85')}
      >
        <span className="flex items-center gap-2">
          <ChevronLeft className="h-4 w-4 text-white/50" aria-hidden />
          Zurück zu Mehr
        </span>
      </Link>

      <SectionTitle subtitle="Verknüpfungen, Push und Spieler-App im Überblick">
        Eltern &amp; Spielerzugänge
      </SectionTitle>

      <TeamParentsTab
        teamSeasonId={teamSeasonId}
        tsLoading={tsLoading}
        rows={parentLinkRows}
        loading={parentLinksLoading}
        error={parentLinksError}
        rpcMissing={parentLinksRpcMissing}
        appStatusRows={playerAppStatusRows}
        appStatusLoading={playerAppStatusLoading}
        appStatusError={playerAppStatusError}
        appStatusRpcMissing={playerAppStatusRpcMissing}
        onLinksChanged={() => {
          void refetchParentLinks();
        }}
      />
    </PageShell>
  );
};
