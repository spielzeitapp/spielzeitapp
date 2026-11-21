import { useLocation } from 'react-router-dom';
import { ManagerMarketTeamsPage } from './ManagerMarketTeamsPage';
import React from 'react';
import { isManagerComparison } from '../lib/managerComparison';
import { ManagerWorkspaceLayout } from './ManagerWorkspaceLayout';

export function ManagerLayout(): React.ReactElement {
  const { pathname, search } = useLocation();
  if (pathname === '/manager/vereinsmarkt' && new URLSearchParams(search).get('from') === 'vereinsmarkt-manager') {
    return <ManagerMarketTeamsPage />;
  }
  return <ManagerWorkspaceLayout modern={isManagerComparison()} />;
}
