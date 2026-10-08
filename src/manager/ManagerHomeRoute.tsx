import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ManagerDashboardPage } from './ManagerDashboardPage';
import { useManagerWorkMode } from './ManagerWorkModeContext';

/** Der Manager-Einstieg führt zur tatsächlich gewählten Arbeitsansicht. */
export function ManagerHomeRoute(): React.ReactElement {
  const { workMode, supportSession } = useManagerWorkMode();
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (workMode === 'platform_admin' && !supportSession) return <Navigate to="/manager/plattform" replace />;
  if (workMode === 'club_admin') return <Navigate to="/manager/saisons" replace />;
  if (workMode === 'trainer' && mobile) return <Navigate to="/manager/training/einheiten" replace />;
  return <ManagerDashboardPage />;
}
