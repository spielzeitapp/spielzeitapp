import React from 'react';
import {Route,Routes,useNavigate,useLocation} from 'react-router-dom';
import {LivePage} from '../../pages/LivePage';
import {CompetitionPage} from '../../pages/CompetitionPage';
import { Header } from '../../app/layout/Header';
import { BottomNav } from '../../app/components/BottomNav';
import { WelcomeScreen } from '../../app/intro/WelcomeScreen';
import { SplashScreen } from '../../app/intro/SplashScreen';
import { AppHomePage } from '../../pages/AppHomePage';
import { TeamPage } from '../../pages/TeamPage';
import { SchedulePage } from '../../pages/SchedulePage';
import { ProfilePage } from '../../pages/ProfilePage';
import { MorePage } from '../../pages/MorePage';
export function PreviewPages() {
  const navigate = useNavigate();
  const {pathname}=useLocation();
  React.useEffect(()=>{document.querySelector('.appMain')?.scrollTo(0,0);},[pathname]);
  return <>
    <nav className="preview-toolbar flex flex-wrap content-start gap-1 bg-neutral-950 p-2 text-white" aria-label="Vorschauseite wählen">
      {[['Splash','intro/splash'],['Welcome','intro/welcome'],['Home','home'],['Termine','termine'],['Team','team'],['Profil','profile'],['Mehr','mehr']].map(([label,path]) => <button className="rounded border border-white/25 px-2 py-1 text-xs" key={path} onClick={()=>navigate('/app/'+path)}>{label}</button>)}
      <span className="w-full text-[10px] text-white/60">Vorschau · Fanansicht · Scrollen und Navigation möglich · Speichern gesperrt</span>
    </nav>
    <div className="preview-app-viewport text-white" onSubmitCapture={e=>{e.preventDefault();e.stopPropagation();}} onClickCapture={e=>{
      const anchor=(e.target as HTMLElement).closest('a');
      if(anchor){const url=new URL(anchor.href,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/app/')){e.preventDefault();e.stopPropagation();}}
    }}>
      <Routes>
        <Route path="/app/intro/splash" element={<SplashScreen previewOnly />} />
        <Route path="/app/intro/welcome" element={<WelcomeScreen previewOnly />} />
        <Route path="*" element={<div className="app bg-black"><Header /><main className="app__content appMain pt-[var(--app-header-offset)] pb-32"><Routes>
          <Route path="/app/home" element={<AppHomePage />} /><Route path="/app/termine" element={<SchedulePage />} />
          <Route path="/app/team" element={<TeamPage />} /><Route path="/app/profile" element={<ProfilePage />} />
          <Route path="/app/live/*" element={<LivePage />} />
          <Route path="/app/tabelle" element={<CompetitionPage />} />
          <Route path="/app/mehr" element={<MorePage />} />
          <Route path="*" element={<p>Diese Unterseite ist in der Vorschau noch nicht verfügbar. Die Hauptbereiche sind über die Navigation erreichbar.</p>} />
        </Routes></main><BottomNav /></div>} />
      </Routes>
    </div>
  </>;
}
