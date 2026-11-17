import {readFile} from 'node:fs/promises';
export const PROJECT='acbaecjzoabafbsjrzvr';
export const SUBJECT='{{ if eq .Data.auth_entry "vereinsmarkt" }}Bestätige deine E-Mail-Adresse · Vereinsmarkt{{ else }}Bestätige deine E-Mail-Adresse · SpielzeitApp{{ end }}';
export async function applyConfirmationTemplate(){
 const token=process.env.SUPABASE_ACCESS_TOKEN;
 if(!token)throw Error('SUPABASE_ACCESS_TOKEN is required');
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const request=async(path,options={})=>{const r=await fetch(`https://api.supabase.com/v1/projects/${PROJECT}${path}`,{...options,headers});if(!r.ok)throw Error(`Supabase request failed: ${r.status}`);return r.json();};
 const project=await request('');
 if(project.id!==PROJECT||project.name!=='spielzeitapp-staging')throw Error('Unexpected project; refusing template update');
 const html=await readFile(new URL('../supabase/templates/confirmation.html',import.meta.url),'utf8');
 if(!html.includes('{{ .ConfirmationURL }}')||!html.includes('eq .Data.auth_entry "vereinsmarkt"'))throw Error('Template missing confirmation URL or entry condition');
 const before=await request('/config/auth');
 const fields={mailer_subjects_confirmation:SUBJECT,mailer_templates_confirmation_content:html};
 if(Object.entries(fields).some(([k,v])=>before[k]!==v))await request('/config/auth',{method:'PATCH',body:JSON.stringify(fields)});
 const after=await request('/config/auth');
 if(Object.entries(fields).some(([k,v])=>after[k]!==v))throw Error('Template readback mismatch');
 for(const key of ['mailer_autoconfirm','site_url','uri_allow_list','smtp_sender_name','mailer_subjects_recovery','mailer_templates_recovery_content','mailer_subjects_magic_link','mailer_templates_magic_link_content'])if(JSON.stringify(before[key])!==JSON.stringify(after[key]))throw Error(`Unexpected configuration change: ${key}`);
 console.log(JSON.stringify({ok:true,project:PROJECT,confirmation_template_verified:true,market_branding:true,other_auth_settings_preserved:true}));
}
if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href)applyConfirmationTemplate().catch(e=>{console.error(e.message);process.exit(1);});
