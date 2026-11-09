import {build} from 'esbuild';
import fs from 'node:fs';
await build({entryPoints:['scripts/fixtures/central-workspace-preview.tsx'],bundle:true,format:'esm',platform:'browser',outfile:'__central-complete-qa.js',plugins:[{name:'qa-context',setup(api){
 for(const [filter,path] of [[/ManagerWorkModeContext$/,'work'],[/ManagerClubModulesContext$/,'modules'],[/CommunicationAccessContext$/,'communication'],[/appEnvironment$/,'env']])api.onResolve({filter},()=>({path,namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:({work:"export const useManagerWorkMode=()=>({workMode:'trainer',supportSession:null});",modules:'export const useManagerClubModules=()=>({isModuleEnabled:()=>true});',communication:'export const useCommunicationAccess=()=>({access:{speaker:false,music:false}});',env:'export const isStagingApp=()=>true;'})[path]}));
}}]});
const css=['/src/index.css','/src/manager/managerShell.css','/src/manager/managerDesktopWorkspace.css','/src/manager/appearance/managerAppearance.css','/src/manager/modern/managerModern.css','/src/manager/modern/centralWorkspace.css'];
fs.writeFileSync('__central-complete-qa.html',`<!doctype html><html lang="de"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${css.map(href=>'<link rel="stylesheet" href="'+href+'"/>').join('')}</head><body style="margin:0"><div id="root"></div><script type="module" src="/__central-complete-qa.js"></script></body></html>`);
fs.writeFileSync('__central-complete-mobile.html',`<!doctype html><html><head><meta charset="utf-8"/></head><body style="margin:0;background:#444;display:flex;gap:14px">${['','?mode=day','?club=melk','?club=melk&mode=day'].map(q=>'<iframe title="UI-Prüfung" src="/__central-complete-qa.html'+q+'" style="width:390px;height:980px;flex-shrink:0;border:0"></iframe>').join('')}</body></html>`);
console.log('Visual fixture ready: /__central-complete-mobile.html (development only)');
