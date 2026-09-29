import React from 'react';
import { Navigate } from 'react-router-dom';
import { ManagerDashboardPage } from './ManagerDashboardPage';
import { useManagerWorkMode } from './ManagerWorkModeContext';

/** Der Manager-Einstieg führt zur tatsächlich gewählten Arbeitsansicht. */
export function ManagerHomeRoute(): React.ReactElement {
  const { workMode, supportSession } = useManagerWorkMode();
  if (workMode === 'platform_admin' && !supportSession) return <Navigate to="/manager/plattform" replace />;
  if (workMode === 'club_admin') return <Navigate to="/manager/saisons" replace />;
  return <ManagerDashboardPage />;
}
