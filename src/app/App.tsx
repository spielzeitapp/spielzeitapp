import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { RoleProvider } from './role/RoleContext';
import { RequireAuth } from '../auth/RequireAuth';
import { HomePage } from '../pages/HomePage';
import { SchedulePage } from '../pages/SchedulePage';
import { MatchDetailPage } from '../pages/MatchDetail/MatchDetailPage';
import { EventDetailPage } from '../pages/EventDetailPage';
import { LivePage } from '../pages/LivePage';
import { TeamPage } from '../pages/TeamPage';
import { TablePage } from '../pages/TablePage';
import { LoginPage } from '../pages/LoginPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { SetupAdminPage } from '../pages/SetupAdminPage';
import { RolesAdminPage } from '../pages/RolesAdminPage';

const FALLBACK = (
  <div style={{ padding: 20, color: '#fff' }}>App lädt…</div>
);

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('AppErrorBoundary', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return FALLBACK;
    }
    return this.props.children;
  }
}

export default function App(): React.ReactElement {
  return (
    <AppErrorBoundary>
      <RoleProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="events/:eventId" element={<EventDetailPage />} />
            <Route path="match/:id" element={<MatchDetailPage />} />
            <Route path="live" element={<LivePage />} />
            <Route path="live/:id" element={<LivePage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="table" element={<TablePage />} />
          </Route>
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin/dashboard" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
          <Route path="/admin/setup" element={<SetupAdminPage />} />
          <Route path="/admin/roles" element={<RequireAuth allowedBackendRoles={['admin', 'head_coach']}><RolesAdminPage /></RequireAuth>} />
        </Routes>
      </RoleProvider>
    </AppErrorBoundary>
  );
}
