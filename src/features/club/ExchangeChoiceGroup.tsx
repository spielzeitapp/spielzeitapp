import React from 'react';

/** Native buttons keep every choice visible and keyboard accessible. */
export function ExchangeChoiceGroup({label,value,options,onChange,compact=false}:{label:string;value:string;options:string[];onChange:(value:string)=>void;compact?:boolean}) {
  return <fieldset className={`exchange-editor-choices${compact?' exchange-editor-sizes':''}`}><legend>{label}</legend><div>{options.map(option=><button type="button" key={option} aria-pressed={value===option} onClick={()=>onChange(option)}>{option}</button>)}</div></fieldset>;
}
