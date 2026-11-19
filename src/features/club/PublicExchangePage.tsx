import {MarketAccessPrompt} from './MarketAccessPrompt';
import {useProfile} from '../../auth/useProfile';
import {marketAccountIdentity} from './marketAccountIdentity';
import {useMarketAppSwitch} from './useMarketAppSwitch';
import {MarketPushReminder} from './MarketPushReminder';
import {MarketAccountSettings} from './MarketAccountSettings';
import {MarketHomeScreenGuide} from './MarketHomeScreenGuide';
import {MarketJoinPanel,MarketInviteAdmin,MarketMembersAdmin,marketInviteToken} from './MarketJoinPanel';
import {TestEnvironmentNotice} from '../../components/TestEnvironmentNotice';
import {createPortal} from 'react-dom';
import {MarketNotifications} from './MarketNotifications';
import {marketAuthPath} from './marketAuth';
import {ListingPhotoActions} from './ListingPhotoActions';
import {ExchangePhotoGallery} from './ExchangePhotoGallery';
import {LayoutDiagnostics} from '../../components/LayoutDiagnostics';
import {useUnreadCount} from '../../hooks/useUnreadCount';
import {supabase} from '../../lib/supabaseClient';
import {MarketThemeToggle} from './MarketThemeToggle';
import {MarketSplash} from './MarketSplash';
import {useSavedListings} from './useSavedListings';
import {useSavedOffers,type SavedOffer} from './useSavedOffers';
import {SaveListingButton} from './SaveListingButton';
import {MarketShoesIcon,ShinGuardIcon} from './FootballMarketIcons';
import { safeMarketAppReturn } from './marketSwitch';
import { useAuth } from '../../auth/AuthProvider';
import React,{useEffect,useState} from 'react';
import {Link,Navigate,useLocation,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {Home,Search,Plus,MessageCircle,User,Shirt,ShoppingBag,ArrowLeft,LockKeyhole,SlidersHorizontal,Heart,ClipboardList,MoreHorizontal} from 'lucide-react';
import {ExchangeFilterSheet} from './ExchangeFilterSheet';
import {EMPTY_EXCHANGE_FILTERS,selectExchangeItems,type ExchangeFilters,type CatalogSort} from './exchangeCatalog';
import {isStagingApp} from '../../lib/appEnvironment';
import './clubExchange.css';
import './publicExchange.css';
const MemberMarket=React.lazy(()=>import('../../pages/ClubExchangePage').then(m=>({default:m.ClubExchangePage})));
type Offer=SavedOffer;
/** Match the app's native fixed-bottom anchor, outside the scrolling market shell. */
function MarketNavViewport({children}:{children:React.ReactNode}){
 const frame=<div className="public-market-nav-viewport">{children}</div>;
 return typeof document==='undefined'?frame:createPortal(frame,document.body);
}
export default function PublicExchangePage(){
 const {clubId}=useParams();const location=useLocation();
 if(isStagingApp()&&clubId==='9c7a8741-6e73-42d5-88d8-46ce5217e8cd')return <Navigate replace to={{pathname:'/vereinsmarkt/3db6fce2-a4c1-44a5-a333-19d1d4d62e6a',search:location.search,hash:location.hash}}/>;
 return <PublicExchangeContent/>;
}
function PublicExchangeContent(){
 const {user,signOut,loading:authLoading}=useAuth();
 const [authPrompt,setAuthPrompt]=useState('');
 const showAppSwitch=useMarketAppSwitch();
 const {profile}=useProfile(user?.id);
 const account=marketAccountIdentity(profile?.id===user?.id?profile:null,user?.user_metadata);
 useEffect(()=>{if(!user)return;let active=true;void supabase.auth.getSession().then(({data})=>{if(active&&data.session)void fetch('/api/exchange/push',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`}}).catch(()=>{});}).catch(()=>{});return()=>{active=false;};},[user?.id]);
 const {clubId=''}=useParams();const [params,setParams]=useSearchParams();
 const unreadMessages=useUnreadCount(user?.id,'exchange',clubId);
 const [settledClub,setSettledClub]=useState('');
 const [readyClub,setReadyClub]=useState('');
 useEffect(()=>{if(settledClub===clubId&&!authLoading)setReadyClub(clubId);},[settledClub,clubId,authLoading]);
 const [club,setClub]=useState('Dein Verein'),[items,setItems]=useState<Offer[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const [search,setSearch]=useState(''),[filters,setFilters]=useState<ExchangeFilters>({...EMPTY_EXCHANGE_FILTERS}),[sort,setSort]=useState<CatalogSort>('newest'),[filterOpen,setFilterOpen]=useState(false);
 const [joinNeeded,setJoinNeeded]=useState(false),[marketAccess,setMarketAccess]=useState(false);
 useEffect(()=>{let active=true;setJoinNeeded(false);setMarketAccess(false);if(!user)return;void supabase.rpc('exchange_access',{p_club_id:clubId}).then(r=>{if(active&&!r.error){setJoinNeeded(r.data===false);setMarketAccess(r.data===true);}});return()=>{active=false;};},[user?.id,clubId,retry]);
 const appReturn=safeMarketAppReturn(params.get('returnTo'));
 const invite=marketInviteToken(params.get('invite'));
 const returnQuery={returnTo:appReturn,...(invite?{invite}:{})};
 const view=params.get('view')||'start';const navigate=useNavigate();const marks=useSavedListings(user?.id);const wish=useSavedOffers(user?.id,clubId,marks.ids,view==='saved');const selected=[...items,...wish.items].find(i=>i.id===params.get('listing'));
 const publicPath=`/vereinsmarkt/${encodeURIComponent(clubId)}`;
 const invitationQuery=invite?'&invite='+invite:'';
 const memberPath=`${publicPath}?view=member&club=${encodeURIComponent(clubId)}&returnTo=${encodeURIComponent(appReturn)}${invitationQuery}`;
 const startPath=`${publicPath}?view=start&returnTo=${encodeURIComponent(appReturn)}${invitationQuery}`;
 const savedPath=`${publicPath}?view=saved&returnTo=${encodeURIComponent(appReturn)}${invitationQuery}`;
 const login=(next=startPath)=>{const raw=next==='/app/profile'?startPath:next;const target=invite&&!new URL(raw,'https://market.invalid').searchParams.has('invite')?raw+(raw.includes('?')?'&':'?')+'invite='+invite:raw;return user?target:marketAuthPath('login',new URLSearchParams({next:target,context:'vereinsmarkt',marketClub:clubId}).toString());};
 const catalog=items.map(i=>({...i,owner_id:'',team_label:''}));
 const shown=selectExchangeItems(catalog,'all','',filters,search,sort);
 useEffect(()=>{let active=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);setLoading(true);setError('');void(async()=>{
   const r=await fetch(`/api/exchange/public?club=${encodeURIComponent(clubId)}`,{cache:'no-store',signal:controller.signal});const body=await r.json();if(!r.ok)throw Error(body.error||'Laden fehlgeschlagen');
   if(active){setClub(body.club.name);setItems(body.items);}
 })().catch(e=>{if(active)setError(e.name==='AbortError'?'Die Verbindung dauert zu lange. Bitte erneut versuchen.':e.message);}).finally(()=>{clearTimeout(timeout);if(active){setSettledClub(clubId);setLoading(false);}});return()=>{active=false;clearTimeout(timeout);controller.abort();};},[clubId,retry,view==='member']);
 const go=(next:string)=>setParams({...returnQuery,view:next});
 const activeNav=view==='member'?(params.get('mode')==='mine'?'mine':params.get('mode')==='requests'?'nachrichten':params.get('mode')==='create'?'inserieren':'start'):view==='saved'?'saved':view==='start'||view==='suchen'?'start':'';
 const price=(i:Offer)=>i.offer==='Verkaufen'?Number(i.price).toLocaleString('de-AT',{style:'currency',currency:'EUR'}):i.offer;
 const saveButton=(i:Offer)=><SaveListingButton saved={marks.saved.has(i.id)} busy={marks.loading||marks.pending.includes(i.id)} onClick={()=>{if(user)void marks.toggle(i.id);else setAuthPrompt(login(savedPath));}}/>;
 const card=(i:Offer)=><div className="market-save-card" key={i.id}><button className="exchange-card" onClick={()=>{if(i.internal)navigate(memberPath+'&listing='+i.id);else setParams({...returnQuery,view:view==='saved'?'saved':'suchen',listing:i.id});}}><div className="exchange-card-image">{i.photos[0]?<img src={i.photos[0]} alt={i.title} loading="lazy"/>:<Shirt size={40}/>}<span>{i.status}</span></div><div className="exchange-card-copy"><h3>{i.title}</h3><p>Größe {i.size} · {i.condition}</p><strong>{price(i)}</strong>{i.internal&&<small>Vereinsintern</small>}</div></button>{saveButton(i)}</div>;
 const captureAccess=(event:React.MouseEvent<HTMLDivElement>)=>{
  if(user||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const anchor=(event.target as Element).closest?.('a');
  if(!anchor||anchor.hasAttribute('data-market-auth-direct')||anchor.classList.contains('public-market-login')||anchor.textContent?.trim()==='Anmelden')return;
  const target=new URL(anchor.href,window.location.href);
  if(target.origin!==window.location.origin||target.pathname!==new URL(login(),window.location.origin).pathname)return;
  event.preventDefault();event.stopPropagation();setAuthPrompt(target.pathname+target.search+target.hash);
 };
 if(readyClub!==clubId)return <MarketSplash/>;
 return <div className="public-exchange" onClickCapture={captureAccess}>{isStagingApp()&&<div className="public-market-test-notice"><TestEnvironmentNotice/></div>}<header className="public-market-header"><img src="/vereinsmarkt/icon-180.png" width="44" height="44" alt="" style={{borderRadius:10}}/><div style={{flex:1,minWidth:0}}><strong>{club}</strong><small>Vereinsmarkt</small></div><MarketThemeToggle/>{showAppSwitch&&<button type="button" className="public-market-app-switch" data-app-return={appReturn} onClick={()=>navigate(appReturn)} aria-label="Zur SpielzeitApp wechseln" title="SpielzeitApp"><img src="/apple-touch-icon.png" width="36" height="36" alt=""/></button>}{user?<button type="button" className="public-market-account public-market-profile-avatar" onClick={()=>go('profil')} aria-label={account.name?`Profil von ${account.name}`:'Dein Profil'} title={account.name||'Dein Profil'} aria-current={view==='profil'?'page':undefined}>{account.initials||<User size={22} aria-hidden="true"/>}</button>:<Link className="public-market-login" to={login()} aria-label="Anmelden" title="Anmelden"><User size={22} aria-hidden="true"/><span>Anmelden</span></Link>}<button type="button" className="public-market-account" aria-label="Mehr" title="Mehr" aria-current={view==='mehr'?'page':undefined} onClick={()=>go('mehr')}><MoreHorizontal size={22}/></button></header><MarketHomeScreenGuide clubId={clubId} userId={user?.id} afterJoinOnly autoOnFirstVisit/>{user&&view!=='profil'&&<MarketPushReminder clubId={clubId} userId={user.id} enabled={marketAccess}/>}<main className="exchange">{(invite||joinNeeded)&&view!=='member'&&<MarketJoinPanel clubId={clubId} clubName={club} onJoined={()=>setRetry(n=>n+1)}/>} {params.get('layout')==='1'&&<LayoutDiagnostics initiallyOpen/>}{marks.error&&<p role="alert" className="exchange-alert">{marks.error}</p>}
 {view==='member'?<React.Suspense fallback={<p role="status">Dein Vereinsmarkt wird geladen…</p>}>{user?<MemberMarket embedded embeddedClubId={clubId}/>:<MarketJoinPanel clubId={clubId} clubName={club} onJoined={()=>setRetry(n=>n+1)}/>}</React.Suspense>:loading&&settledClub!==clubId?<p role="status">Angebote werden geladen…</p>:error?<div role="alert" className="exchange-alert">{error}<button onClick={()=>setRetry(n=>n+1)}>Erneut laden</button></div>:selected?<>
  <ExchangePhotoGallery key={selected.id} photos={selected.photos} title={selected.title} actions={<ListingPhotoActions onBack={()=>go(view==='saved'?'saved':'suchen')} save={saveButton(selected)} shareUrl={`${publicPath}?view=suchen&listing=${selected.id}`}/>}/><div className="exchange-item-head"><h3>{selected.title}</h3><strong>{price(selected)}</strong></div><dl className="listing-facts"><div><dt>Größe</dt><dd>{selected.size}</dd></div><div><dt>Zustand</dt><dd>{selected.condition}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div></dl>{selected.description&&<section className="listing-description"><h2>Beschreibung</h2><p className="exchange-description">{selected.description}</p></section>}<p className="listing-club">{club} · Vereinsmarkt</p><Link className="public-market-cta" to={login(memberPath+`&listing=${selected.id}`)}><MessageCircle size={20}/>Nachricht senden</Link><p className="public-market-note"><a href={`/vereinsmarkt/hilfe.html?club=${clubId}`}>Inhalt melden</a></p><p className="public-market-note"><LockKeyhole size={15}/>Private Anfrage nach Anmeldung. Vereinszuordnung erforderlich.</p>
 </>:view==='saved'?<section><button className="exchange-back" onClick={()=>go('profil')}><ArrowLeft size={18}/>Zum Profil</button><h1>Meine Merkliste</h1><p>Deine gemerkten Angebote in diesem Verein.</p>{!user?<Link className="public-market-cta" to={login(savedPath)}>Für die Merkliste anmelden</Link>:marks.loading||wish.loading?<p role="status">Merkliste wird geladen…</p>:wish.error?<p role="alert">{wish.error}</p>:wish.items.length?<div className="exchange-grid">{wish.items.map(card)}</div>:<div className="exchange-empty"><Heart/><h3>Noch nichts gemerkt</h3><p>Tippe bei einem Inserat auf das Herz. Nicht mehr verfügbare Angebote werden ausgeblendet.</p><button onClick={()=>go('start')}>Angebote entdecken</button></div>}</section>:view==='mehr'?<section className="public-market-profile" aria-label="Mehr im Vereinsmarkt"><button className="exchange-back" onClick={()=>go('start')}><ArrowLeft size={18}/>Zum Vereinsmarkt</button><h1>Mehr</h1><MarketHomeScreenGuide clubId={clubId} userId={user?.id} alwaysAvailable/><div className="public-market-profile-links"><Link to={publicPath+'?'+new URLSearchParams({...returnQuery,view:'profil'}).toString()}>Profil & Konto <User size={20}/></Link><a href={`/vereinsmarkt/hilfe.html?club=${clubId}`}>Hilfe & Kontakt <MessageCircle size={20}/></a></div></section>:view==='profil'?<section className="public-market-profile" aria-label="Dein Vereinsmarkt">
 <div className="public-market-profile-hero"><div className="public-market-profile-symbol">{user&&account.initials?<span>{account.initials}</span>:<User size={46}/>}</div><p className="public-market-eyebrow">Profil &amp; Konto</p><h1>{user&&account.name?account.name:'Dein Vereinsmarkt'}</h1><p>Inserate verwalten und private Anfragen austauschen – mit deinem Vereinskonto.</p>{user?<><p>Du bist angemeldet. Deine Inserate und Anfragen findest du hier.</p><button className="public-market-register" onClick={()=>void signOut().catch(()=>setError('Abmeldung fehlgeschlagen.'))}>Abmelden</button></>:<><Link className="public-market-cta" to={login('/app/profile')}>Anmelden</Link><Link className="public-market-register" to={marketAuthPath('register',new URLSearchParams({next:startPath,context:'vereinsmarkt',marketClub:clubId}).toString())}>Noch kein Konto? Registrieren</Link></>}<small>{user?'Deine Zuordnung gilt für den Vereinsmarkt.':<>Ein Konto für Vereinsmarkt und SpielzeitApp. Noch keines? Registriere dich – eine App-Installation ist nicht nötig. Zum Inserieren und Anfragen brauchst du eine Vereinszuordnung.</>}</small></div>
 {user&&<MarketAccountSettings user={user} name={account.name} clubId={clubId} clubName={club} onDeleted={()=>{go('start');window.location.assign(publicPath+'?view=start&accountDeleted=1');}}/>}
 {user&&<MarketHomeScreenGuide clubId={clubId} userId={user.id} alwaysAvailable/>}
 {user&&<><MarketNotifications userId={user.id} unread={unreadMessages}/><MarketInviteAdmin clubId={clubId} userId={user.id}/><MarketMembersAdmin clubId={clubId} userId={user.id}/></>}
 <div className="public-market-profile-links"><Link to={login(savedPath)}>Meine Merkliste <Heart size={20}/></Link><Link to={login(memberPath+'&mode=mine')}>Meine Inserate <Shirt size={20}/></Link><Link to={login(memberPath+'&mode=requests')}>Meine Anfragen <MessageCircle size={20}/></Link></div>
 </section>:view==='shop'?<section className="public-market-panel"><Shirt size={32}/><h1>Lieber neu?</h1><p>Hier kann dein Verein später neue Vereinskleidung oder den Shop seines Ausrüsters anbieten.</p><strong>Noch kein Shop freigeschaltet.</strong><button onClick={()=>go('start')}>Zum Vereinsmarkt</button></section>:view==='app'?<section className="public-market-panel"><h1>Mehr Verein. Eine App.</h1><p>Termine, Mannschaften und Vereinsleben an einem Ort.</p><a className="public-market-cta" href="https://spielzeitapp.at/landingpage">SpielzeitApp kennenlernen</a></section>:<>
 {view==='start'&&<><p className="public-market-eyebrow">Alle Teams. Ein Verein.</p><h1>Vereinsmarkt</h1><p className="public-market-intro">Fußballsachen weitergeben. Im Verein verbunden.</p></>}
 <div className="exchange-search"><Search size={20}/><input aria-label="Öffentliche Angebote suchen" placeholder="Was suchst du?" type="search" value={search} onChange={e=>{setSearch(e.target.value);}}/></div>
 <div className="public-market-categories">{[{label:'Alle Artikel',Icon:Shirt,category:''},{label:'Schuhe',Icon:MarketShoesIcon,category:'Schuhe'},{label:'Zubehör',Icon:ShinGuardIcon,category:'Zubehör'},{label:'Neu im Shop',Icon:ShoppingBag,category:'shop'}].map(({label,Icon,category})=><button key={label} onClick={()=>{if(category==='shop')go('shop');else{setFilters({...EMPTY_EXCHANGE_FILTERS,category});go('suchen');}}}><Icon size={23}/>{label}</button>)}</div>
 <div className="public-market-tools"><button onClick={()=>setFilterOpen(true)}><SlidersHorizontal size={18}/>Filter {Object.values(filters).filter(Boolean).length||''}</button><select aria-label="Öffentliche Angebote sortieren" value={sort} onChange={e=>setSort(e.target.value as CatalogSort)}><option value="newest">Neueste zuerst</option><option value="price-asc">Preis aufsteigend</option><option value="price-desc">Preis absteigend</option></select></div>
 <div className="exchange-result-row"><h2>{view==='start'?'Frisch eingestellt':`${shown.length} ${shown.length===1?'Angebot':'Angebote'}`}</h2>{view==='start'&&<button className="exchange-back" onClick={()=>go('suchen')}>Alle ansehen</button>}</div>
 {shown.length?<div className={view==='start'?'public-market-rail':'exchange-grid'}>{(view==='start'?shown.slice(0,8):shown).map(card)}</div>:<div className="exchange-empty"><Shirt/><h3>{items.length?'Keine passenden Angebote':'Zu klein? Gib es weiter.'}</h3><p>{items.length?'Ändere deine Suche oder setze die Filter zurück.':'Hier finden Trainingssachen ein neues Team. Stelle das erste öffentliche Inserat ein.'}</p></div>}
 {view==='start'&&<><Link className="public-market-banner" to={login(memberPath+'&mode=create')}><Plus size={30}/><span><strong>Zu klein? Gib es weiter.</strong><small>Inserat mit Foto erstellen – im Verein.</small></span></Link><button className="public-market-banner" onClick={()=>go('shop')}><Shirt size={28}/><span><strong>Lieber neu?</strong><small>Vereinsshop · Neue Vereinsartikel</small></span></button></>}
 </>}
 <p className="public-market-note">Stöbern ohne Anmeldung · Inserieren und private Anfragen mit Vereinskonto</p><footer className="public-market-footer"><button onClick={()=>go('app')}>powered by <span className="font-semibold">SpielzeitApp</span></button><nav className="public-market-legal-links" aria-label="Rechtliches und Hilfe">{[['nutzungsbedingungen','Nutzungsbedingungen'],['datenschutz','Datenschutz'],['impressum','Impressum'],['hilfe','Hilfe & Kontakt']].map(([path,label])=><a key={path} href={`/vereinsmarkt/${path}.html?club=${clubId}`}>{label}</a>)}</nav></footer>
 </main><MarketNavViewport><nav className="public-market-nav" aria-label="Marktplatz-Navigation">{[
 {id:'start',label:'Start',Icon:Home,to:startPath},
 {id:'saved',label:'Merkliste',Icon:Heart,to:login(savedPath)},
 {id:'inserieren',label:'Inserieren',Icon:Plus,to:login(memberPath+'&mode=create')},
 {id:'mine',label:'Meine Inserate',Icon:ClipboardList,to:login(memberPath+'&mode=mine')},
 {id:'nachrichten',label:'Nachrichten',Icon:MessageCircle,to:login(memberPath+'&mode=requests')}
 ].map(({id,label,Icon,to})=><Link key={id} to={to} aria-current={activeNav===id?'page':undefined}><Icon size={23}/>{label}{id==='nachrichten'&&unreadMessages>0&&<span className="market-unread-badge" aria-label={`${unreadMessages} ungelesene Nachrichten`}>{unreadMessages>99?'99+':unreadMessages}</span>}</Link>)}</nav></MarketNavViewport>
 {authPrompt&&!user&&<MarketAccessPrompt loginUrl={authPrompt} onClose={()=>setAuthPrompt('')}/>}
 {filterOpen&&<ExchangeFilterSheet items={catalog} value={filters} view="all" userId="" search={search} onClose={()=>setFilterOpen(false)} onApply={v=>{setFilters(v);setFilterOpen(false);go('suchen');}}/>}
 </div>;
}
