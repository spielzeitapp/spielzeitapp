import React from 'react';
import { Check, Gift, ArrowLeftRight, Tag, type LucideIcon } from 'lucide-react';
const offerIcons: Record<string,LucideIcon> = {Gratis:Gift,Tauschen:ArrowLeftRight,Verkaufen:Tag};

/** Native buttons keep every choice visible and keyboard accessible. */
export function ExchangeChoiceGroup({label,value,options,onChange,compact=false}:{label:string;value:string;options:string[];onChange:(value:string)=>void;compact?:boolean}) {
  const offer = label === 'Angebot';
  return <fieldset className={`exchange-editor-choices${compact?' exchange-editor-sizes':''}${offer?' exchange-editor-offers':''}`}><legend>{label}</legend><div>{options.map(option=>{
    const Icon = offer ? offerIcons[option] : undefined;
    return <button type="button" key={option} aria-pressed={value===option} onClick={()=>onChange(option)}>{Icon&&<Icon size={21} aria-hidden/>}{option}{value===option&&<Check className="exchange-choice-check" size={14} aria-hidden/>}</button>;
  })}</div></fieldset>;
}
