import React from 'react';
import { Navigate } from 'react-router-dom';
import { resolvePendingParentInvitePath } from '../../lib/parentLinkInvites';
import { isIntroFlowCompleted } from './introFlowSession';

/**
 * /app Index: bisheriger Redirect auf Termine, außer Intro noch nicht abgeschlossen
 * → dann Splash starten. Offene Eltern-Einladung hat Vorrang vor Termine/Rollenwahl.
 */
export const IntroEntryRedirect: React.FC = () => {
  const pendingInvite = resolvePendingParentInvitePath();
  if (pendingInvite) {
    return <Navigate to={pendingInvite} replace />;
  }

  if (isIntroFlowCompleted()) {
    return <Navigate to="/app/termine" replace />;
  }
  return <Navigate to="/app/intro/splash" replace />;
};
