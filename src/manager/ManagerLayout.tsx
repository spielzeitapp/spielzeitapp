import React from 'react';
import { isManagerComparison } from '../lib/managerComparison';
import { ManagerWorkspaceLayout } from './ManagerWorkspaceLayout';

export function ManagerLayout(): React.ReactElement {
  return <ManagerWorkspaceLayout modern={isManagerComparison()} />;
}
