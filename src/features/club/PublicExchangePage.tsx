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
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {Home,Search,Plus,MessageCircle,User,Shirt,ShoppingBag,ArrowLeft,LockKeyhole,SlidersHorizontal,Heart,ClipboardList} from 'lucide-react';
import {ExchangeFilterSheet} from './ExchangeFilterSheet';
import {EMPTY_EXCHANGE_FILTERS,selectExchangeItems,type ExchangeFilters,type CatalogSort} from './exchangeCatalog';
import {isStagingApp} from '../../lib/appEnvironment';
import './clubExchange.css';
import './publicExchange.css';
const MemberMarket=React.lazy(()=>import('../../pages/ClubExchangePage').then(m=>({default:m.ClubExchangePage})));
type Offer=SavedOffer;
export default function PublicExchangePage(){
 const {user,signOut,loading:authLoading}=useAuth();
 useEffect(()=>{if(!user)return;let active=true;void supabase.auth.getSession().then(({data})=>{if(active&&data.session)void fetch('/api/exchange/push',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`}}).catch(()=>{});}).catch(()=>{});return()=>{active=false;};},[user?.id]);
 const {clubId=''}=useParams();const [params,setParams]=useSearchParams();
 const unreadMessages=useUnreadCount(user?.id,'exchange',clubId);
 const [settledClub,setSettledClub]=useState('');
 const [club,setClub]=useState('Dein Verein'),[items,setItems]=useState<Offer[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const [search,setSearch]=useState(''),[filters,setFilters]=useState<ExchangeFilters>({...EMPTY_EXCHANGE_FILTERS}),[sort,setSort]=useState<CatalogSort>('newest'),[filterOpen,setFilterOpen]=useState(false);
 const appReturn=safeMarketAppReturn(params.get('returnTo'));
 const returnQuery={returnTo:appReturn};
 const view=params.get('view')||'start';const navigate=useNavigate();const marks=useSavedListings(user?.id);const wish=useSavedOffers(user?.id,clubId,marks.ids,view==='saved');const selected=[...items,...wish.items].find(i=>i.id===params.get('listing'));
 const publicPath=`/marktplatz/${encodeURIComponent(clubId)}`;
 const memberPath=`${publicPath}?view=member&club=${encodeURIComponent(clubId)}&returnTo=${encodeURIComponent(appReturn)}`;
 const startPath=`${publicPath}?view=start&returnTo=${encodeURIComponent(appReturn)}`;
 const savedPath=`${publicPath}?view=saved&returnTo=${encodeURIComponent(appReturn)}`;
 const login=(next=startPath)=>{const target=next==='/app/profile'?startPath:next;return user?target:marketAuthPath('login',new URLSearchParams({next:target,context:'vereinsmarkt',marketClub:clubId}).toString());};
 const catalog=items.map(i=>({...i,owner_id:'',team_label:''}));
 const shown=selectExchangeItems(catalog,'all','',filters,search,sort);
 useEffect(()=>{if(!isStagingApp()){setLoading(false);return;}let active=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);setLoading(true);setError('');void(async()=>{
   const r=await fetch(`/api/exchange/public?club=${encodeURIComponent(clubId)}`,{cache:'no-store',signal:controller.signal});const body=await r.json();if(!r.ok)throw Error(body.error||'Laden fehlgeschlagen');
   if(active){setClub(body.club.name);setItems(body.items);}
 })().catch(e=>{if(active)setError(e.name==='AbortError'?'Die Verbindung dauert zu lange. Bitte erneut versuchen.':e.message);}).finally(()=>{clearTimeout(timeout);if(active){setSettledClub(clubId);setLoading(false);}});return()=>{active=false;clearTimeout(timeout);controller.abort();};},[clubId,retry,view==='member']);
 const go=(next:string)=>setParams({...returnQuery,view:next});
 const activeNav=view==='member'?(params.get('mode')==='mine'?'mine':params.get('mode')==='requests'?'nachrichten':params.get('mode')==='create'?'inserieren':'start'):view==='saved'?'saved':view==='start'||view==='suchen'?'start':'';
 const price=(i:Offer)=>i.offer==='Verkaufen'?Number(i.price).toLocaleString('de-AT',{style:'currency',currency:'EUR'}):i.offer;
 const saveButton=(i:Offer)=><SaveListingButton saved={marks.saved.has(i.id)} busy={marks.loading||marks.pending.includes(i.id)} onClick={()=>{if(user)void marks.toggle(i.id);else navigate(login(savedPath));}}/>;
 const card=(i:Offer)=><div className="market-save-card" key={i.id}><button className="exchange-card" onClick={()=>{if(i.internal)navigate(memberPath+'&listing='+i.id);else setParams({...returnQuery,view:view==='saved'?'saved':'suchen',listing:i.id});}}><div className="exchange-card-image">{i.photos[0]?<img src={i.photos[0]} alt={i.title} loading="lazy"/>:<Shirt size={40}/>}<span>{i.status}</span></div><div className="exchange-card-copy"><h3>{i.title}</h3><p>Größe {i.size} · {i.condition}</p><strong>{price(i)}</strong>{i.internal&&<small>Vereinsintern</small>}</div></button>{saveButton(i)}</div>;
 if(isStagingApp()&&(loading||authLoading||settledClub!==clubId))return <MarketSplash/>;
 return <div className="public-exchange"><header className="public-market-header"><img src="/vereinsmarkt/icon-180.png" width="44" height="44" alt="" style={{borderRadius:10}}/><div style={{flex:1,minWidth:0}}><strong>{club}</strong><small>Vereinsmarkt</small></div><MarketThemeToggle/>{user&&<Link className="public-market-app-switch" to={appReturn} aria-label="Zur SpielzeitApp wechseln" title="SpielzeitApp"><img src="/apple-touch-icon.png" width="28" height="28" alt=""/></Link>}{user?<button className="public-market-account" aria-label="Profil" title="Profil" aria-current={view==='profil'?'page':undefined} onClick={()=>go('profil')}><User size={18}/></button>:<Link to={login()}>Anmelden</Link>}</header><main className="exchange">{isStagingApp()&&params.get('layout')==='1'&&<LayoutDiagnostics initiallyOpen/>}{marks.error&&<p role="alert" className="exchange-alert">{marks.error}</p>}
 {!isStagingApp()?<p>Der öffentliche Marktplatz wird in TEST vorbereitet.</p>:view==='member'?<React.Suspense fallback={<MarketSplash/>}>{user?<MemberMarket embedded embeddedClubId={clubId}/>:<section className="public-market-panel"><h1>Dein Vereinsmarkt</h1><p>Bitte melde dich für eigene Inserate und private Anfragen an.</p><Link className="public-market-cta" to={login(publicPath+'?'+params.toString())}>Anmelden</Link></section>}</React.Suspense>:loading?<p role="status">Angebote werden geladen…</p>:error?<div role="alert" className="exchange-alert">{error}<button onClick={()=>setRetry(n=>n+1)}>Erneut laden</button></div>:selected?<>
  <ExchangePhotoGallery key={selected.id} photos={selected.photos} title={selected.title} actions={<ListingPhotoActions onBack={()=>go(view==='saved'?'saved':'suchen')} save={saveButton(selected)} shareUrl={`${publicPath}?view=suchen&listing=${selected.id}`}/>}/><div className="exchange-item-head"><h3>{selected.title}</h3><strong>{price(selected)}</strong></div><dl className="listing-facts"><div><dt>Größe</dt><dd>{selected.size}</dd></div><div><dt>Zustand</dt><dd>{selected.condition}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div></dl>{selected.description&&<section className="listing-description"><h2>Beschreibung</h2><p className="exchange-description">{selected.description}</p></section>}<p className="listing-club">{club} · Vereinsmarkt</p><Link className="public-market-cta" to={login(memberPath+`&listing=${selected.id}`)}><MessageCircle size={20}/>Nachricht senden</Link><p className="public-market-note"><a href={`/vereinsmarkt/hilfe.html?club=${clubId}`}>Inhalt melden</a></p><p className="public-market-note"><LockKeyhole size={15}/>Private Anfrage nach Anmeldung. Vereinszuordnung erforderlich.</p>
 </>:view==='saved'?<section><button className="exchange-back" onClick={()=>go('profil')}><ArrowLeft size={18}/>Zum Profil</button><h1>Meine Merkliste</h1><p>Deine gemerkten Angebote in diesem Verein.</p>{!user?<Link className="public-market-cta" to={login(savedPath)}>Für die Merkliste anmelden</Link>:marks.loading||wish.loading?<p role="status">Merkliste wird geladen…</p>:wish.error?<p role="alert">{wish.error}</p>:wish.items.length?<div className="exchange-grid">{wish.items.map(card)}</div>:<div className="exchange-empty"><Heart/><h3>Noch nichts gemerkt</h3><p>Tippe bei einem Inserat auf das Herz. Nicht mehr verfügbare Angebote werden ausgeblendet.</p><button onClick={()=>go('start')}>Angebote entdecken</button></div>}</section>:view==='profil'?<section className="public-market-profile" aria-label="Dein Vereinsmarkt">
 <div className="public-market-profile-hero"><div className="public-market-profile-symbol"><User size={46}/></div><p className="public-market-eyebrow">Dein Verein. Dein Konto.</p><h1>Dein Vereinsmarkt</h1><p>Inserate verwalten und private Anfragen austauschen – mit deinem Vereinskonto.</p>{user?<><p>Du bist angemeldet. Deine Inserate und Anfragen findest du hier.</p><button className="public-market-register" onClick={()=>void signOut().catch(()=>setError('Abmeldung fehlgeschlagen.'))}>Abmelden</button></>:<><Link className="public-market-cta" to={login('/app/profile')}>Anmelden</Link><Link className="public-market-register" to={marketAuthPath('register',new URLSearchParams({next:startPath,context:'vereinsmarkt',marketClub:clubId}).toString())}>Noch kein Konto? Registrieren</Link></>}<small>Ein Konto für Vereinsmarkt und SpielzeitApp. Noch keines? Registriere dich – eine App-Installation ist nicht nötig. Zum Inserieren und Anfragen brauchst du eine Vereinszuordnung.</small></div>
 <div className="public-market-profile-links"><Link to={login(savedPath)}>Meine Merkliste <Heart size={20}/></Link><Link to={login(memberPath+'&mode=mine')}>Meine Inserate <Shirt size={20}/></Link><Link to={login(memberPath+'&mode=requests')}>Meine Anfragen <MessageCircle size={20}/></Link><a href={`/vereinsmarkt/nutzungsbedingungen.html?club=${clubId}`}>Nutzungsbedingungen</a><a href={`/vereinsmarkt/datenschutz.html?club=${clubId}`}>Datenschutz</a><a href={`/vereinsmarkt/impressum.html?club=${clubId}`}>Impressum</a><a href={`/vereinsmarkt/hilfe.html?club=${clubId}`}>Hilfe &amp; Kontakt</a></div>
 </section>:view==='shop'?<section className="public-market-panel"><Shirt size={32}/><h1>Lieber neu?</h1><p>Hier kann dein Verein später neue Vereinskleidung oder den Shop seines Ausrüsters anbieten.</p><strong>Noch kein Shop freigeschaltet.</strong><button onClick={()=>go('start')}>Zum Vereinsmarkt</button></section>:view==='app'?<section className="public-market-panel"><h1>Mehr Verein. Eine App.</h1><p>Termine, Mannschaften und Vereinsleben an einem Ort.</p><a className="public-market-cta" href="https://spielzeitapp.at/landingpage">SpielzeitApp kennenlernen</a></section>:<>
 {view==='start'&&<><p className="public-market-eyebrow">Alle Teams. Ein Verein.</p><h1>Vereinsmarkt</h1><p className="public-market-intro">Fußballsachen weitergeben. Im Verein verbunden.</p></>}
 <div className="exchange-search"><Search size={20}/><input aria-label="Öffentliche Angebote suchen" placeholder="Was suchst du?" type="search" value={search} onChange={e=>{setSearch(e.target.value);}}/></div>
 <div className="public-market-categories">{[{label:'Alle Artikel',Icon:Shirt,category:''},{label:'Schuhe',Icon:MarketShoesIcon,category:'Schuhe'},{label:'Zubehör',Icon:ShinGuardIcon,category:'Zubehör'},{label:'Neu im Shop',Icon:ShoppingBag,category:'shop'}].map(({label,Icon,category})=><button key={label} onClick={()=>{if(category==='shop')go('shop');else{setFilters({...EMPTY_EXCHANGE_FILTERS,category});go('suchen');}}}><Icon size={23}/>{label}</button>)}</div>
 <div className="public-market-tools"><button onClick={()=>setFilterOpen(true)}><SlidersHorizontal size={18}/>Filter {Object.values(filters).filter(Boolean).length||''}</button><select aria-label="Öffentliche Angebote sortieren" value={sort} onChange={e=>setSort(e.target.value as CatalogSort)}><option value="newest">Neueste zuerst</option><option value="price-asc">Preis aufsteigend</option><option value="price-desc">Preis absteigend</option></select></div>
 <div className="exchange-result-row"><h2>{view==='start'?'Frisch eingestellt':`${shown.length} ${shown.length===1?'Angebot':'Angebote'}`}</h2>{view==='start'&&<button className="exchange-back" onClick={()=>go('suchen')}>Alle ansehen</button>}</div>
 {shown.length?<div className={view==='start'?'public-market-rail':'exchange-grid'}>{(view==='start'?shown.slice(0,8):shown).map(card)}</div>:<div className="exchange-empty"><Shirt/><h3>{items.length?'Keine passenden Angebote':'Zu klein? Gib es weiter.'}</h3><p>{items.length?'Ändere deine Suche oder setze die Filter zurück.':'Hier finden Trainingssachen ein neues Team. Stelle das erste öffentliche Inserat ein.'}</p></div>}
 {view==='start'&&<><Link className="public-market-banner" to={login(memberPath+'&mode=create')}><Plus size={30}/><span><strong>Zu klein? Gib es weiter.</strong><small>Inserat mit Foto erstellen – im Verein.</small></span></Link><button className="public-market-banner" onClick={()=>go('shop')}><Shirt size={28}/><span><strong>Lieber neu?</strong><small>Vereinsshop · für später vorbereitet</small></span></button></>}
 </>}
 <p className="public-market-note">Stöbern ohne Anmeldung · Inserieren und private Anfragen mit Vereinskonto</p><footer className="public-market-footer">{isStagingApp()&&<button onClick={()=>{setParams(previous=>{const next=new URLSearchParams(previous);next.set('layout','1');return next;});document.querySelector('main.exchange')?.scrollTo({top:0});}}>Anzeige prüfen</button>}<button onClick={()=>go('app')}>powered by <span className="font-semibold">SpielzeitApp</span></button>{view!=='profil'&&<div className="public-market-legal-links">{[['nutzungsbedingungen','Nutzungsbedingungen'],['datenschutz','Datenschutz'],['impressum','Impressum'],['hilfe','Hilfe & Kontakt']].map(([path,label])=><a key={path} href={`/vereinsmarkt/${path}.html?club=${clubId}`}>{label}</a>)}</div>}</footer>
 </main><nav className="public-market-nav" aria-label="Marktplatz-Navigation">{[
 {id:'start',label:'Start',Icon:Home,to:startPath},
 {id:'saved',label:'Merkliste',Icon:Heart,to:login(savedPath)},
 {id:'inserieren',label:'Inserieren',Icon:Plus,to:login(memberPath+'&mode=create')},
 {id:'mine',label:'Meine Inserate',Icon:ClipboardList,to:login(memberPath+'&mode=mine')},
 {id:'nachrichten',label:'Nachrichten',Icon:MessageCircle,to:login(memberPath+'&mode=requests')}
 ].map(({id,label,Icon,to})=><Link key={id} to={to} aria-current={activeNav===id?'page':undefined}><Icon size={23}/>{label}{id==='nachrichten'&&unreadMessages>0&&<span className="market-unread-badge" aria-label={`${unreadMessages} ungelesene Nachrichten`}>{unreadMessages>99?'99+':unreadMessages}</span>}</Link>)}</nav>
 {filterOpen&&<ExchangeFilterSheet items={catalog} value={filters} view="all" userId="" search={search} onClose={()=>setFilterOpen(false)} onApply={v=>{setFilters(v);setFilterOpen(false);go('suchen');}}/>}
 </div>;
}
