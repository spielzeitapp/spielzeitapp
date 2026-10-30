import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import '../../index.css';
import { AuthProvider, useAuth } from '../../auth/AuthProvider';
import { fetchUserRole, SessionViewProvider, type SessionTeamSeasonItem } from '../../auth/useSession';
import { getPlatformClub } from '../../lib/platformClubAdmin';
import { ClubThemeProvider } from '../../theme/ClubThemeProvider';
import { RoleProvider } from '../../app/role/RoleContext';
import { CompetitionProvider } from '../../app/components/CompetitionContext';
import { Header } from '../../app/layout/Header';
import { BottomNav } from '../../app/components/BottomNav';
import { WelcomeScreen } from '../../app/intro/WelcomeScreen';
import { SplashScreen } from '../../app/intro/SplashScreen';
import { AppHomePage } from '../../pages/AppHomePage';
import { TeamPage } from '../../pages/TeamPage';
import { SchedulePage } from '../../pages/SchedulePage';
import { ProfilePage } from '../../pages/ProfilePage';
import { MorePage } from '../../pages/MorePage';
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
function PreviewPages() {
  const navigate = useNavigate();
  return <>
    <nav className="fixed inset-x-0 top-0 z-[200] flex flex-wrap gap-1 bg-neutral-950 p-2 text-white" aria-label="Vorschauseite wählen">
      {[['Splash','intro/splash'],['Welcome','intro/welcome'],['Home','home'],['Termine','termine'],['Team','team'],['Profil','profile'],['Mehr','mehr']].map(([label,path]) => <button className="rounded border border-white/25 px-2 py-1 text-xs" key={path} onClick={()=>navigate('/app/'+path)}>{label}</button>)}
      <span className="w-full text-[10px] text-white/60">Vorschau · Fanansicht · Seiten oben wählen · Bedienelemente gesperrt</span>
    </nav>
    <div className="pt-24 text-white" onSubmitCapture={e=>{e.preventDefault();e.stopPropagation();}} onClickCapture={e=>{
      const target=e.target as HTMLElement;
      if (target.closest('button,input,select,textarea,a')) {e.preventDefault();e.stopPropagation();}
    }} onChangeCapture={e=>{e.preventDefault();e.stopPropagation();}}>
      <Routes>
        <Route path="/app/intro/splash" element={<SplashScreen />} />
        <Route path="/app/intro/welcome" element={<WelcomeScreen />} />
        <Route path="*" element={<><Header /><main className="pb-32"><Routes>
          <Route path="/app/home" element={<AppHomePage />} /><Route path="/app/termine" element={<SchedulePage />} />
          <Route path="/app/team" element={<TeamPage />} /><Route path="/app/profile" element={<ProfilePage />} />
          <Route path="/app/mehr" element={<MorePage />} />
          <Route path="*" element={<p>Bitte oben eine Vorschauseite auswählen.</p>} />
        </Routes></main><BottomNav /></>} />
      </Routes>
    </div>
  </>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/app/intro/welcome']}><AuthProvider><Preview /></AuthProvider></MemoryRouter>);
