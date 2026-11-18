import React, { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, FlaskConical, ShoppingBag, Trash2 } from 'lucide-react';

const source='https://www.jako.com/de-de/ziptop-dynamic-p13949/?color=114';
const image='https://cdn.jako.com/userdata/dcshop/images/normal/8670_114.jpg';
const trials=[
 {id:'children',label:'Kinder',sizes:['116','128','140','152','164'],price:4499},
 {id:'adults',label:'Erwachsene',sizes:['S','M','L','XL','XXL','3XL'],price:4999},
];
const money=(c:number)=>new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format(c/100);
type Trial=typeof trials[number];
type Line={id:number;group:string;size:string;name:string;number:string;price:number};
/** Pure browser preview: never calls shop RPC, writes orders or supplies payment data. */
export function ShopTrialCatalog(){
 const [selected,setSelected]=useState<Trial|null>(null),[size,setSize]=useState(''),[name,setName]=useState(''),[number,setNumber]=useState(''),[lines,setLines]=useState<Line[]>([]),[added,setAdded]=useState(false);
 return <section className="club-shop-trial" aria-label="Probeartikel ausprobieren">
  <div className="club-shop-trial-note"><FlaskConical size={22}/><div><strong>Probeartikel · Nur zum Ausprobieren</strong><p>Beispielsortiment mit JAKO-Produktfoto. Keine echte Bestellung und keine Zahlung. Die dargestellten Preise sind Beispielpreise für die Gestaltung, keine zugesagten Vereinspreise.</p></div></div>
  {selected?<article className="club-shop-panel">
   <button className="club-shop-trial-back" onClick={()=>setSelected(null)}><ArrowLeft size={18}/>Alle Probeartikel</button>
   <img className="club-shop-trial-detail" src={image} alt="JAKO Ziptop Dynamic in Rot, Weiß und Dunkelrot"/>
   <p className="club-shop-eyebrow">JAKO · {selected.label} · Art. 8670 / 114</p><h2>Ziptop Dynamic</h2>
   <p>Rot / Weiß / Dunkelrot</p><strong className="club-shop-trial-price">{money(selected.price)} <small>Beispielpreis</small></strong>
   <fieldset className="club-shop-trial-sizes"><legend>Größe wählen</legend><div>{selected.sizes.map(s=><button key={s} aria-pressed={size===s} onClick={()=>{setSize(s);setAdded(false);}}>{s}</button>)}</div></fieldset>
   <div className="club-shop-fields"><label>Wunschname · Vorschau<input maxLength={24} placeholder="z. B. Daniel" value={name} onChange={e=>{setName(e.target.value);setAdded(false);}}/></label><label>Nummer · Vorschau<input inputMode="numeric" maxLength={2} placeholder="z. B. 10" value={number} onChange={e=>{setNumber(e.target.value.replace(/\D/g,''));setAdded(false);}}/></label></div>
   <p className="club-shop-muted">Vereinslogo und Aufdruck werden später mit dem Händler festgelegt. Veredelung ist im Beispielpreis nicht kalkuliert.</p>
   <button className="club-shop-button" disabled={!size} onClick={()=>{setLines(previous=>[...previous,{id:Date.now()+Math.random(),group:selected.label,size,name:name.trim(),number,price:selected.price}]);setAdded(true);}}>{size?'Zum Probe-Warenkorb hinzufügen':'Bitte Größe wählen'}</button>
   {added&&<p className="club-shop-notice" role="status"><Check size={18}/>Zum Probe-Warenkorb hinzugefügt.</p>}
   <a href={source} target="_blank" rel="noreferrer">Originalprodukt und aktuelle Angaben bei JAKO ansehen</a>
  </article>:<><div className="club-shop-row"><h2>So könnte eure Kollektion aussehen</h2><span className="club-shop-badge">2 Probeartikel</span></div><div className="club-shop-grid">{trials.map(p=><button key={p.id} className="club-shop-product" onClick={()=>{setSelected(p);setSize('');setName('');setNumber('');setAdded(false);}}><img src={image} alt={`JAKO Ziptop Dynamic · ${p.label}`} loading="lazy"/><small>PROBEARTIKEL · {p.label}</small><strong>JAKO Ziptop Dynamic</strong><span>{money(p.price)}</span><small>Rot / Weiß / Dunkelrot</small><span className="club-shop-product-link">Größe auswählen<ChevronRight size={16}/></span></button>)}</div></>}
  {lines.length>0&&<article className="club-shop-panel" aria-label="Probe-Warenkorb"><h2><ShoppingBag size={22}/> Dein Probe-Warenkorb</h2>{lines.map(line=><div className="club-shop-cart-row" key={line.id}><span><strong>Ziptop Dynamic · {line.group}</strong><small>Größe {line.size}{line.name&&` · ${line.name}`}{line.number&&` · Nr. ${line.number}`}</small>{money(line.price)}</span><button aria-label={`Probeartikel Größe ${line.size} entfernen`} onClick={()=>setLines(previous=>previous.filter(i=>i.id!==line.id))}><Trash2 size={18}/></button></div>)}<div className="club-shop-row"><strong>Beispielsumme</strong><strong>{money(lines.reduce((n,i)=>n+i.price,0))}</strong></div><p>Hier endet die Vorschau. Es wird nichts bestellt oder an einen Händler übermittelt. Der Probe-Warenkorb wird beim Verlassen zurückgesetzt.</p></article>}
 </section>;
}
