import React from 'react';
import { useParams, Navigate } from 'react-router-dom';

/**
 * Redirects old route /schedule/:matchId to /match/:matchId.
 */
export const LegacyScheduleMatchRedirect: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  return <Navigate to={matchId ? `/match/${matchId}` : '/schedule'} replace />;
};
