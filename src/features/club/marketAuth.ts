const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CLUB='3db6fce2-a4c1-44a5-a333-19d1d4d62e6a';
/** Presentation context only; never grants membership or changes auth checks. */
export function marketAuthContext(search:string){
 const p=new URLSearchParams(search),raw=p.get('next')||'';let next='';let club=p.get('marketClub')||'';
 try{const u=new URL(raw,'https://market.invalid');if(raw.startsWith('/')&&!raw.startsWith('//')&&!/[\\\s]/.test(raw)&&u.origin==='https://market.invalid'&&(['/app/tauschboerse','/app/profile'].includes(u.pathname)||/^\/marktplatz\/[0-9a-f-]{36}$/i.test(u.pathname))){next=u.pathname+u.search+u.hash;if(!UUID.test(club))club=u.searchParams.get('club')||u.pathname.split('/')[2]||'';}}catch{}
 const active=p.get('context')==='vereinsmarkt'||next.startsWith('/app/tauschboerse');
 if(!active)return null;
 if(!UUID.test(club))club=DEFAULT_CLUB;
 return {club,back:`/marktplatz/${club}`,next:next||`/app/tauschboerse?club=${club}`};
}
export function marketAuthPath(screen:'login'|'register'|'forgot-password',search:string){const c=marketAuthContext(search);if(!c)return '/'+screen;const q=new URLSearchParams({context:'vereinsmarkt',marketClub:c.club,next:c.next});return '/'+screen+'?'+q;}
