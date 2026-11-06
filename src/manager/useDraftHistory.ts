import {useReducer} from 'react';
type State<T>={value:T;past:T[];group:boolean;recorded:boolean};
type Action<T>={type:'change';update:T|((value:T)=>T)}|{type:'reset';value:T}|{type:'begin'|'end'|'undo'};
export function draftHistoryReducer<T>(s:State<T>,a:Action<T>):State<T>{
 if(a.type==='reset')return {value:a.value,past:[],group:false,recorded:false};
 if(a.type==='begin')return {...s,group:true,recorded:false};
 if(a.type==='end')return {...s,group:false,recorded:false};
 if(a.type==='undo')return s.past.length?{value:s.past[s.past.length-1],past:s.past.slice(0,-1),group:false,recorded:false}:s;
 const value=typeof a.update==='function'?(a.update as (v:T)=>T)(s.value):a.update;
 if(JSON.stringify(value)===JSON.stringify(s.value))return s;
 return {...s,value,past:s.group&&s.recorded?s.past:[...s.past.slice(-49),s.value],recorded:s.group};
}
export function useDraftHistory<T>(initial:T){
 const [state,dispatch]=useReducer(draftHistoryReducer<T>,{value:initial,past:[],group:false,recorded:false});
 return {value:state.value,canUndo:state.past.length>0,change:(update:T|((v:T)=>T))=>dispatch({type:'change',update}),reset:(value:T)=>dispatch({type:'reset',value}),begin:()=>dispatch({type:'begin'}),end:()=>dispatch({type:'end'}),undo:()=>dispatch({type:'undo'})};
}
