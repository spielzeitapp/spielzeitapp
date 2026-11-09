import { MANAGER_NAV_SECTIONS, type ManagerNavItem } from '../managerNav';
import { navItemVisibleForWorkMode, type ManagerWorkMode } from '../managerWorkMode';

export type CentralTool = ManagerNavItem & { section: string };
const EXTRA_TOOLS: CentralTool[] = [
  { id:'teams', label:'Mannschaften', to:'/manager/teams', status:'ready', section:'Mein Team' },
  { id:'players', label:'Spieler & Fotos', to:'/manager/spieler', status:'ready', section:'Mein Team' },
  { id:'live', label:'Live-Spieltag', to:'/manager/live', status:'ready', section:'Sport' },
  { id:'calendar', label:'Wochenkalender', to:'/manager/termine/calendar', status:'ready', section:'Sport' },
  { id:'archive', label:'Saisonwechsel & Archiv', to:'/manager/saisons/verwaltung', status:'ready', moduleKey:'seasons', section:'Mein Team' },
  { id:'templates', label:'Vorlagen', to:'/manager/training/vorlagen', status:'ready', moduleKey:'training-tpl', section:'Sport' },
  { id:'chronicle', label:'Trainingschronik', to:'/manager/training/chronik', status:'ready', moduleKey:'training-chronik', section:'Sport' },
  { id:'notifications', label:'Benachrichtigungen', to:'/manager/nachrichten', status:'ready', section:'Content' },
];

/** The existing navigation is the source of truth: no separate feature or permission list. */
export const CENTRAL_TOOLS: readonly CentralTool[] = [
  ...MANAGER_NAV_SECTIONS.flatMap(section => section.items.map(item => ({...item, section:section.label}))),
  ...EXTRA_TOOLS,
].filter((item,index,all) => item.status==='ready' && item.to && all.findIndex(other=>other.id===item.id || (other.to===item.to&&other.label===item.label))===index);

export function centralToolsForContext(input:{mode:ManagerWorkMode;support:boolean;staging:boolean;isModuleEnabled:(key?:string)=>boolean;speaker:boolean;music:boolean}) {
  return CENTRAL_TOOLS.filter(item =>
    (!item.platformGlobalOnly || (input.mode==='platform_admin'&&!input.support)) &&
    (!item.stagingOnly || input.staging) && input.isModuleEnabled(item.moduleKey) &&
    (item.id==='speaker-studio' ? input.speaker : item.id==='music-studio' ? input.music : navItemVisibleForWorkMode(item,input.mode)));
}

export function centralPage(path:string,search='') {
  const exact=CENTRAL_TOOLS.find(item=>item.to===path+search)??CENTRAL_TOOLS.find(item=>item.to===path);
  if(exact)return exact;
  const detail:[RegExp,string,string][]=[
    [/^\/manager\/saisons\/[^/]+\/oefb-import/,'ÖFB-Import','Mein Team'],
    [/^\/manager\/saisons\/[^/]+\/kader/,'Kader & Spielerfotos','Mein Team'],
    [/^\/manager\/saisons\/[^/]+\/zugaenge/,'Trainer & Zugänge','Mein Team'],
    [/^\/manager\/vereine\/[^/]+/,'Vereinssetup','Plattform'],
    [/^\/manager\/training\/einheiten\//,'Training bearbeiten','Sport'],
    [/^\/manager\/team\/trainer\//,'Trainerprofil','Mein Team'],
    [/^\/manager\/mehr\/parent-access\//,'Eltern & Spielerzugang','Mein Team'],
    [/^\/manager\/(events|match)\//,'Termin & Spielbericht','Sport'],
    [/^\/manager\/(live|match-preparation|match-lineup)/,'Live-Spieltag & Aufstellung','Sport'],
  ];
  const match=detail.find(([pattern])=>pattern.test(path));
  return {id:'detail',label:match?.[1]??'Zentrale',section:match?.[2]??'Übersicht',status:'ready' as const,to:path};
}

export function relatedCentralTools(tools:readonly CentralTool[],path:string,section:string) {
  const prefixes=path.startsWith('/manager/training')?['/manager/training/']:
    /^\/manager\/(termine|platzbelegung)(\/|$)/.test(path)?['/manager/termine','/manager/platzbelegung']:
    /^\/manager\/(spiele|turniere|tabelle|live|match)(\/|-|$)/.test(path)?['/manager/spiele','/manager/turniere','/manager/tabelle','/manager/live']:
    null;
  return tools.filter(item=>prefixes?prefixes.some(prefix=>item.to?.startsWith(prefix)):item.section===section)
    .filter((item,index,items)=>items.findIndex(other=>other.to===item.to)===index);
}

export function searchCentralTools(tools:readonly CentralTool[],query:string) {
  const aliases:Record<string,string>={
    squad:'Kader Spieler Trainer Mannschaftsfoto Spielerfotos',players:'Kader Portrait Fotobox Freisteller Fotos',
    clubs:'Vereinssetup Logo Farben Vereinsfarben',seasons:'ÖFB Import Saisonwechsel Archiv',
    'team-push':'Push Benachrichtigung Nachricht',reminders:'Push Erinnerung Benachrichtigung',
    'training-lib':'Übungen Bibliothek Training',venues:'Platzbelegung Sportplatz Kalender',
    'media-studio':'Mannschaftsfoto Fotos Grafiken Bilder Beiträge',
  };
  const words=query.toLocaleLowerCase('de-AT').trim().split(/\s+/).filter(Boolean);
  return tools.filter(tool=>words.every(word=>(tool.label+' '+tool.section+' '+(aliases[tool.id]??'')).toLocaleLowerCase('de-AT').includes(word)));
}
