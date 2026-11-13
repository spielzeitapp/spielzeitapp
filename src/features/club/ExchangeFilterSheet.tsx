import React,{useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {EXCHANGE_CATEGORIES,EMPTY_EXCHANGE_FILTERS,exchangeSizeOptions,selectExchangeItems, type CatalogItem,type ExchangeFilters} from './exchangeCatalog';

export function ExchangeFilterSheet({value,items,view,userId,search,onApply,onClose}:{value:ExchangeFilters;items:CatalogItem[];view:'all'|'mine';userId:string;search:string;onApply:(filters:ExchangeFilters)=>void;onClose:()=>void}){
  const [draft,setDraft]=useState(value);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
  const count=selectExchangeItems(items,view,userId,draft,search).length;
  const teams=[...new Set(items.map(i=>i.team_label).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de',{numeric:true}));
  const group=(label:string,key:keyof ExchangeFilters,values:string[],all:string)=> <fieldset className="exchange-filter-group"><legend>{label}</legend><div className={key==='size'?'exchange-size-chips':'exchange-option-chips'}>{['',...values].map(option=><button key={option} type="button" aria-pressed={draft[key]===option} onClick={()=>setDraft(previous=>({...previous,[key]:option,...(key==='category'&&previous.category!==option?{size:''}:{})}))}>{option||all}</button>)}</div></fieldset>;
  return <dialog ref={dialog} className="exchange-filter-sheet" aria-labelledby="exchange-filter-title" onCancel={onClose} onClose={onClose}>
    <header><div><span className="exchange-sheet-handle"/><h2 id="exchange-filter-title">Angebote filtern</h2></div><button type="button" aria-label="Filter schließen" onClick={onClose}><X size={22}/></button></header>
    <div className="exchange-filter-body">
      {group('Artikel','category',EXCHANGE_CATEGORIES,'Alle')}
      {group(draft.category==='Schuhe'?'Schuhgröße':draft.category?'Kleidergröße':'Größe','size',exchangeSizeOptions(draft.category,items),'Alle')}
      {!draft.category&&<p className="exchange-filter-tip">Für Schuhgrößen wähle zuerst „Schuhe“.</p>}
      {group('Angebot','offer',['Gratis','Tauschen','Verkaufen'],'Alle')}
      {teams.length>0&&group('Mannschaft','team',teams,'Alle Mannschaften')}
    </div>
    <footer><button type="button" onClick={()=>setDraft({...EMPTY_EXCHANGE_FILTERS})}>Zurücksetzen</button><button type="button" className="exchange-primary sz-club-primary" onClick={()=>onApply(draft)}>{count} {count===1?'Angebot':'Angebote'} anzeigen</button></footer>
  </dialog>;
}
