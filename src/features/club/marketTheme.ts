import {useSyncExternalStore} from 'react';
export type MarketTheme='light'|'dark';
export const MARKET_THEME_KEY='spielzeit.vereinsmarkt.appearance.v1';
const EVENT='vereinsmarkt-theme-changed';
let fallback:MarketTheme='dark';let storageUnavailable=false;
/** Device preference only: deliberately separate from SpielzeitApp and account data. */
export function readMarketTheme():MarketTheme{
 if(typeof window==='undefined')return 'dark';if(storageUnavailable)return fallback;
 try{const value=window.localStorage.getItem(MARKET_THEME_KEY);return value==='light'?'light':'dark';}catch{storageUnavailable=true;return fallback;}
}
export function setMarketTheme(theme:MarketTheme){
 fallback=theme;if(typeof window==='undefined')return;
 try{window.localStorage.setItem(MARKET_THEME_KEY,theme);}catch{storageUnavailable=true;}
 window.dispatchEvent(new Event(EVENT));
}
function subscribe(update:()=>void){
 if(typeof window==='undefined')return ()=>{};
 const storage=(event:StorageEvent)=>{if(event.key===MARKET_THEME_KEY||event.key===null)update();};
 window.addEventListener(EVENT,update);window.addEventListener('storage',storage);
 return()=>{window.removeEventListener(EVENT,update);window.removeEventListener('storage',storage);};
}
/** iOS standalone chrome may retain its launch color across a live theme change.
 * Persist first, then reload the same URL so the early document theme is correct.
 * Only an explicit toggle reloads; storage events and ordinary navigation do not. */
export function toggleMarketTheme(){
 const next=readMarketTheme()==='dark'?'light':'dark';
 if(typeof window==='undefined')return;
 const nav=window.navigator as Navigator & {standalone?:boolean};
 const ios=!!nav&&(/iPad|iPhone|iPod/.test(nav.userAgent)||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1));
 const standalone=nav?.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches===true;
 if(ios&&standalone&&!storageUnavailable){
  try{
   // Keep the current document unchanged until navigation replaces it.
   // Publishing the store event here renders the new page under old iOS chrome.
   window.localStorage.setItem(MARKET_THEME_KEY,next);fallback=next;
   window.location.reload();return;
  }catch{ /* If persistence or navigation is blocked, keep the toggle usable. */ }
 }
 setMarketTheme(next);
}
export function useMarketTheme(){const theme=useSyncExternalStore(subscribe,readMarketTheme,()=> 'dark' as MarketTheme);return {theme,toggle:toggleMarketTheme};}
export function isMarketThemeRoute(pathname:string,search:string){return /^\/marktplatz\/[0-9a-f-]{36}(?:\/(?:anmelden|registrieren|passwort-vergessen))?\/?$/i.test(pathname)||(['/login','/register','/forgot-password','/reset-password'].includes(pathname)&&new URLSearchParams(search).get('context')==='vereinsmarkt');}
