import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { RoleProvider } from './role/RoleContext';
import { HomePage } from '../pages/HomePage';
import { SchedulePage } from '../pages/SchedulePage';
import { MatchDetailPage } from '../pages/MatchDetail/MatchDetailPage';
import { LivePage } from '../pages/LivePage';
import { TeamPage } from '../pages/TeamPage';

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
            <Route path="match/:id" element={<MatchDetailPage />} />
            <Route path="live/:id" element={<LivePage />} />
            <Route path="team" element={<TeamPage />} />
          </Route>
        </Routes>
      </RoleProvider>
    </AppErrorBoundary>
  );
}
