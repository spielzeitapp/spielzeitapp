import React from 'react';
import { SchedulePage } from '../../pages/SchedulePage';
import { ManagerAppWorkspace } from '../ManagerAppWorkspace';

export function ManagerMobileSchedulePage(): React.ReactElement {
  return (
    <ManagerAppWorkspace><SchedulePage /></ManagerAppWorkspace>
  );
}
