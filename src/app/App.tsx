import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { InternalLayout } from './layout/InternalLayout.tsx';
import { IntroAppOutlet } from './intro/IntroAppOutlet';
import { IntroEntryRedirect } from './intro/IntroEntryRedirect';
import { SplashScreen } from './intro/SplashScreen';
import { WelcomeScreen } from './intro/WelcomeScreen';
import { RoleProvider } from './role/RoleContext';
import { RequireAuth } from '../auth/RequireAuth';
import { useViewportRecovery } from '../hooks/useViewportRecovery';
import { HomePage } from '../pages/HomePage';
import { AppHomePage } from '../pages/AppHomePage';
import { SchedulePage } from '../pages/SchedulePage';
import { CalendarPage } from '../pages/CalendarPage';
import { TermineLayout } from '../pages/TermineLayout';
import { MoreLayout } from '../pages/MoreLayout';
import { MorePage } from '../pages/MorePage';
import { ParentOnboardingPage } from '../pages/ParentOnboardingPage';
import { FanOnboardingPage } from '../pages/FanOnboardingPage';
import { PlayerOnboardingPage } from '../pages/PlayerOnboardingPage';
import { RoleChoicePage } from '../pages/RoleChoicePage';
import { MatchDetailPage } from '../pages/MatchDetail/MatchDetailPage';
import { MatchPreparationPage } from '../pages/match/MatchPreparationPage';
import { MatchLineupPage } from '../pages/match/MatchLineupPage';
import { EventDetailPage } from '../pages/EventDetailPage';
import { MatchSetupScreen } from '../pages/live/MatchSetupScreen';
import { LivePage } from '../pages/LivePage';
import { TeamPage } from '../pages/TeamPage';
import { TrainerProfilePage } from '../pages/TrainerProfilePage';
import { TablePage } from '../pages/TablePage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { TrainerTeamPushPage } from '../pages/TrainerTeamPushPage';
import { TrainerTemplatesPage } from '../pages/TrainerTemplatesPage';
import { TrainerRemindersPage } from '../pages/TrainerRemindersPage';
import { TrainerPreviewPage } from '../pages/TrainerPreviewPage';
import { PlayerMatchdayPosterPreviewPage } from '../pages/dev/PlayerMatchdayPosterPreviewPage';
import { SeasonManagementPage } from '../pages/SeasonManagementPage';
import { ChampionshipManagementPage } from '../pages/ChampionshipManagementPage';
import { TeamSchedulePage } from '../pages/TeamSchedulePage';
import { ParentAccessPage } from '../pages/ParentAccessPage';
import { JugglingChallengePage } from '../pages/JugglingChallengePage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { SetPasswordPage } from '../pages/SetPasswordPage';
import { AdminLoginPage } from '../pages/AdminLoginPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { SetupAdminPage } from '../pages/SetupAdminPage';
import { ManagerLayout } from '../manager/ManagerLayout';
import { ManagerDashboardPage } from '../manager/ManagerDashboardPage';
import { ManagerPlatzbelegungPage } from '../manager/ManagerPlatzbelegungPage';
import { ManagerTrainingLibraryPage } from '../manager/ManagerTrainingLibraryPage';
import { ManagerTrainingSessionsPage } from '../manager/ManagerTrainingSessionsPage';
import { ManagerTrainingSessionEditorPage } from '../manager/ManagerTrainingSessionEditorPage';
import { ManagerTrainingTemplatesPage } from '../manager/ManagerTrainingTemplatesPage';
import { ManagerTrainingChroniclePage } from '../manager/ManagerTrainingChroniclePage';
import { ManagerSeasonsPage } from '../manager/ManagerSeasonsPage';
import { ManagerSeasonRosterPage } from '../manager/ManagerSeasonRosterPage';
import { ManagerOefbImportPage } from '../manager/ManagerOefbImportPage';
import { RolesAdminPage } from '../pages/RolesAdminPage';
import { JoinRequestsAdminPage } from '../pages/JoinRequestsAdminPage';
import { PlayerAccessRedeemPage } from '../pages/PlayerAccessRedeemPage';
import { PublicTeamTournamentPage } from '../pages/public/PublicTeamTournamentPage';
import { DemoLayout } from '../demo/DemoLayout';
import { DemoEventPage } from '../demo/pages/DemoEventPage';
import { DemoTournamentPage } from '../demo/pages/DemoTournamentPage';
import { DemoTourWhatPage } from '../demo/pages/DemoTourWhatPage';
import { DemoTourCreateTrainingPage } from '../demo/pages/DemoTourCreateTrainingPage';
import { DemoTourCreateMatchPage } from '../demo/pages/DemoTourCreateMatchPage';
import { DemoTourParentRsvpPage } from '../demo/pages/DemoTourParentRsvpPage';
import { DemoTourChroniclePage } from '../demo/pages/DemoTourChroniclePage';
import { DemoTourSeasonPage } from '../demo/pages/DemoTourSeasonPage';
import { DEMO_MATCH_ID_LIVE } from '../demo/demoDataSource';

/** /demo/players/:playerId → produktive TeamPage mit Profil-Modal */
function DemoPlayerProfileRedirect(): React.ReactElement {
  const { playerId } = useParams<{ playerId: string }>();
  const q = playerId ? `?player=${encodeURIComponent(playerId)}` : '';
  return <Navigate to={`/demo/team${q}`} replace />;
}

/** /demo/training → produktive Trainingszentrale (Team-Tab) */
function DemoTrainingRedirect(): React.ReactElement {
  return <Navigate to="/demo/team?tab=training" replace />;
}

/** /demo/match → produktives Match-Center (Heimspiel-Vorbereitung) */
function DemoMatchRedirect(): React.ReactElement {
  return (
    <Navigate
      to={`/demo/match-preparation?matchId=${encodeURIComponent(DEMO_MATCH_ID_LIVE)}`}
      replace
    />
  );
}

/** Freundliche Fallback-UI statt endloser „App lädt…“ nach Render-Crash */
function AppErrorFallback({
  error,
  componentStack,
}: {
  error: Error | null;
  componentStack: string;
}): React.ReactElement {
  const message = (error?.message ?? 'Unbekannter Fehler').trim() || 'Unbekannter Fehler';
  const stackLines = (error?.stack ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  const componentLines = (componentStack ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
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
      <div
        style={{
          marginBottom: 16,
          border: '1px solid rgba(248,113,113,0.45)',
          borderRadius: 8,
          padding: 10,
          background: 'rgba(0,0,0,0.35)',
          fontSize: 12,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug-Info</div>
        <div><strong>error.message:</strong> {message}</div>
        <div style={{ marginTop: 6 }}>
          <strong>error.stack (erste 3 Zeilen):</strong>
          <div>{stackLines.length > 0 ? stackLines.join('\n') : '-'}</div>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>componentStack (erste 5 Zeilen):</strong>
          <div>{componentLines.length > 0 ? componentLines.join('\n') : '-'}</div>
        </div>
      </div>
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

/** Kurz-URL `/live?…` → `/app/live?…` (Query beibehalten, z. B. matchId). */
function LiveShortcutRedirect(): React.ReactElement {
  const [sp] = useSearchParams();
  const q = sp.toString();
  return <Navigate to={q ? `/app/live?${q}` : '/app/live'} replace />;
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; componentStack: string }
> {
  state = { hasError: false, error: null, componentStack: '' };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, componentStack: errorInfo.componentStack ?? '' });
    console.error('AppErrorBoundary', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <AppErrorFallback error={this.state.error} componentStack={this.state.componentStack} />;
    }
    return this.props.children;
  }
}

/** Nur internen Bereich: /app, Login, Admin. Keine Public-Landingpage. */
function InternalRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="app.html" element={<Navigate to="/app" replace />} />
      {/* Öffentliche Trainer-Demo – gemeinsamer Einstieg + produktives Layout, kein Login */}
      <Route path="demo" element={<DemoLayout />}>
        <Route index element={<Navigate to="intro/splash" replace />} />
        <Route path="intro/splash" element={<SplashScreen />} />
        <Route path="intro/welcome" element={<WelcomeScreen />} />
        <Route element={<InternalLayout />}>
          <Route path="home" element={<AppHomePage />} />
          <Route path="termine" element={<TermineLayout />}>
            <Route index element={<SchedulePage />} />
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="team/trainer/:userId" element={<TrainerProfilePage />} />
          <Route path="players/:playerId" element={<DemoPlayerProfileRedirect />} />
          <Route path="training" element={<DemoTrainingRedirect />} />
          <Route path="match" element={<DemoMatchRedirect />} />
          <Route path="match-preparation" element={<MatchPreparationPage />} />
          <Route path="match-lineup" element={<MatchLineupPage />} />
          <Route path="event" element={<DemoEventPage />} />
          <Route path="turnier" element={<DemoTournamentPage />} />
          <Route path="live" element={<LivePage />} />
          <Route path="tour/what" element={<DemoTourWhatPage />} />
          <Route path="tour/create-training" element={<DemoTourCreateTrainingPage />} />
          <Route path="tour/create-match" element={<DemoTourCreateMatchPage />} />
          <Route path="tour/parent-training" element={<DemoTourParentRsvpPage />} />
          <Route path="tour/parent-match" element={<DemoTourParentRsvpPage />} />
          <Route path="tour/chronicle" element={<DemoTourChroniclePage />} />
          <Route path="tour/season" element={<DemoTourSeasonPage />} />
          <Route path="mehr" element={<MoreLayout />}>
            <Route index element={<MorePage />} />
          </Route>
        </Route>
      </Route>
      {/* Kurz-URLs → interne App */}
      <Route path="/home" element={<Navigate to="/app/termine" replace />} />
      <Route path="/team" element={<Navigate to="/app/team" replace />} />
      <Route path="/termine" element={<Navigate to="/app/termine" replace />} />
      <Route path="/mehr" element={<Navigate to="/app/mehr" replace />} />
      <Route path="/more" element={<Navigate to="/app/mehr" replace />} />
      <Route path="/" element={<Navigate to="/app" replace />} />
      {/* TURNIER.1 – öffentliche Team-Turnierseite (ohne Login) */}
      <Route path="turnier/:publicId" element={<PublicTeamTournamentPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="app/player-access" element={<PlayerAccessRedeemPage />} />
      <Route path="schedule" element={<Navigate to="/app/termine" replace />} />
      <Route path="live" element={<LiveShortcutRedirect />} />
      <Route path="app" element={<RequireAuth><IntroAppOutlet /></RequireAuth>}>
        <Route index element={<IntroEntryRedirect />} />
        <Route path="intro/splash" element={<SplashScreen />} />
        <Route path="intro/welcome" element={<WelcomeScreen />} />
        <Route element={<InternalLayout />}>
        <Route path="home" element={<AppHomePage />} />
        <Route path="termine" element={<TermineLayout />}>
          <Route index element={<SchedulePage />} />
          <Route path="calendar" element={<CalendarPage />} />
        </Route>
        <Route path="schedule" element={<Navigate to="/app/termine" replace />} />
        <Route path="calendar" element={<Navigate to="/app/termine/calendar" replace />} />
        <Route path="role-choice" element={<RoleChoicePage />} />
        <Route path="parent-onboarding" element={<ParentOnboardingPage />} />
        <Route path="fan-onboarding" element={<FanOnboardingPage />} />
        <Route path="player-onboarding" element={<PlayerOnboardingPage />} />
        <Route path="set-password" element={<SetPasswordPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="match/:id" element={<MatchDetailPage />} />
        <Route path="aufstellung" element={<Navigate to="/app/match-lineup" replace />} />
        <Route path="match-preparation" element={<MatchPreparationPage />} />
        <Route path="match-lineup" element={<MatchLineupPage />} />
        <Route path="live/match" element={<Navigate to="/app/live/setup" replace />} />
        <Route path="live/setup" element={<MatchSetupScreen />} />
        <Route path="live" element={<LivePage />} />
        <Route path="live/:id" element={<LivePage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="team/juggling-challenge" element={<JugglingChallengePage />} />
        <Route
          path="team-management/parent-access"
          element={<Navigate to="/app/mehr/parent-access" replace />}
        />
        <Route path="team/trainer/:userId" element={<TrainerProfilePage />} />
        <Route path="table" element={<TablePage />} />
        <Route path="spielplan" element={<TeamSchedulePage />} />
        <Route path="mehr" element={<MoreLayout />}>
          <Route index element={<MorePage />} />
          <Route path="trainer/team-push" element={<TrainerTeamPushPage />} />
          <Route path="trainer/vorlagen" element={<TrainerTemplatesPage />} />
          <Route path="trainer/erinnerungen" element={<TrainerRemindersPage />} />
          <Route path="trainer/preview" element={<TrainerPreviewPage />} />
          <Route path="seasons" element={<SeasonManagementPage />} />
          <Route path="championship" element={<ChampionshipManagementPage />} />
          <Route path="parent-access" element={<ParentAccessPage />} />
          {/* Legacy: /app/mehr/notifications -> /app/nachrichten */}
          <Route path="notifications" element={<Navigate to="/app/nachrichten" replace />} />
          <Route path="profile" element={<Navigate to="/app/profile" replace />} />
        </Route>
        {/* Legacy: /app/notifications -> /app/nachrichten */}
        <Route path="notifications" element={<Navigate to="/app/nachrichten" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="mehr/profile" element={<Navigate to="/app/profile" replace />} />

        <Route path="nachrichten" element={<NotificationsPage />} />
        <Route path="nachrichten/:messageId" element={<Navigate to="/app/nachrichten" replace />} />
        <Route path="dev/player-matchday-poster" element={<PlayerMatchdayPosterPreviewPage />} />
        </Route>
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
      <Route
        path="/manager"
        element={
          <RequireAuth>
            <ManagerLayout />
          </RequireAuth>
        }
      >
        <Route index element={<ManagerDashboardPage />} />
        <Route path="dashboard" element={<ManagerDashboardPage />} />
        <Route path="platzbelegung" element={<ManagerPlatzbelegungPage />} />
        <Route path="saisons" element={<ManagerSeasonsPage />} />
        <Route path="saisons/:seasonId/kader" element={<ManagerSeasonRosterPage />} />
        <Route path="saisons/:seasonId/oefb-import" element={<ManagerOefbImportPage />} />
        <Route path="training" element={<Navigate to="/manager/training/einheiten" replace />} />
        <Route path="training/bibliothek" element={<ManagerTrainingLibraryPage />} />
        <Route path="training/vorlagen" element={<ManagerTrainingTemplatesPage />} />
        <Route path="training/chronik" element={<ManagerTrainingChroniclePage />} />
        <Route path="training/einheiten" element={<ManagerTrainingSessionsPage />} />
        <Route path="training/einheiten/neu" element={<ManagerTrainingSessionEditorPage />} />
        <Route path="training/einheiten/:id" element={<ManagerTrainingSessionEditorPage />} />
      </Route>
    </Routes>
  );
}

/** Nur öffentliche App: Landingpage, Spielplan. Kein /app, kein Login. */
function PublicRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="app.html" element={<Navigate to="/" replace />} />
      <Route path="demo" element={<DemoLayout />}>
        <Route index element={<Navigate to="intro/splash" replace />} />
        <Route path="intro/splash" element={<SplashScreen />} />
        <Route path="intro/welcome" element={<WelcomeScreen />} />
        <Route element={<InternalLayout />}>
          <Route path="home" element={<AppHomePage />} />
          <Route path="termine" element={<TermineLayout />}>
            <Route index element={<SchedulePage />} />
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="players/:playerId" element={<DemoPlayerProfileRedirect />} />
          <Route path="training" element={<DemoTrainingRedirect />} />
          <Route path="match" element={<DemoMatchRedirect />} />
          <Route path="match-preparation" element={<MatchPreparationPage />} />
          <Route path="match-lineup" element={<MatchLineupPage />} />
          <Route path="event" element={<DemoEventPage />} />
          <Route path="turnier" element={<DemoTournamentPage />} />
          <Route path="live" element={<LivePage />} />
          <Route path="tour/what" element={<DemoTourWhatPage />} />
          <Route path="tour/create-training" element={<DemoTourCreateTrainingPage />} />
          <Route path="tour/create-match" element={<DemoTourCreateMatchPage />} />
          <Route path="tour/parent-training" element={<DemoTourParentRsvpPage />} />
          <Route path="tour/parent-match" element={<DemoTourParentRsvpPage />} />
          <Route path="tour/chronicle" element={<DemoTourChroniclePage />} />
          <Route path="tour/season" element={<DemoTourSeasonPage />} />
          <Route path="mehr" element={<MoreLayout />}>
            <Route index element={<MorePage />} />
          </Route>
        </Route>
      </Route>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="live" element={<SchedulePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      {/* TURNIER.1 – öffentliche Team-Turnierseite auch auf der Public-Domain */}
      <Route path="turnier/:publicId" element={<PublicTeamTournamentPage />} />
      <Route path="app" element={<Navigate to="/" replace />} />
      <Route path="app/*" element={<Navigate to="/" replace />} />
      <Route path="/admin" element={<Navigate to="/" replace />} />
      <Route path="/admin/*" element={<Navigate to="/" replace />} />
      <Route path="/manager" element={<Navigate to="/login" replace />} />
      <Route path="/manager/*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

interface AppProps {
  isInternalDomain: boolean;
}

export default function App({ isInternalDomain }: AppProps): React.ReactElement {
  // iOS/PWA: Viewport-Variablen (--app-vh/--app-visual-vh) über den App-Lebenszyklus pflegen.
  useViewportRecovery();
  return (
    <AppErrorBoundary>
      <RoleProvider>
        {isInternalDomain ? <InternalRoutes /> : <PublicRoutes />}
      </RoleProvider>
    </AppErrorBoundary>
  );
}
