/** Only local app pages may be used as the market's return destination. */
export function safeMarketAppReturn(raw:string|null|undefined):string{
 if(!raw||!raw.startsWith('/')||raw.startsWith('//')||/[\\\s]/.test(raw))return '/app/home';
 try{const u=new URL(raw,'https://switch.invalid');if(u.origin!=='https://switch.invalid'||!(u.pathname==='/app'||u.pathname.startsWith('/app/'))||u.pathname.startsWith('/app/set-password'))return '/app/home';return u.pathname+u.search+u.hash;}catch{return '/app/home';}
}
export function marketSwitchEntry(path:string){return '/app/tauschboerse?public=1&returnTo='+encodeURIComponent(safeMarketAppReturn(path));}
export function publicMarketForClub(club:string,returnTo:string|null){return '/marktplatz/'+encodeURIComponent(club)+'?'+new URLSearchParams({returnTo:safeMarketAppReturn(returnTo)});}
