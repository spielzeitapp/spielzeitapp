export type FundSplit={team_id:string;amount_cents:number};
export type FundTeam={id:string;label:string};
export const fundMoney=(cents:number)=>Number(cents/100).toLocaleString('de-AT',{style:'currency',currency:'EUR'});
export function fundCents(value:string){if(!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))return null;const n=Math.round(Number(value.replace(',','.'))*100);return Number.isSafeInteger(n)&&n>=0&&n<=999900?n:null;}
export function fundPrice(item:{offer:string;price:number|null}){return ['Verkaufen','Fürs Team'].includes(item.offer)?fundMoney(Math.round(Number(item.price)*100))+(item.offer==='Fürs Team'?' fürs Team':''):item.offer;}
export function buildFundSplit(rows:{team_id:string;value:string}[],total:string):FundSplit[]{const cents=fundCents(total);const result=rows.map(r=>({team_id:r.team_id,amount_cents:fundCents(r.value)}));if(!cents||!result.length||result.some(r=>!r.team_id||!r.amount_cents)||new Set(result.map(r=>r.team_id)).size!==result.length||result.reduce((n,r)=>n+(r.amount_cents||0),0)!==cents)throw Error('Wähle deine Teams und verteile genau den Gesamtbetrag.');return result as FundSplit[];}
