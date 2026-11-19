type NameFields={first_name?:unknown;last_name?:unknown;full_name?:unknown;display_name?:unknown;name?:unknown};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
function nameFrom(fields:NameFields|null|undefined){
 if(!fields)return '';
 const combined=[text(fields.first_name),text(fields.last_name)].filter(Boolean).join(' ');
 return [combined,text(fields.full_name),text(fields.display_name),text(fields.name)].find(n=>n&&!/^spielzeitapp$/i.test(n))||'';
}
/** Presentation only: never infer a public name from an email address. */
export function marketAccountIdentity(profile:NameFields|null|undefined,metadata:NameFields|null|undefined){
 const name=nameFrom(profile)||nameFrom(metadata);
 const words=name.split(/\s+/).filter(Boolean);
 const initials=words.length?[words[0],...(words.length>1?[words[words.length-1]]:[])].map(w=>Array.from(w)[0]).join('').toLocaleUpperCase('de-AT'):'';
 return {name,initials};
}
