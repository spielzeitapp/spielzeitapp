export const EXCHANGE_CATEGORIES = ['T-Shirt', 'Hose', 'Pulli', 'Trainingsanzug', 'Jacke', 'Schuhe', 'Sonstiges'];
export const CLOTHING_SIZES = ['92','98','104','110','116','122','128','134','140','146','152','158','164','170','176','XS','S','M','L','XL','XXL'];
export const SHOE_SIZES = Array.from({length:22},(_,i)=>String(i+25));
export type ExchangeFilters = { category: string; size: string; team: string; offer: string };
export const EMPTY_EXCHANGE_FILTERS: ExchangeFilters = { category:'',size:'',team:'',offer:'' };
export type CatalogItem = { id:string; owner_id:string; title:string; category:string; size:string; team_label:string; offer:string; status:string; description:string; price:number|null; created_at:string };
export type CatalogSort = 'newest' | 'price-asc' | 'price-desc';
export const normalizeExchangeSize = (size:string) => size.trim().replace(/\s+/g,'').toUpperCase();
export function exchangeSizeOptions(category:string,items:CatalogItem[]):string[] {
  const base=category==='Schuhe'?SHOE_SIZES:CLOTHING_SIZES;
  const extra=items.filter(i=>!category||i.category===category).map(i=>i.size.trim()).filter(Boolean);
  return [...new Map([...base,...extra].map(s=>[normalizeExchangeSize(s),s])).values()];
}
export function selectExchangeItems<T extends CatalogItem>(items:T[],view:'all'|'mine',userId:string,filters:ExchangeFilters,search='',sort:CatalogSort='newest'):T[]{
  const normalizeText=(value:string)=>value.toLocaleLowerCase('de-AT').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const tokens=normalizeText(search.trim()).split(/\s+/).filter(Boolean);
  const result=items.filter(item=>(view==='mine'?item.owner_id===userId:item.status!=='Entwurf'&&item.status!=='Vergeben')
    &&(!filters.category||item.category===filters.category)
    &&(!filters.size||normalizeExchangeSize(item.size)===normalizeExchangeSize(filters.size))
    &&(!filters.team||item.team_label===filters.team)&&(!filters.offer||item.offer===filters.offer)
    &&tokens.every(token=>normalizeText([item.title,item.category,item.description,item.size].join(' ')).includes(token)));
  const amount=(item:CatalogItem)=>item.offer==='Gratis'?0:item.offer==='Verkaufen'&&item.price!==null?Number(item.price):null;
  return result.sort((a,b)=>{
    if(sort!=='newest'){
      const left=amount(a),right=amount(b);
      if(left===null&&right!==null)return 1;if(right===null&&left!==null)return -1;
      if(left!==null&&right!==null&&left!==right)return sort==='price-asc'?left-right:right-left;
    }
    return Date.parse(b.created_at)-Date.parse(a.created_at)||a.id.localeCompare(b.id);
  });
}
