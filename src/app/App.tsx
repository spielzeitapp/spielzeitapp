import React, { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { InternalLayout } from './layout/InternalLayout.tsx';
import { RoleProvider } from './role/RoleContext';
import { RequireAuth } from '../auth/RequireAuth';
import { HomePage } from '../pages/HomePage';
import { AppHomePage } from '../pages/AppHomePage';
import { SchedulePage } from '../pages/SchedulePage';
import { CalendarPage } from '../pages/CalendarPage';
import { TermineLayout } from '../pages/TermineLayout';
import { MoreLayout } from '../pages/MoreLayout';
import { MorePage } from '../pages/MorePage';
import { ParentOnboardingPage } from '../pages/ParentOnboardingPage';
import { PlayerOnboardingPage } from '../pages/PlayerOnboardingPage';
import { RoleChoicePage } from '../pages/RoleChoicePage';
import { MatchDetailPage } from '../pages/MatchDetail/MatchDetailPage';
import { EventDetailPage } from '../pages/EventDetailPage';
import { LivePage } from '../pages/LivePage';
import { TeamPage } from '../pages/TeamPage';
import { TablePage } from '../pages/TablePage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { SetPasswordPage } from '../pages/SetPasswordPage';
import { AdminLoginPage } from '../pages/AdminLoginPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { SetupAdminPage } from '../pages/SetupAdminPage';
import { RolesAdminPage } from '../pages/RolesAdminPage';
import { JoinRequestsAdminPage } from '../pages/JoinRequestsAdminPage';

/** Freundliche Fallback-UI statt endloser „App lädt…“ nach Render-Crash */
function AppErrorFallback(): React.ReactElement {
  return (
    <div
      style={{
        padding: 24,
        color: '#fff',
        maxWidth: 420,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p style={{ marginBottom: 12, fontWeight: 600 }}>Die App konnte nicht geladen werden.</p>
      <p style={{ marginBottom: 16, fontSize: 14, opacity: 0.85 }}>
        Bitte öffne die Terminübersicht oder lade die Seite neu.
      </p>
      <a
        href="/app/termine"
        style={{ color: '#f87171', fontWeight: 600, marginRight: 16 }}
      >
        Zu Termine
      </a>
      <button
        type="button"
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.35)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 8,
          cursor: 'pointer',
        }}
        onClick={() => window.location.reload()}
      >
        Neu laden
      </button>
    </div>
  );
}

/** /app: sofortiger Redirect auf Termine (kein Warten auf Session/Memberships). */
function StartupRedirectToTermine(): React.ReactElement {
  useEffect(() => {
    console.info('[startup] redirect target: /app/termine');
  }, []);
  return <Navigate to="/app/termine" replace />;
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
      return <AppErrorFallback />;
    }
    return this.props.children;
  }
}

/** Nur internen Bereich: /app, Login, Admin. Keine Public-Landingpage. */
function InternalRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="app.html" element={<Navigate to="/app" replace />} />
      {/* Kurz-URLs → interne App */}
      <Route path="/home" element={<Navigate to="/app/termine" replace />} />
      <Route path="/team" element={<Navigate to="/app/team" replace />} />
      <Route path="/termine" element={<Navigate to="/app/termine" replace />} />
      <Route path="/mehr" element={<Navigate to="/app/mehr" replace />} />
      <Route path="/more" element={<Navigate to="/app/mehr" replace />} />
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="schedule" element={<Navigate to="/app/termine" replace />} />
      <Route path="live" element={<Navigate to="/app/live" replace />} />
      <Route path="app" element={<RequireAuth><InternalLayout /></RequireAuth>}>
        <Route index element={<StartupRedirectToTermine />} />
        <Route path="home" element={<AppHomePage />} />
        <Route path="termine" element={<TermineLayout />}>
          <Route index element={<SchedulePage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
        <Route path="schedule" element={<Navigate to="/app/termine" replace />} />
        <Route path="calendar" element={<Navigate to="/app/termine/calendar" replace />} />
        <Route path="role-choice" element={<RoleChoicePage />} />
        <Route path="parent-onboarding" element={<ParentOnboardingPage />} />
        <Route path="player-onboarding" element={<PlayerOnboardingPage />} />
        <Route path="set-password" element={<SetPasswordPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="match/:id" element={<MatchDetailPage />} />
        <Route path="live" element={<LivePage />} />
        <Route path="live/:id" element={<LivePage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="table" element={<TablePage />} />
        <Route path="mehr" element={<MoreLayout />}>
          <Route index element={<MorePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<Navigate to="/app/profile" replace />} />
        </Route>
        <Route path="notifications" element={<Navigate to="/app/mehr/notifications" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="mehr/profile" element={<Navigate to="/app/profile" replace />} />
      </Route>
      <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<RequireAuth><AdminDashboardPage /></RequireAuth>} />
      <Route path="/admin/setup" element={<SetupAdminPage />} />
      <Route
        path="/admin/roles"
        element={
          <RequireAuth allowedBackendRoles={['admin', 'head_coach']}>
            <RolesAdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/join-requests"
        element={
          <RequireAuth allowedBackendRoles={['admin', 'head_coach', 'trainer', 'co_trainer']}>
            <JoinRequestsAdminPage />
          </RequireAuth>
        }
      />
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
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
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
