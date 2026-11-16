import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import {LaunchSplash} from './LaunchSplash';
import {AudienceApp} from './AudienceApp';
import './audience.css';
if('serviceWorker' in navigator)window.addEventListener('load',()=>{void navigator.serviceWorker.register('/turnier-app/sw.js',{scope:'/turnier-app/'}).catch(()=>{/* Browser mode remains available. */})});
try {
 const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;
 const last=localStorage.getItem('sz:audience:last');
 if(standalone&&/^\/turnier-app\/?$/.test(window.location.pathname)&&last&&/^[a-f\d-]{36}$|^ev-tournament$/i.test(last))window.history.replaceState(null,'','/turnier-app/'+encodeURIComponent(last));
}catch{/* Keep the entry screen when storage is unavailable. */}
createRoot(document.getElementById('root')!).render(<React.StrictMode><LaunchSplash><BrowserRouter basename="/turnier-app"><Routes><Route path="*" element={<AudienceApp/>}/></Routes></BrowserRouter></LaunchSplash></React.StrictMode>);
