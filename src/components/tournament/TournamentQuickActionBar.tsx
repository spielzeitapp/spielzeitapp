import React from 'react';
import { CenterQuickActionBar } from '../center/CenterQuickActionBar';
import { shareTournamentCenter } from './tournamentCenterUtils';

type Props = {
  shareTitle: string;
  onAddToCalendar: () => void;
  onNavigate?: () => void;
  showNavigation?: boolean;
};

export function TournamentQuickActionBar({
  shareTitle,
  onAddToCalendar,
  onNavigate,
  showNavigation = false,
}: Props) {
  return (
    <CenterQuickActionBar
      onAddToCalendar={onAddToCalendar}
      onNavigate={onNavigate}
      showNavigation={showNavigation}
      onShare={() => shareTournamentCenter(shareTitle)}
    />
  );
}
