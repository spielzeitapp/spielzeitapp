import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import { PushTeamSendPanel } from '../components/PushTeamSendPanel';

function isTrainerToolsRole(role: string): boolean {
  const r = (role ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach' || r === 'admin';
}

export const TrainerTeamPushPage: React.FC = () => {
  const { effectiveRole, selectedTeamSeasonId } = useSession();

  if (!isTrainerToolsRole(effectiveRole)) {
    return <Navigate to="/app/mehr" replace />;
  }

  return (
    <div
      className="page trainer-team-push min-h-[60vh] w-full px-4 py-6"
      style={{
        background:
          'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
        boxShadow: 'inset 0 0 120px rgba(120,20,20,0.12)',
      }}
    >
      <div className="mx-auto max-w-[560px] space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Team-Push</h1>
        <p className="text-sm text-white/60">Push an Eltern und Spieler (Trainer-Tools)</p>
        <PushTeamSendPanel teamSeasonId={selectedTeamSeasonId} variant="push-only" />
      </div>
    </div>
  );
};
