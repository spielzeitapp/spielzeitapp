import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ShoppingBag, Package, Check, Clock, RefreshCw, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabaseClient';
import { marketAuthPath } from './marketAuth';
import './clubShop.css';
import { ShopTrialCatalog } from './ShopTrialCatalog';
import { JakoShopPreview, ShopCartHeader } from './JakoShopPreview';
import { GOELSENTAL_TEST_SHOP_ID, jakoShopCatalog, type JakoShopArticle } from './jakoShopCatalog';
import { isStagingApp } from '../../lib/appEnvironment';

type Product={id:string;name:string;price_cents:number;sizes:string[];image_url:string;personalizable:boolean;active:boolean};
type Item={productId:string;size:string;name:string;number:string;quantity:number;title?:string;price_cents?:number};
type Round={id:string;title:string;deadline:string;status:string;version:number;recipient:string;iban:string;invoice_url:string;invoice_paid_at:string|null};
type Order={id:string;round_id:string;owner_label:string;owner_id:string;items:Item[];total_cents:number;paid_at:string|null;submitted_at:string|null;collected_at:string|null;cancelled_at:string|null};
type Settings={enabled:boolean;recipient?:string;iban?:string;dealer_email?:string;manager_email?:string};
type State={staff:boolean;admin:boolean;dealer:boolean;settings:Settings;products:Product[];rounds:Round[];orders:Order[]};
const testRoundId='d742211b-e25c-4c5f-9caa-bedc2a5bf619';
async function runTestShopAction(action:string,id?:string) {
 const {data:{session}}=await supabase.auth.getSession();
 if(!session) throw new Error('Bitte erneut anmelden.');
 const response=await fetch('/api/shop/test-order',{
  method:'POST',
  headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
  body:JSON.stringify({action,id}),
 });
 const result=await response.json().catch(()=>null);
 if(!response.ok) throw new Error(result?.error||'Der Testschritt konnte nicht ausgeführt werden.');
 return result?.sent!==false;
}

const empty:State={staff:false,admin:false,dealer:false,settings:{enabled:false},products:[],rounds:[],orders:[]};
export const shopMoney=(c:number)=>new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format(c/100);
export const shopStatus=(o:Order,r?:Round)=>o.cancelled_at?'Storniert':o.collected_at?'Ausgegeben':o.submitted_at?(['ready','closed'].includes(r?.status||'')?'Abholbereit':r?.status==='processing'?'In Bearbeitung':'Beim Händler'):o.paid_at?'Bezahlt':r&&r.status!=='open'?'Nicht übernommen':'Zahlung offen';
const roundStatus:Record<string,string>={open:'Bestellungen offen',released:'Beim Händler',confirmed:'Auftrag bestätigt',processing:'In Bearbeitung',ready:'Abholbereit',closed:'Abgeschlossen'};
const date=(iso:string)=>new Date(iso).toLocaleString('de-AT',{timeZone:'Europe/Vienna',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
// Prefix spreadsheet formula characters even in an explicitly quoted CSV field.
export const csvCell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
export function shopCsv(orders:Order[]){
 const rows=[['Bestellnummer','Familie','Artikel','Größe','Menge','Name','Nummer']];
 orders.filter(o=>o.submitted_at&&!o.cancelled_at).forEach(o=>o.items.forEach(i=>rows.push([o.id,o.owner_label,i.title||'',i.size,String(i.quantity),i.name,i.number])));
 return '\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
}
function exportOrders(orders:Order[],round:Round){
 const url=URL.createObjectURL(new Blob([shopCsv(orders)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`Sammelbestellung-${round.id}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function ClubShop({clubId,clubName,onBack,embedded=false,manageOnly=false,cartHeader}:{clubId:string;clubName:string;onBack:()=>void;embedded?:boolean;manageOnly?:boolean;cartHeader?:HTMLElement|null}){
 const {user}=useAuth();const [state,setState]=useState<State>(empty),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [review,setReview]=useState(false);
 const [search,setSearch]=useState('');
 const isGoelsentalTestShop=isStagingApp()&&clubId===GOELSENTAL_TEST_SHOP_ID;
 const [adminTab,setAdminTab]=useState('articles'),[showEditor,setShowEditor]=useState(false);
 const cartRef=useRef<HTMLElement>(null);
 const editorRef=useRef<HTMLFormElement>(null);
 function openEditor(){setShowEditor(true);requestAnimationFrame(()=>editorRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));}
 const [view,setView]=useState(manageOnly?'manage':'shop'),[selected,setSelected]=useState<Product|null>(null),[size,setSize]=useState(''),[name,setName]=useState(''),[number,setNumber]=useState(''),[cart,setCart]=useState<Item[]>([]),[roundId,setRoundId]=useState('');
 const [settings,setSettings]=useState<Settings>({enabled:false,recipient:'',iban:'',dealer_email:'',manager_email:''});
 const [product,setProduct]=useState({id:'',active:true,name:'',price:'',sizes:'128, 140, 152, 164, S, M, L, XL',image_url:'',personalizable:false});
 function prepareJakoArticle(article:JakoShopArticle){
  setProduct({id:'',active:false,name:article.name,price:'',sizes:article.sizes.join(', '),image_url:new URL(article.image,window.location.origin).href,personalizable:false});
  openEditor();
 }
 const [round,setRound]=useState({title:'',deadline:''}),[invoice,setInvoice]=useState('');
 const orderKey=useRef<string|null>(null);const generation=useRef(0);const mounted=useRef(true);
 async function call(action='state',data:unknown={}){
  const {data:result,error}=await supabase.rpc('club_shop',{p_club:clubId,p_action:action,p_data:data});if(error)throw new Error(error.message);return result as State;
 }
 async function reload(){const token=++generation.current;setLoading(true);try{const s=await call();if(!mounted.current||token!==generation.current)return;setState(s);setSettings({...s.settings,enabled:!!s.settings?.enabled});setError('');}catch(e){if(mounted.current&&token===generation.current)setError((e as Error).message);}finally{if(mounted.current&&token===generation.current)setLoading(false);}}
 useEffect(()=>{mounted.current=true;setState(empty);setCart([]);setSelected(null);setView(manageOnly?'manage':'shop');setRoundId('');orderKey.current=null;if(user)void reload();else setLoading(false);return()=>{mounted.current=false;generation.current++;};},[user?.id,clubId,manageOnly]);
 async function action(kind:string,data:unknown){if(busy)return;setBusy(true);setError('');setNotice('');try{await call(kind,data);await reload();setNotice('Gespeichert.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const rounds=state.rounds||[],products=state.products||[],orders=state.orders||[];
 const activeRound=rounds.find(r=>r.id===roundId)||rounds.find(r=>r.status==='open'&&new Date(r.deadline)>new Date())||rounds[0];
 const testRound=isGoelsentalTestShop&&activeRound?.id===testRoundId;
 const roundOrders=orders.filter(o=>o.round_id===activeRound?.id),paid=roundOrders.filter(o=>o.paid_at&&!o.cancelled_at),submitted=roundOrders.filter(o=>o.submitted_at&&!o.cancelled_at);
 const total=cart.reduce((n,i)=>n+(products.find(p=>p.id===i.productId)?.price_cents||0)*i.quantity,0);
 const testCustomer=user?.email?.toLowerCase()==='office@jb-harmonikas.at';
 const canOrder=(!testRound||testCustomer)&&state.settings?.enabled&&activeRound?.status==='open'&&new Date(activeRound.deadline)>new Date();
 const changeCart=(next:Item[])=>{orderKey.current=null;setReview(false);setCart(next);};
 async function checkout(){
  if(!canOrder||!cart.length||busy)return;
  setBusy(true);
  setError('');
  try{
   orderKey.current ||= crypto.randomUUID();
   const id=orderKey.current;
   await call('order',{id,round_id:activeRound.id,items:cart,expected_total:total});
   setCart([]);
   setReview(false);
   orderKey.current=null;
   setView('orders');
   await reload();
   if(testRound){
    const sent=await runTestShopAction('order-mail',id).catch(()=>false);
    setNotice(sent?'Testbestellung erfasst. Die Bestellmails wurden verarbeitet.':'Testbestellung erfasst. Mailversand fehlgeschlagen. Du kannst ihn bei der Bestellung erneut anstoßen.');
   }else setNotice('Bestellung erfasst. Bitte überweise den Betrag bis zum Bestellschluss.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function testAction(kind:string,id?:string){
  if(busy)return;
  setBusy(true);
  setError('');
  setNotice('');
  try{
   const sent=await runTestShopAction(kind,id);
   if(kind==='close-intake')await reload();
   setNotice(kind==='close-intake'?'Test-Bestellschluss gesetzt.':sent?'Bestellmail verarbeitet.':'Mailversand fehlgeschlagen. Bitte erneut versuchen.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function releaseTestRound(){
  if(busy||!activeRound)return;
  setBusy(true);
  setError('');
  setNotice('');
  try{
   await call('release',{id:activeRound.id,version:activeRound.version});
   await reload();
   const sent=await runTestShopAction('release-mail').catch(()=>false);
   setNotice(sent?'Sammelauftrag freigegeben. Händlermail verarbeitet.':'Sammelauftrag freigegeben. Händlermail konnte nicht versendet werden.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const mutateRound=(kind:string,extra={})=>activeRound&&action(kind,{id:activeRound.id,version:activeRound.version,...extra});
 const btn=(label:string,fn:()=>void,disabled=false)=><button type="button" className="club-shop-button" disabled={busy||disabled} onClick={fn}>{label}</button>;
 const roundPicker=<label>Bestellrunde<select value={activeRound?.id||''} onChange={e=>setRoundId(e.target.value)}>{rounds.map(r=><option key={r.id} value={r.id}>{r.title} · {roundStatus[r.status]}</option>)}</select></label>;
 function orderCard(o:Order,staff=false){const r=rounds.find(r=>r.id===o.round_id);const demo=isGoelsentalTestShop&&r?.id===testRoundId;return <article className="club-shop-panel" key={o.id}>
  <div className="club-shop-row"><strong>{staff?o.owner_label:r?.title}</strong><span className={`club-shop-badge ${o.paid_at?'is-paid':''}`}>{shopStatus(o,r)}</span></div>
  <small>Bestellnummer: {o.id}</small>{o.items.map((i,n)=><p key={n}>{i.quantity} × {i.title} · {i.size}{i.name&&` · ${i.name}`}{i.number&&` · Nr. ${i.number}`}</p>)}<strong>{shopMoney(o.total_cents)}</strong>
  {!demo&&!o.paid_at&&!o.cancelled_at&&r?.status==='open'&&new Date(r.deadline)>new Date()&&<><p>Vorauskassa bis {r&&date(r.deadline)}</p><dl><dt>Empfänger</dt><dd>{r?.recipient}</dd><dt>IBAN</dt><dd>{r?.iban}</dd><dt>Zahlungsreferenz</dt><dd>SHOP-{o.id}</dd></dl>{btn('Zahlungsdaten kopieren',()=>{void navigator.clipboard.writeText(`${r?.recipient}\n${r?.iban}\n${shopMoney(o.total_cents)}\nSHOP-${o.id}`).then(()=>setNotice('Zahlungsdaten kopiert.')).catch(()=>setError('Kopieren nicht möglich. Bitte Zahlungsdaten oben verwenden.'));})}<p className="club-shop-muted">Erst der Verein bestätigt den tatsächlichen Zahlungseingang. Nur bezahlte Bestellungen werden gesammelt freigegeben.</p>{r?.status==='open'&&btn('Unbezahlte Bestellung stornieren',()=>{if(window.confirm('Diese unbezahlte Bestellung stornieren?'))void action('cancel',{id:o.id});})}</>}
  {!demo&&!o.paid_at&&!o.cancelled_at&&r&&(r.status!=='open'||new Date(r.deadline)<=new Date())&&<p>Bestellschluss erreicht. Diese Bestellung wurde noch nicht übernommen. Bei bereits überwiesenem Geld bitte den Shopverantwortlichen kontaktieren.</p>}
  {demo&&<p>TEST · Vorauskassa wird simuliert. Bitte nichts überweisen. Verwendungszweck SHOP-{o.id}</p>}
  {demo&&!staff&&testCustomer&&btn('Versand der Bestellmail prüfen',()=>void testAction('order-mail',o.id))}
  {staff&&!o.cancelled_at&&!o.paid_at&&r?.status==='open'&&btn(demo?'Testzahlung bestätigen':'Zahlungseingang bestätigen',()=>{if(window.confirm(demo?'Zahlungseingang für diese Testbestellung simulieren?':`${shopMoney(o.total_cents)} von ${o.owner_label} am Vereinskonto eingegangen?`))void action('paid',{id:o.id});})}
  {staff&&o.submitted_at&&!o.collected_at&&r?.status==='ready'&&btn('Ausgabe bestätigen',()=>void action('collect',{id:o.id}))}
 </article>;}
 if(manageOnly&&!loading&&!state.staff)return <section className="club-shop"><h1>Artikelverwaltung</h1><p role="alert">{error||'Nur Vereinsadmins und zugeordnete Shopverantwortliche können hier Artikel verwalten.'}</p><button className="club-shop-button" onClick={onBack}>Zur Vereinszentrale</button></section>;
 return <section className={`club-shop${embedded?' club-shop--embedded':''}${manageOnly?' club-shop--manager':''}`} aria-label="Vereinsshop">
  {!manageOnly&&cartHeader&&user&&isGoelsentalTestShop&&products.some(p=>p.active)&&<ShopCartHeader target={cartHeader}
   count={cart.reduce((count,item)=>count+item.quantity,0)} onOpen={()=>{
    setView('shop');
    setSelected(null);
    requestAnimationFrame(()=>cartRef.current?.scrollIntoView({block:'start'}));
   }}/>}
  {!manageOnly&&<><header className={`club-shop-header${isGoelsentalTestShop?' club-shop-header--compact':''}`}><button aria-label="Zurück zum Verein" onClick={onBack}><ArrowLeft/></button>{isGoelsentalTestShop?<h1>Vereinsshop</h1>:<span>{embedded?'Zurück zum Vereinsmarkt':clubName}{!embedded&&<small>Vereinsshop</small>}</span>}{user&&<button aria-label="Shop aktualisieren" disabled={busy||loading} onClick={()=>void reload()}><RefreshCw size={20}/></button>}</header>
  {!isGoelsentalTestShop&&<><div className="club-shop-intro"><p className="club-shop-eyebrow">{clubName} · Unsere Kollektion</p><h1>Vereinsshop</h1><p className="club-shop-muted">Unser Verein. Unser Look.</p></div>
  <div className="club-shop-hero"><div className="club-shop-hero-icon"><ShoppingBag size={30}/></div><div><strong>Gemeinsam bestellen.</strong><p>Neue Vereinskleidung und Fanartikel – gesammelt für unseren Verein.</p><span>Auswählen · Vorauszahlen · Abholen</span></div></div></>}</>}
  {isStagingApp()&&!loading&&(!user||view==='shop')&&!products.some(p=>p.active)&&(isGoelsentalTestShop?<JakoShopPreview cartHeader={cartHeader}/>:<ShopTrialCatalog/>)}
  {!user?<article className="club-shop-panel"><ShoppingBag/><h2>Mit deinem Vereinskonto bestellen</h2><p>Bestellungen, Vorauskassa und Abholung bleiben an einem Ort.</p><a className="club-shop-button" href={marketAuthPath('login',new URLSearchParams({next:window.location.pathname+window.location.search,context:'vereinsmarkt',marketClub:clubId}).toString())}>Anmelden</a></article>:<>
  {manageOnly?<nav className="club-shop-tabs manager-shop-tabs" aria-label="Shopverwaltung">{[['articles','Artikel'],['orders','Bestellungen'],['settings','Einstellungen']].map(([id,label])=><button key={id} aria-current={adminTab===id?'page':undefined} onClick={()=>setAdminTab(id)}>{label}</button>)}<button className="manager-shop-refresh" aria-label="Shop aktualisieren" disabled={busy||loading} onClick={()=>void reload()}><RefreshCw size={18}/></button></nav>:<nav className="club-shop-tabs" aria-label="Vereinsshop Bereiche">{[...(!manageOnly?[['shop','Shop'],['orders','Meine Bestellungen']]:[]),...(state.staff?[['manage','Verwaltung']]:[]),...(state.dealer?[['dealer','Händlerportal']]:[])].map(([id,label])=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>{setView(id);setSelected(null);}}>{label}</button>)}</nav>}
  {error&&<p role="alert" className="club-shop-error">{error}</p>}{notice&&<p role="status" className="club-shop-notice"><Check size={18}/>{notice}</p>}
  {loading?<p role="status">Shop wird geladen …</p>:<>
  {view==='shop'&&<>
   {products.some(p=>p.active)&&<label className="club-shop-search"><Search size={20}/><input type="search" aria-label="Vereinsartikel suchen" placeholder="Was suchst du im Vereinsshop?" value={search} onChange={e=>setSearch(e.target.value)}/></label>}
   {!state.settings?.enabled&&<div className="club-shop-panel"><Package/><h2>Noch nicht freigeschaltet</h2><p>Der Verein richtet Sortiment, Händler und Vorauskassa ein. Es werden noch keine Bestellungen angenommen.</p></div>}
   {testRound&&!testCustomer&&<p className="club-shop-muted">Für eine Testbestellung mit dem Konto JB Harmonikas anmelden.</p>}
   {activeRound?<article className="club-shop-round">{roundPicker}<p><Clock size={16}/> Bestellschluss: {date(activeRound.deadline)}</p><strong>{roundStatus[activeRound.status]}</strong></article>:<p>Noch keine Bestellrunde eröffnet.</p>}
   {search&&products.some(p=>p.active)&&!products.some(p=>p.active&&p.name.toLocaleLowerCase('de-AT').includes(search.toLocaleLowerCase('de-AT')))&&<p className="club-shop-muted">Keine passenden Artikel. Versuche einen anderen Suchbegriff.</p>}
   {selected?<article className="club-shop-panel">{btn('Zur Artikelübersicht',()=>setSelected(null))}<h2>{selected.name}</h2>{selected.image_url&&<img className="club-shop-photo" src={selected.image_url} alt={selected.name}/>}<strong>{shopMoney(selected.price_cents)}</strong><label>Größe<select value={size} onChange={e=>setSize(e.target.value)}><option value="">Bitte wählen</option>{selected.sizes.map(s=><option key={s}>{s}</option>)}</select></label>{selected.personalizable&&<div className="club-shop-fields"><label>Wunschname · optional<input maxLength={24} value={name} onChange={e=>setName(e.target.value)}/></label><label>Nummer · optional<input inputMode="numeric" maxLength={2} value={number} onChange={e=>setNumber(e.target.value.replace(/\D/g,''))}/></label></div>}{btn('In den Warenkorb',()=>{changeCart([...cart,{productId:selected.id,size,name:name.trim(),number,quantity:1}]);setSelected(null);},!size||!canOrder||cart.length>=50)}</article>:<div className="club-shop-grid">{products.filter(p=>p.active&&p.name.toLocaleLowerCase('de-AT').includes(search.toLocaleLowerCase('de-AT'))).map(p=><button className="club-shop-product" key={p.id} onClick={()=>{setSelected(p);setSize(p.sizes.length===1?p.sizes[0]:'');setName('');setNumber('');}}>{p.image_url?<img src={p.image_url} alt=""/>:<div className="club-shop-placeholder"><ShoppingBag size={36}/></div>}<strong>{p.name}</strong><span>{shopMoney(p.price_cents)}</span><small>{p.personalizable?'Name & Nummer möglich':'Vereinskollektion'}</small><span className="club-shop-product-link">Artikel ansehen <ChevronRight size={16}/></span></button>)}</div>}
   {cart.length>0&&<article ref={cartRef} className="club-shop-panel"><h2>{testRound&&review?'Testbestellung prüfen':'Dein Warenkorb'}</h2>{cart.map((i,n)=><div className="club-shop-cart-row" key={n}><span>{products.find(p=>p.id===i.productId)?.name} · {i.size}<small>{[i.name,i.number&&`Nr. ${i.number}`].filter(Boolean).join(' · ')}</small></span><input disabled={busy} aria-label={`Menge Artikel ${n+1}`} type="number" min={1} max={99} value={i.quantity} onChange={e=>changeCart(cart.map((row,k)=>k===n?{...row,quantity:Math.min(99,Math.max(1,Number(e.target.value)||1))}:row))}/><button disabled={busy} aria-label={`Artikel ${n+1} entfernen`} onClick={()=>changeCart(cart.filter((_,k)=>k!==n))}>Entfernen</button></div>)}<div className="club-shop-row"><strong>Gesamt</strong><strong>{shopMoney(total)}</strong></div><p>Bestellung nur gegen Vorauskassa an den Verein. Aufnahme in die Sammelbestellung erst nach bestätigtem Zahlungseingang. Preise verstehen sich inklusive der angebotenen Aufdrucke.</p>{testRound?<><p>TEST · Beispielpreise und simulierte Vorauskassa. Bitte nichts überweisen.</p>{review&&<h3>Vorauskassa und Abholung beim Verein</h3>}<button type="button" className="club-shop-button club-shop-test-primary" disabled={busy||!canOrder} onClick={()=>review?void checkout():setReview(true)}>{review?'Testbestellung abschicken':'Weiter zur Bestellübersicht'}</button></>:btn('Zahlungspflichtig bestellen · Vorauskassa',()=>void checkout(),!canOrder)}</article>}
  </>}
  {view==='orders'&&<>{orders.filter(o=>o.owner_id===user.id).length?orders.filter(o=>o.owner_id===user.id).map(o=>orderCard(o)):<article className="club-shop-panel"><ShoppingBag/><h2>Noch keine Bestellungen</h2><p>Deine Bestellungen und Zahlungsdaten erscheinen hier.</p></article>}</>}
  {(view==='manage'&&state.staff||view==='dealer'&&state.dealer)&&<>
   {(!manageOnly||adminTab==='orders')&&<><h2>{view==='dealer'?'Händlerportal':'Bestellverwaltung'}</h2>{roundPicker}{activeRound&&<>
   <article className="club-shop-round"><h3>{activeRound.title}</h3><p>Bestellschluss {date(activeRound.deadline)}</p><strong>{roundStatus[activeRound.status]}</strong></article>
   {view==='manage'?<><div className="club-shop-stats"><div><strong>{paid.length}</strong>bezahlt</div><div><strong>{roundOrders.filter(o=>!o.paid_at&&!o.cancelled_at).length}</strong>offen</div><div><strong>{shopMoney(paid.reduce((n,o)=>n+o.total_cents,0))}</strong>eingegangen</div></div>{activeRound.status==='open'&&<article className="club-shop-panel"><h3>Sammelbestellung freigeben</h3>{testRound&&new Date(activeRound.deadline)>new Date()&&btn('Test-Bestellschluss setzen',()=>void testAction('close-intake'),!paid.length)}<p>Nur bezahlte Bestellungen werden übernommen. Offene Zahlungen bleiben zurück. Freigabe nach dem Bestellschluss.</p>{btn(`${paid.length} bezahlte Bestellungen freigeben`,()=>{if(window.confirm(testRound?'Test-Sammelauftrag freigeben?':'Sammelbestellung verbindlich an den Händler freigeben?')){if(testRound)void releaseTestRound();else void mutateRound('release');}},!paid.length||new Date(activeRound.deadline)>new Date())}</article>}{testRound&&activeRound.status!=='open'&&btn('Versand der Händlermail prüfen',()=>void testAction('release-mail'))}{roundOrders.map(o=>orderCard(o,true))}</>:<>
    <article className="club-shop-panel"><h3>Artikelübersicht</h3>{submitted.length?<><div className="club-shop-table-wrap"><table><thead><tr><th>Artikel</th><th>Größe</th><th>Menge</th></tr></thead><tbody>{Object.values(submitted.flatMap(o=>o.items).reduce((a,i)=>{const key=JSON.stringify([i.productId,i.size]);a[key] ||= {title:i.title||'',size:i.size,quantity:0};a[key].quantity+=i.quantity;return a;},{} as Record<string,{title:string;size:string;quantity:number}>)).map((i,n)=><tr key={n}><td>{i.title}</td><td>{i.size}</td><td>{i.quantity}</td></tr>)}</tbody></table></div>{btn('Größen- und Aufdruckliste herunterladen',()=>exportOrders(submitted,activeRound))}<p>CSV für Excel · eine Zeile je Artikel und Familie.</p></>:<p>Noch keine freigegebenen Bestellungen.</p>}</article>
    {activeRound.status==='released'&&<article className="club-shop-panel"><h3>Lieferbarkeit geprüft?</h3><p>Bei fehlenden Artikeln zuerst mit dem Shopverantwortlichen klären. Bestätigung gilt für den vollständigen Auftrag.</p>{btn('Vollständigen Auftrag bestätigen',()=>void mutateRound('confirm'))}</article>}
    {['confirmed','processing','ready'].includes(activeRound.status)&&<article className="club-shop-panel"><h3>Sammelrechnung</h3><label>Geschützter HTTPS-Link zur Rechnung<input type="url" placeholder="https://…" value={invoice} onChange={e=>setInvoice(e.target.value)}/></label>{btn('Rechnungslink hinterlegen',()=>void mutateRound('invoice',{url:invoice}),!/^https:\/\//.test(invoice))}<p>Eine Rechnung an den Verein. Keine Einzelrechnungen an Eltern.</p></article>}
    {activeRound.status==='confirmed'&&btn('In Bearbeitung setzen',()=>void mutateRound('processing'))}{['confirmed','processing'].includes(activeRound.status)&&btn('Abholbereit melden',()=>void mutateRound('ready'))}
   </>}
   {activeRound.invoice_url&&<article className="club-shop-panel"><h3>Händlerrechnung</h3><a href={activeRound.invoice_url} target="_blank" rel="noreferrer">Rechnung öffnen</a><p>{activeRound.invoice_paid_at?'Vom Verein bezahlt':'Überweisung durch den Kassier offen'}</p>{view==='manage'&&!activeRound.invoice_paid_at&&btn('Überweisung an Händler bestätigen',()=>{if(window.confirm('Sammelrechnung tatsächlich an den Händler überwiesen?'))void mutateRound('invoice_paid');})}</article>}
   {view==='manage'&&activeRound.status==='ready'&&btn('Bestellrunde abschließen',()=>void mutateRound('close'),submitted.some(o=>!o.collected_at))}
   </>}
   </>}
   {view==='manage'&&<>
    {(!manageOnly||adminTab==='orders')&&<form className="club-shop-panel" onSubmit={e=>{e.preventDefault();void action('round',{title:round.title,deadline:new Date(round.deadline).toISOString()});}}><h3>Neue Bestellrunde</h3><label>Bezeichnung<input required maxLength={100} placeholder="z. B. Dezember" value={round.title} onChange={e=>setRound({...round,title:e.target.value})}/></label><label>Bestellschluss · Ortszeit<input required type="datetime-local" value={round.deadline} onChange={e=>setRound({...round,deadline:e.target.value})}/></label><button disabled={busy}>Bestellrunde eröffnen</button></form>}
    {(!manageOnly||adminTab==='articles')&&<>
    {manageOnly&&<div className="manager-shop-section"><div><h2>Dein Sortiment</h2><p>{products.length} Artikel · {products.filter(p=>p.active).length} im Shop sichtbar</p></div><button className="club-shop-button" onClick={()=>{setProduct({id:'',active:true,name:'',price:'',sizes:'128, 140, 152, 164, S, M, L, XL',image_url:'',personalizable:false});openEditor();}}>+ Artikel hinzufügen</button></div>}
    {manageOnly&&isGoelsentalTestShop&&<details className="club-shop-panel manager-shop-help">
      <summary>JAKO-Artikelvorlagen</summary>
      <p>Foto und Größen werden übernommen. Ergänze den Vereinspreis und schalte den Artikel bei Bedarf sichtbar.</p>
      <div className="club-shop-template-list">{jakoShopCatalog.map(article=><button key={article.id} type="button" className="manager-shop-secondary" disabled={busy||products.some(p=>p.name===article.name||p.image_url.endsWith(article.image))} onClick={()=>prepareJakoArticle(article)}>{article.name}</button>)}</div>
    </details>}
    {(!manageOnly||showEditor)&&<form ref={editorRef} className="club-shop-panel manager-shop-editor" onSubmit={e=>{e.preventDefault();void action('product',{...(product.id?{id:product.id}:{}),name:product.name,price_cents:Math.round(Number(product.price)*100),active:product.active,sizes:product.sizes.split(',').map(s=>s.trim()).filter(Boolean),image_url:product.image_url,personalizable:product.personalizable});}}><h3>{product.id?'Artikel bearbeiten':'Artikel hinzufügen'}</h3><label>Artikelname<input required maxLength={100} value={product.name} onChange={e=>setProduct({...product,name:e.target.value})}/></label><label>Endpreis in Euro · inklusive Aufdruck<input required type="number" min="0.01" max="9999.99" step="0.01" value={product.price} onChange={e=>setProduct({...product,price:e.target.value})}/></label><label>Größen · durch Komma getrennt<input required value={product.sizes} onChange={e=>setProduct({...product,sizes:e.target.value})}/></label><label>Produktfoto · HTTPS-Link<input type="url" value={product.image_url} onChange={e=>setProduct({...product,image_url:e.target.value})}/></label><label className="club-shop-check"><input type="checkbox" checked={product.personalizable} onChange={e=>setProduct({...product,personalizable:e.target.checked})}/>Name und Nummer möglich</label><button disabled={busy}>Artikel speichern</button>{product.id&&<button type="button" disabled={busy} onClick={()=>setProduct({id:'',active:true,name:'',price:'',sizes:'128, 140, 152, 164, S, M, L, XL',image_url:'',personalizable:false})}>Neuen Artikel anlegen</button>}{manageOnly&&<button type="button" className="manager-shop-secondary" onClick={()=>setShowEditor(false)}>Editor schließen</button>}</form>}
    <div className="manager-shop-products">{products.map(p=><article key={p.id} className="club-shop-panel manager-shop-product">
      <div className="manager-shop-product-image">{p.image_url?<img src={p.image_url} alt={p.name} loading="lazy"/>:<ShoppingBag size={38}/>}<span className={`club-shop-badge ${p.active?'is-paid':''}`}>{p.active?'Im Shop sichtbar':'Ausgeblendet'}</span></div>
      <div className="manager-shop-product-body"><h3>{p.name}</h3><strong>{shopMoney(p.price_cents)}</strong><p>{p.sizes.join(' · ')}</p><small>{p.personalizable?'Name & Nummer möglich':'Inklusive angebotener Aufdrucke'}</small><div className="manager-shop-product-actions">{btn('Bearbeiten',()=>{setProduct({id:p.id,active:p.active,name:p.name,price:(p.price_cents/100).toFixed(2),sizes:p.sizes.join(', '),image_url:p.image_url,personalizable:p.personalizable});openEditor();})}{btn(p.active?'Ausblenden':'Einblenden',()=>void action('product',{...p,active:!p.active}))}</div></div>
    </article>)}</div>{!products.length&&<article className="club-shop-panel manager-shop-empty"><Package size={36}/><h3>Platz für eure Kollektion</h3><p>Lege den ersten Artikel mit Foto, Größen und Endpreis an.</p></article>}
    </>}
    {manageOnly&&adminTab==='settings'&&!state.admin&&<article className="club-shop-panel"><h2>Shop-Einstellungen</h2><p>Kontodaten, Händler und Shopfreigabe werden vom Vereinsadmin verwaltet.</p></article>}
    {state.admin&&(!manageOnly||adminTab==='settings')&&<form className="club-shop-panel" onSubmit={e=>{e.preventDefault();void action('settings',settings);}}><h3>Shop einrichten</h3><label>Kontoinhaber / Verein<input required value={settings.recipient||''} onChange={e=>setSettings({...settings,recipient:e.target.value})}/></label><label>Vereins-IBAN<input required maxLength={34} value={settings.iban||''} onChange={e=>setSettings({...settings,iban:e.target.value})}/></label><label>Händler · E-Mail seines bestehenden Kontos<input type="email" value={settings.dealer_email||''} onChange={e=>setSettings({...settings,dealer_email:e.target.value})}/></label><label>Shopverantwortlicher · E-Mail seines bestehenden Kontos<input type="email" value={settings.manager_email||''} onChange={e=>setSettings({...settings,manager_email:e.target.value})}/></label><label className="club-shop-check"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/>Bestellungen freischalten</label><p>Vereinsadmins können den Shop verwalten. Ein zusätzlicher Verantwortlicher und der Händler erhalten ausschließlich ihre Shoprechte. Neue Kontodaten gelten für neue Bestellrunden.</p><button disabled={busy}>Einstellungen speichern</button></form>}
   </>}
  </>}
  </>}
  </>}
 </section>;
}
