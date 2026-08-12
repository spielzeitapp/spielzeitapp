import React from 'react';
import { Navigate } from 'react-router-dom';
import { POST_AUTH_HOME_PATH } from '../../lib/authRedirect';
import {
  readPendingParentEmailInviteFlag,
  resolvePendingParentInvitePath,
} from '../../lib/parentLinkInvites';
import { isIntroFlowCompleted } from './introFlowSession';

/**
 * /app Index:
 * 1) Pending Parent Invite
 * 2) Intro noch offen → Splash
 * 3) Intro erledigt → Home (nicht Termine)
 */
export const IntroEntryRedirect: React.FC = () => {
  const pendingInvite = resolvePendingParentInvitePath();
  if (pendingInvite) {
    return <Navigate to={pendingInvite} replace />;
  }
  if (readPendingParentEmailInviteFlag()) {
    return <Navigate to="/app/parent-invite" replace />;
  }

  if (isIntroFlowCompleted()) {
    return <Navigate to={POST_AUTH_HOME_PATH} replace />;
  }
  return <Navigate to="/app/intro/splash" replace />;
};
