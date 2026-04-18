import React from 'react';
import { Navigate } from 'react-router-dom';
import { isIntroFlowCompleted } from './introFlowSession';

/**
 * /app Index: bisheriger Redirect auf Termine, außer Intro noch nicht abgeschlossen
 * → dann Splash starten.
 */
export const IntroEntryRedirect: React.FC = () => {
  if (isIntroFlowCompleted()) {
    return <Navigate to="/app/termine" replace />;
  }
  return <Navigate to="/app/intro/splash" replace />;
};
