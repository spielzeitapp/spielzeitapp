const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CLUB='9c7a8741-6e73-42d5-88d8-46ce5217e8cd';
/** Presentation context only; never grants membership or changes auth checks. */
export function marketAuthContext(search:string,pathname=typeof window!=='undefined'?window.location?.pathname||'':''){
 const route=pathname.match(/^\/(?:vereinsmarkt|marktplatz)\/([0-9a-f-]{36})\/(?:anmelden|registrieren|passwort-vergessen)\/?$/i);
 const p=new URLSearchParams(search);if(route&&UUID.test(route[1])){p.set('context','vereinsmarkt');p.set('marketClub',route[1]);}
 const raw=p.get('next')||'';let next='';let club=p.get('marketClub')||'';
 try{const u=new URL(raw,'https://market.invalid');if(raw.startsWith('/')&&!raw.startsWith('//')&&!/[\\\s]/.test(raw)&&u.origin==='https://market.invalid'&&(['/app/tauschboerse','/app/profile'].includes(u.pathname)||/^\/(?:vereinsmarkt|marktplatz)\/[0-9a-f-]{36}$/i.test(u.pathname))){next=u.pathname.replace(/^\/marktplatz\//,'/vereinsmarkt/')+u.search+u.hash;if(!UUID.test(club))club=u.searchParams.get('club')||u.pathname.split('/')[2]||'';}}catch{}
 const active=p.get('context')==='vereinsmarkt'||next.startsWith('/app/tauschboerse')||(next.startsWith('/vereinsmarkt/')||next.startsWith('/marktplatz/'));
 if(!active)return null;
 if(!UUID.test(club))club=DEFAULT_CLUB;
 const back=`/vereinsmarkt/${club}`;
 if(next.startsWith('/app/')){const old=new URL(next,'https://market.invalid');const q=new URLSearchParams({view:old.pathname==='/app/profile'?'start':'member',club});for(const key of ['listing','thread','mode']){const v=old.searchParams.get(key);if(v)q.set(key,v);}if(old.searchParams.get('view')==='requests')q.set('mode','requests');next=back+'?'+q;}
 return {club,back,next:next||back+'?view=start'};
}
export function marketAuthPath(screen:'login'|'register'|'forgot-password',search:string){const c=marketAuthContext(search);if(!c)return '/'+screen;const q=new URLSearchParams({context:'vereinsmarkt',marketClub:c.club,next:c.next});const segment={login:'anmelden',register:'registrieren','forgot-password':'passwort-vergessen'}[screen];return c.back+'/'+segment+'?'+q;}
