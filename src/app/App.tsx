import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { InternalLayout } from './layout/InternalLayout.tsx';
import { RoleProvider } from './role/RoleContext';
import { RequireAuth } from '../auth/RequireAuth';
import { useSession } from '../auth/useSession';
import { HomePage } from '../pages/HomePage';
import { SchedulePage } from '../pages/SchedulePage';
import { ParentOnboardingPage } from '../pages/ParentOnboardingPage';
import { RoleChoicePage } from '../pages/RoleChoicePage';
import { MatchDetailPage } from '../pages/MatchDetail/MatchDetailPage';
import { EventDetailPage } from '../pages/EventDetailPage';
import { LivePage } from '../pages/LivePage';
import { TeamPage } from '../pages/TeamPage';
import { TablePage } from '../pages/TablePage';
import { ProfilePage } from '../pages/ProfilePage';
import { LoginPage } from '../pages/LoginPage';
import { AdminLoginPage } from '../pages/AdminLoginPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { SetupAdminPage } from '../pages/SetupAdminPage';
import { RolesAdminPage } from '../pages/RolesAdminPage';

const FALLBACK = (
  <div style={{ padding: 20, color: '#fff' }}>App lädt…</div>
);

/**
 * Startseite nach erfolgreichem Login im internen Bereich.
 * Entscheidet anhand der Rolle wohin umgeleitet wird:
 * - parent   → Parent-Onboarding
 * - trainer → Schedule (Trainer-Ansicht)
 * - fan     → Schedule (Fan-Ansicht)
 * - keine Rolle (weder global noch Membership) → RoleChoicePage
 */
function AppIndexRedirect(): React.ReactElement {
  const { loading, memberships, membershipRole, backendRole } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-white/70">
        Laden…
      </div>
    );
  }

  // 1) Membership-Rolle hat Priorität
  const primaryMembershipRole = membershipRole || memberships[0]?.role || null;

  // 2) Wenn keine Membership-Rolle vorhanden ist, auf globale Backend-Rolle zurückfallen
  const effectiveBackendRole = backendRole || null;

  const finalRole = (primaryMembershipRole || effectiveBackendRole || '').toLowerCase();

  // 3) Wenn überhaupt keine Rolle existiert → RoleChoicePage
  if (!finalRole) {
    return <Navigate to="/app/role-choice" replace />;
  }

  // 4) Rollenbasierte Zielseiten
  if (finalRole === 'parent') {
    return <Navigate to="/app/parent-onboarding" replace />;
  }

  if (finalRole === 'trainer') {
    return <Navigate to="/app/schedule" replace />;
  }

  if (finalRole === 'fan') {
    return <Navigate to="/app/schedule" replace />;
  }

  // Alle anderen Rollen (player, admin, etc.) landen ebenfalls im Schedule.
  return <Navigate to="/app/schedule" replace />;
}

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

/** Nur internen Bereich: /app, Login, Admin. Keine Public-Landingpage. */
function InternalRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="app.html" element={<Navigate to="/app" replace />} />
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="schedule" element={<Navigate to="/app/schedule" replace />} />
      <Route path="live" element={<Navigate to="/app/live" replace />} />
      <Route path="app" element={<RequireAuth><InternalLayout /></RequireAuth>}>
        <Route index element={<AppIndexRedirect />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="role-choice" element={<RoleChoicePage />} />
        <Route path="parent-onboarding" element={<ParentOnboardingPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="match/:id" element={<MatchDetailPage />} />
        <Route path="live" element={<LivePage />} />
        <Route path="live/:id" element={<LivePage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="table" element={<TablePage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="/admin/setup" element={<SetupAdminPage />} />
      <Route path="/admin/roles" element={<RequireAuth allowedBackendRoles={['admin', 'head_coach']}><RolesAdminPage /></RequireAuth>} />
    </Routes>
  );
}

/** Nur öffentliche App: Landingpage, Spielplan. Kein /app, kein Login. */
function PublicRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="app.html" element={<Navigate to="/" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="live" element={<SchedulePage />} />
        <Route path="login" element={<LoginPage />} />
      </Route>
      <Route path="app" element={<Navigate to="/" replace />} />
      <Route path="app/*" element={<Navigate to="/" replace />} />
      <Route path="/admin" element={<Navigate to="/" replace />} />
      <Route path="/admin/*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

interface AppProps {
  isInternalDomain: boolean;
}

export default function App({ isInternalDomain }: AppProps): React.ReactElement {
  return (
    <AppErrorBoundary>
      <RoleProvider>
        {isInternalDomain ? <InternalRoutes /> : <PublicRoutes />}
      </RoleProvider>
    </AppErrorBoundary>
  );
}
