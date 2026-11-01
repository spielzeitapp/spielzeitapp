import React from 'react';
import {PreviewPages} from './PreviewPages';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../../index.css';
import './previewLayout.css';
import { AuthProvider, useAuth } from '../../auth/AuthProvider';
import { fetchUserRole, SessionViewProvider, type SessionTeamSeasonItem } from '../../auth/useSession';
import { getPlatformClub } from '../../lib/platformClubAdmin';
import { ClubThemeProvider } from '../../theme/ClubThemeProvider';
import { RoleProvider } from '../../app/role/RoleContext';
import { CompetitionProvider } from '../../app/components/CompetitionContext';
import { createPreviewFetch, previewSession } from './previewSession';
import type { ClubBranding } from '../../lib/clubBranding';

window.fetch = createPreviewFetch(window.fetch.bind(window));
const query = new URLSearchParams(window.location.search);
function Preview() {
  const { user, loading } = useAuth();
  const [season, setSeason] = React.useState<SessionTeamSeasonItem | null>(null);
  const [error, setError] = React.useState('');
  const [branding, setBranding] = React.useState<ClubBranding | undefined>();
  React.useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'manager-preview-branding') return;
      const b = event.data.branding;
      if (!b || !['primary_color','secondary_color','accent_color'].every(key => b[key] == null || /^#[0-9a-f]{6}$/i.test(b[key]))) return;
      setBranding(b);
    };
    window.addEventListener('message', receive);
    window.parent.postMessage({type:'manager-preview-ready'}, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);
  React.useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void (async () => {
      if (!user || await fetchUserRole(user.id) !== 'admin') throw Error('Nur für angemeldete Plattformadmins verfügbar.');
      const result = await getPlatformClub(query.get('clubId') ?? '');
      if (result.error || !result.data) throw Error(result.error || 'Verein nicht verfügbar.');
      const row = result.data.team_seasons.find(s => s.id === query.get('teamSeasonId'));
      if (!row) throw Error('Bitte zuerst eine Mannschaft und Saison im Manager anlegen.');
      if (!cancelled) setSeason({id:row.id,team_id:row.team_id,season_id:row.id,status:row.status,age_group:row.age_group,display_name:row.team_name,team:{id:row.team_id,name:row.team_name},season:{id:row.id,name:row.season_name ?? ''}} as SessionTeamSeasonItem);
    })().catch(e => {if (!cancelled) setError(String(e.message));});
    return () => {cancelled = true;};
  }, [user?.id, loading]);
  if (error) return <p role="alert" className="p-6 text-white">{error}</p>;
  if (!season || !user) return <p className="p-6 text-white">App-Vorschau wird geladen…</p>;
  return <SessionViewProvider value={previewSession(user.id, season)}><RoleProvider><ClubThemeProvider brandingOverride={branding}><CompetitionProvider><PreviewPages /></CompetitionProvider></ClubThemeProvider></RoleProvider></SessionViewProvider>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/app/intro/welcome']}><AuthProvider><Preview /></AuthProvider></MemoryRouter>);
