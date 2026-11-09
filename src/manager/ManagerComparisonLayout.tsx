import React from 'react';
import { ManagerWorkspaceLayout } from './ManagerWorkspaceLayout';

/** Compatibility entry point; all behavior lives in the shared Manager shell. */
export function ManagerComparisonLayout(): React.ReactElement {
  return <ManagerWorkspaceLayout modern />;
}
