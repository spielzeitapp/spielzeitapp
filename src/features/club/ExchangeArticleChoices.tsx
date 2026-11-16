import React from 'react';
import {Check} from 'lucide-react';
import {EXCHANGE_MAIN_CATEGORIES,EXCHANGE_SHOE_TYPES,EXCHANGE_ACCESSORIES,exchangeCategoryGroup} from './exchangeCatalog';
/** The stored category stays specific; parent groups include all their subtypes. */
export function ExchangeArticleChoices({value,onChange,allowAll=false}:{value:string;onChange:(value:string)=>void;allowAll?:boolean}){
 const group=exchangeCategoryGroup(value);
 const choices=(options:{value:string;label:string}[],selected:string)=><div className="exchange-article-grid">{options.map(option=><button key={option.value} type="button" aria-pressed={selected===option.value} onClick={()=>onChange(option.value)}>{option.label}{selected===option.value&&<Check size={14} aria-hidden="true"/>}</button>)}</div>;
 const subtypes=group==='Schuhe'?EXCHANGE_SHOE_TYPES:group==='Zubehör'?EXCHANGE_ACCESSORIES:null;
 return <div className="exchange-article-choices"><fieldset><legend>Artikel</legend>{choices([...(allowAll?[{value:'',label:'Alle Artikel'}]:[]),...EXCHANGE_MAIN_CATEGORIES.map(value=>({value,label:value}))],group)}</fieldset>{subtypes&&<fieldset><legend>{group==='Schuhe'?'Welche Schuhe?':'Welches Zubehör?'}</legend>{choices([{value:group,label:group==='Schuhe'?(allowAll?'Alle Schuhe':'Andere Schuhe'):(allowAll?'Alles Zubehör':'Allgemeines Zubehör')},...subtypes.map(value=>({value,label:value}))],value)}{group==='Zubehör'&&<p className="exchange-article-hint">Trainingszubehör: zum Beispiel Markierungshütchen, Koordinationsleitern oder Trainingsleibchen. {allowAll&&<>Ältere Inserate unter „Sonstiges“ sind im Zubehörfilter ebenfalls enthalten.</>}</p>}</fieldset>}</div>;
}
