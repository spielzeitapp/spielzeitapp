import React, { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { AppLayout } from './layout/AppLayout';
import { RoleProvider } from './role/RoleContext';
import { HomePage } from '../pages/HomePage';
import { SchedulePage } from '../pages/SchedulePage';
import { LegacyScheduleMatchRedirect } from '../pages/LegacyScheduleMatchRedirect';
import { MatchDetailPage } from '../pages/MatchDetail/MatchDetailPage';
import { EventDetailPage } from '../pages/EventDetailPage';
import { LivePage } from '../pages/LivePage';
import { TeamPage } from '../pages/TeamPage';
import { ProfilePage } from '../pages/ProfilePage';
import { TablePage } from '../pages/TablePage';
import { RolesAdminPage } from '../pages/RolesAdminPage';
import { LoginPage } from '../pages/LoginPage';
import { SetupAdminPage } from '../pages/SetupAdminPage';
import { RequireAuth } from '../auth/RequireAuth';
import { seedPlayersIfEmpty } from '../services/playerRepo';

const App: React.FC = () => {
  useEffect(() => {
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.from("teams").select("*");

        if (error) {
          console.error("SUPABASE ERROR:", error);
        } else {
          console.log("SUPABASE CONNECTED:", data);
        }
      } catch (err) {
        console.error("SUPABASE CRASH:", err);
      }
    };

    testConnection();

    // Bestehender Seed darf NICHT entfernt werden
    seedPlayersIfEmpty('u11a');
  }, []);

  return (
    <RoleProvider>
      <div className="flex min-h-dvh w-full justify-center px-0 sm:px-4">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup-admin" element={<SetupAdminPage />} />
          <Route path="/" element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="home" element={<HomePage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="schedule/:matchId" element={<LegacyScheduleMatchRedirect />} />
            <Route path="match/:id" element={<MatchDetailPage />} />
            <Route path="events/:eventId" element={<EventDetailPage />} />
            <Route path="live" element={<LivePage />} />
            <Route path="live/:matchId" element={<LivePage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="table" element={<TablePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="roles-admin" element={<RequireAuth allowedBackendRoles={['admin', 'head_coach']}><RolesAdminPage /></RequireAuth>} />
          </Route>
        </Routes>
      </div>
    </RoleProvider>
  );
};

export default App;

