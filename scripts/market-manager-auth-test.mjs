import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  React = require("react"),
  { act, create } = require("react-test-renderer"),
  { MemoryRouter, useLocation } = require("react-router-dom");
const store = new Map();
globalThis.requestAnimationFrame=()=>0;
globalThis.cancelAnimationFrame=()=>{};
globalThis.window = {
  location: {
    hostname: "app.spielzeitapp.at",
    pathname: "/vereinsmarkt-manager/anmelden",
    origin: "https://app.spielzeitapp.at",
    hash: "",
    search: "",
    replace() {},
  },
  sessionStorage: {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
  addEventListener(){},removeEventListener(){},dispatchEvent(){},
  localStorage: { getItem: () => null, removeItem() {} },
  setTimeout,
  clearTimeout,
};
globalThis.document = { addEventListener() {}, removeEventListener() {} };
globalThis.fetch = async () => ({ ok: false });
globalThis.__uscAuthUser = null;
globalThis.__uscAuthCalls = [];
const empty = [
  "clearPendingParentEmailInviteFlag",
  "clearStashedParentInviteToken",
  "ensureParentInviteContextFromNext",
  "stashParentInviteEmail",
  "stashParentInviteToken",
  "markPendingParentEmailInvite",
];
const none = [
  "readParentInviteTokenFromUserMetadata",
  "readStashedParentInviteEmail",
  "readStashedParentInviteToken",
  "resolvePendingParentInvitePath",
  "extractInviteTokenFromNext",
];
const inviteMock =
  empty.map((n) => `export const ${n}=()=>{};`).join("") +
  none.map((n) => `export const ${n}=()=>${n==='readStashedParentInviteEmail'?"globalThis.staleInviteEmail||null":n==='resolvePendingParentInvitePath'?"globalThis.staleInvitePath||null":"null"};`).join("") +
  `export const buildParentInviteAuthNext=()=>'/app/parent-invite';export const buildParentInviteAuthQuery=opts=>new URLSearchParams(opts).toString();export const isAppIntroEntryPath=()=>false;export const hasOpenParentEmailInviteForMe=async()=>false;`;
const mocks = {
  useSession: "export const useSession=()=>({backendRole:'fan'});",
  AuthProvider:
    "export const useAuth=()=>({user:globalThis.__uscAuthUser,session:null,loading:false});",
  TurnstileWidget:
    "export const isTurnstileConfigured=false;export const TurnstileWidget=()=>null;",
  parentLinkInvites: inviteMock,
  PlayerLoginPanel: "export const PlayerLoginPanel=()=>null;",
  playerAccessFeature: "export const isPlayerQrAccessEnabled=()=>true;",
  accountScopedStorage: "export const clearAccountScopedClientState=()=>{};",
  supabaseClient: `export const setRememberMePreference=v=>globalThis.__uscAuthCalls.push(['remember',v]);export const supabase={auth:{signInWithPassword:async args=>{globalThis.__uscAuthCalls.push(['login',args]);return {data:{user:{id:'u'}},error:null};},resetPasswordForEmail:async(email,args)=>{globalThis.__uscAuthCalls.push(['reset',email,args]);return {error:null};},updateUser:async args=>{globalThis.__uscAuthCalls.push(['update',args]);return {error:null};}}};`,
};
const entries = [
  "src/pages/LoginPage.tsx",
  "src/pages/ForgotPasswordPage.tsx",
  "src/pages/RegisterPage.tsx",
  "src/pages/SetPasswordPage.tsx",
  "src/features/club/uscAuth.ts",
  "src/auth/RequireAuth.tsx",
  "src/features/club/marketAuth.ts",
];
const b = await build({
  entryPoints: entries,
  outdir: "out",
  bundle: true,
  format: "cjs",
  platform: "node",
  packages: "external",
  write: false,
  define: { "import.meta.env": "{}" },
  loader: { ".css": "empty", ".png": "dataurl" },
  plugins: [
    {
      name: "mocks",
      setup(b) {
        b.onResolve({ filter: /^react$/ }, () => ({
          path: "react",
          external: true,
        }));
        b.onResolve(
          {
            filter:
              /AuthProvider$|TurnstileWidget$|parentLinkInvites$|PlayerLoginPanel$|playerAccessFeature$|accountScopedStorage$|supabaseClient$|useSession$/,
          },
          (a) => ({ path: a.path.split("/").pop(), namespace: "mock" }),
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
          contents: mocks[a.path],
          loader: "js",
        }));
      },
    },
  ],
});
const mods = b.outputFiles.map((f) => {
  const m = { exports: {} };
  new Function("require", "module", "exports", f.text)(require, m, m.exports);
  return m.exports;
});
const [login, forgot, register, setPassword, auth, required,market] = mods;
const RouteBound=({Component})=>{const path=useLocation().pathname;return Component===login.LoginPage&&!path.endsWith("/anmelden")?null:React.createElement(Component);};
let tree;
const Watch = () =>
  React.createElement(
    "output",
    null,
    useLocation().pathname + useLocation().search,
  );
async function mount(Component, path) {
  await act(async () => {
    tree = create(
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(
          React.Fragment,
          null,
          React.createElement(RouteBound,{Component}),
          React.createElement(Watch),
        ),
      ),
      { createNodeMock: () => ({ scrollIntoView() {} }) },
    );
  });
}
const json = () => JSON.stringify(tree.toJSON());
const hrefs = () => tree.root.findAllByType("a").map((a) => a.props.href);
async function change(id, value) {
  await act(async () =>
    tree.root.findByProps({ id }).props.onChange({ target: { value } }),
  );
}

const club='3db6fce2-a4c1-44a5-a333-19d1d4d62e6a',target='/vereinsmarkt-manager/'+club,entry=target+'/anmelden';
globalThis.staleInviteEmail='other@example.test';globalThis.staleInvitePath='/app/parent-invite';await mount(login.LoginPage,entry);
assert.match(json(),/Beim Vereinsmarkt-Manager anmelden/);assert.match(json(),/shield-m-180/);assert.doesNotMatch(json(),/Jetzt registrieren|Demo ohne Login|Spieler-Login/);
assert.ok(hrefs().some(h=>h.startsWith(target+'/passwort-vergessen')));assert.notEqual(tree.root.findByProps({id:'login-email'}).props.readOnly,true,'old parent invitation must not lock manager email');
await change('login-email','manager@example.test');await change('login-password','test-password');
await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
assert.equal(tree.root.findByType('output').children.join(''),target,'password login remains inside manager');
await act(async()=>tree.unmount());
await mount(login.LoginPage,'/vereinsmarkt-manager/anmelden');assert.match(json(),/Beim Vereinsmarkt-Manager anmelden/);await change('login-email','manager@example.test');await change('login-password','test-password');await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(tree.root.findByType('output').children.join(''),'/vereinsmarkt-manager');await act(async()=>tree.unmount());
const recovery=market.marketAuthPath('forgot-password','',entry);await mount(forgot.ForgotPasswordPage,recovery);
const field=tree.root.findAllByType('input').find(n=>n.props.type==='email');await act(async()=>field.props.onChange({target:{value:'manager@example.test'}}));await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
const reset=globalThis.__uscAuthCalls.find(c=>c[0]==='reset');const url=new URL(reset[2].redirectTo);assert.equal(url.searchParams.get('context'),'vereinsmarkt-manager');assert.equal(url.searchParams.get('next'),target);await act(async()=>tree.unmount());
const Guard=()=>useLocation().pathname==='/manager/vereinsmarkt'?React.createElement(required.RequireAuth):null;await mount(Guard,'/manager/vereinsmarkt?club='+club+'&from=vereinsmarkt-manager');assert.equal(tree.root.findByType('output').children.join(''),entry);await act(async()=>tree.unmount());
globalThis.__uscAuthUser={id:'u'};await mount(login.LoginPage,entry);assert.equal(tree.root.findByType('output').children.join(''),target);await act(async()=>tree.unmount());
console.log('PASS stale parent-invite isolation, own manager login branding, exact credential-login return, cold-start root, existing session, own password recovery and expired team-page session');
