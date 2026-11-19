import {createHmac, timingSafeEqual} from 'node:crypto';

export const TEST_REF='acbaecjzoabafbsjrzvr';
export const TEST_ORIGIN='https://app.spielzeitapp.at';
// A domain-separated key: the service role itself is never used as a webhook secret.
export function hookKey(serviceRole){return createHmac('sha256',serviceRole).update('spielzeitapp:test:auth-email-hook:v1').digest();}
export function verifyHook(raw,headers,key,now=Date.now()){
 const id=headers['webhook-id'],stamp=headers['webhook-timestamp'],signatures=headers['webhook-signature'];
 if(typeof id!=='string'||typeof stamp!=='string'||typeof signatures!=='string'||!/^\d+$/.test(stamp)||Math.abs(now/1000-Number(stamp))>300)return false;
 const expected=createHmac('sha256',key).update(`${id}.${stamp}.${raw}`).digest();
 return signatures.split(' ').some(s=>{if(!s.startsWith('v1,'))return false;const given=Buffer.from(s.slice(3),'base64');return given.length===expected.length&&timingSafeEqual(given,expected);});
}
const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function buildAuthEmails(payload){
 const {user,email_data:d}=payload;
 if(!user?.email||!d)throw Error('Invalid payload');
 const type=d.email_action_type;
 const notices={password_changed_notification:'Dein Passwort wurde geändert',email_changed_notification:'Deine E-Mail-Adresse wurde geändert',phone_changed_notification:'Deine Telefonnummer wurde geändert',identity_linked_notification:'Ein Anmeldedienst wurde verknüpft',identity_unlinked_notification:'Ein Anmeldedienst wurde entfernt',mfa_factor_enrolled_notification:'Ein zusätzlicher Anmeldefaktor wurde hinzugefügt',mfa_factor_unenrolled_notification:'Ein zusätzlicher Anmeldefaktor wurde entfernt'};
 const subjects={signup:'E-Mail-Adresse bestätigen',recovery:'Neues Passwort festlegen',invite:'Einladung annehmen',magiclink:'Jetzt anmelden',email:'Jetzt anmelden',email_change:'E-Mail-Änderung bestätigen',reauthentication:'Anmeldung bestätigen'};
 if(!subjects[type]&&!notices[type])throw Error('Unsupported action');
 let target=new URL(d.redirect_to||d.site_url||TEST_ORIGIN);
 if(target.origin!==TEST_ORIGIN)throw Error('Unexpected redirect origin');
 const market=target.searchParams.get('context')==='vereinsmarkt'||/^\/(?:vereinsmarkt|marktplatz)\/[0-9a-f-]{36}(?:\/|$)/i.test(target.pathname);
 const brand=market?'Vereinsmarkt':'SpielzeitApp';
 if(notices[type]){const title=notices[type],message='Falls du diese Änderung nicht vorgenommen hast, wende dich bitte umgehend an den Support.';return [{to:type==='email_changed_notification'?(d.old_email||user.email):user.email,senderName:brand,subject:`${title} · ${brand}`,text:`${title} · ${brand}\n\n${message}`,html:`<div style="font-family:Arial,sans-serif;padding:24px"><h1>${brand}</h1><h2>${title}</h2><p>${message}</p></div>`}];}
 const targets=type==='email_change'?(d.token_hash_new?[{to:user.email,hash:d.token_hash_new,token:d.token},{to:user.new_email,hash:d.token_hash,token:d.token_new}]:[{to:user.new_email,hash:d.token_hash,token:d.token_new||d.token}]):[{to:user.email,hash:d.token_hash,token:d.token}];
 return targets.map(item=>{
  if(!item.to||!item.hash&&type!=='reauthentication')throw Error('Missing email token');
  const url=new URL(`https://${TEST_REF}.supabase.co/auth/v1/verify`);
  url.search=new URLSearchParams({token:item.hash||'',type,redirect_to:target.href}).toString();
  const title=subjects[type];
  const action=type==='signup'&&market?'Vereinsmarkt bestätigen':title;
  const text=type==='reauthentication'?`${title} · ${brand}\n\nDein Bestätigungscode: ${item.token}`:`${title} · ${brand}\n\n${action}:\n${url.href}\n\nFalls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.`;
  const content=type==='reauthentication'?`<p>Dein Bestätigungscode: <strong>${escape(item.token)}</strong></p>`:`<p>${type==='recovery'?`Lege ein neues Passwort für dein Konto bei ${brand} fest.`:`Bestätige deine Anfrage für ${brand}.`}</p><a href="${escape(url.href)}" style="display:inline-block;background:#98243f;color:#fff;padding:16px 22px;border-radius:12px;text-decoration:none;font-weight:bold">${action}</a>`;
  return {to:item.to,subject:`${title} · ${brand}`,senderName:brand,text,html:`<div style="background:#f5f3f6;padding:24px;font-family:Arial,sans-serif;color:#251f2c"><div style="max-width:560px;margin:auto;background:#fff;border-radius:20px;overflow:hidden"><div style="background:#151116;color:white;padding:28px;text-align:center">${market?`<img src="${TEST_ORIGIN}/vereinsmarkt/icon-180.png" width="64" height="64" alt=""/><h1>Vereinsmarkt</h1><small>powered by SpielzeitApp</small>`:'<h1>SpielzeitApp</h1>'}</div><div style="padding:28px;text-align:center"><h2>${title}</h2>${content}<p style="font-size:12px;color:#665b6e">Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p></div></div></div>`};
 });
}
