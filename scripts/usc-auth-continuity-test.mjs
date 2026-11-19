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
  none.map((n) => `export const ${n}=()=>null;`).join("") +
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
  "src/features/club/uscEventLink.ts",
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
const [login, forgot, register, setPassword, auth, links, required] = mods;
const root = "/app/usc-rohrbach",
  returnTo = root + "?tab=teams&teamSeason=km";
assert.equal(auth.safeUscReturn("https://evil.test" + root), null);
assert.equal(auth.safeUscReturn("//evil.test" + root), null);
assert.equal(auth.safeUscReturn(root + "/../../manager"), null);
assert.equal(auth.safeUscReturn(root + "-fake"), null);
assert.equal(auth.uscAuthTarget("/manager/login", "?next=" + root), null);
assert.equal(
  auth.uscAuthTarget("/login", "?next=" + encodeURIComponent(returnTo)),
  returnTo,
);
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
          React.createElement(Component),
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
await mount(login.LoginPage, auth.uscAuthPath("anmelden", returnTo));
assert.match(json(), /Beim USC Rohrbach anmelden/);
assert.match(json(), /usc-auth-page/);
assert.doesNotMatch(json(), /Demo ohne Login|U12-Demoteam|Spieler-Login/);
assert.ok(hrefs().includes(auth.uscAuthPath("registrieren", returnTo)));
assert.ok(hrefs().includes(auth.uscAuthPath("passwort-vergessen", returnTo)));
await change("login-email", "tester@example.test");
await change("login-password", "test-password");
await act(async () =>
  tree.root.findByType("form").props.onSubmit({ preventDefault() {} }),
);
assert.ok(globalThis.__uscAuthCalls.some((c) => c[0] === "login"));
assert.equal(tree.root.findByType("output").children.join(""), returnTo);
await act(async () => tree.unmount());
await mount(
  forgot.ForgotPasswordPage,
  auth.uscAuthPath("passwort-vergessen", returnTo),
);
assert.match(json(), /USC Kaschütz Rohrbach/);
assert.ok(hrefs().includes(auth.uscAuthPath("anmelden", returnTo)));
await change("forgot-email", "tester@example.test");
await act(async () =>
  tree.root.findByType("form").props.onSubmit({ preventDefault() {} }),
);
const reset = globalThis.__uscAuthCalls.find((c) => c[0] === "reset");
assert.equal(new URL(reset[2].redirectTo).pathname, "/app/set-password");
assert.equal(new URL(reset[2].redirectTo).searchParams.get("next"), returnTo);
await act(async () => tree.unmount());
await mount(register.RegisterPage, auth.uscAuthPath("registrieren", returnTo));
assert.match(json(), /Für USC Rohrbach registrieren/);
assert.ok(hrefs().includes(auth.uscAuthPath("anmelden", returnTo)));
await act(async () => tree.unmount());
await mount(login.LoginPage, "/login");
assert.match(json(), /Willkommen zurück/);
assert.match(json(), /Demo ohne Login/);
assert.doesNotMatch(json(), /usc-auth-page/);
await act(async () => tree.unmount());
globalThis.__uscAuthUser = { id: "u" };
await mount(login.LoginPage, auth.uscAuthPath("anmelden", returnTo));
assert.equal(tree.root.findByType("output").children.join(""), returnTo);
await act(async () => tree.unmount());
globalThis.__uscAuthUser = null;
const event = {
  id: "authorized-event",
  match_id: "authorized-match",
  team_season_id: "km",
};
for (const path of [
  "/app/events/authorized-event",
  "/app/live?matchId=authorized-match",
  "/app/live/authorized-match",
]) {
  const href = links.uscEventLink(path, [event], "km");
  assert.equal(
    new URL(href, "https://club.invalid").searchParams.get("event"),
    event.id,
  );
  assert.ok(href.startsWith(root + "?"));
}
assert.equal(
  links.uscEventLink("/app/events/foreign-event", [event], "km"),
  null,
);
assert.equal(
  links.uscEventLink("/app/events/authorized-event", [event], "res"),
  null,
);
assert.equal(
  links.uscEventLink(
    "https://evil.test/app/events/authorized-event",
    [event],
    "km",
  ),
  null,
);
const RecoveryGate=()=>useLocation().pathname==='/app/set-password'?React.createElement(required.RequireAuth,null,React.createElement('span',null,'Recovery')):null;
await mount(
  RecoveryGate,
  "/app/set-password?next=" + encodeURIComponent(returnTo),
);
assert.equal(
  tree.root.findByType("output").children.join(""),
  auth.uscAuthPath("anmelden", returnTo),
);
await act(async () => tree.unmount());
window.location.hash = "#type=recovery";
await mount(
  setPassword.SetPasswordPage,
  "/app/set-password?next=" + encodeURIComponent(returnTo),
);
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 75));
});
assert.match(json(), /Passwort festlegen/);
assert.match(json(), /USC Kaschütz Rohrbach/);
await change("set-password", "fixture-password");
await change("set-password-confirm", "fixture-password");
await act(async () =>
  tree.root.findByType("form").props.onSubmit({ preventDefault() {} }),
);
assert.ok(globalThis.__uscAuthCalls.some((c) => c[0] === "update"));
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 850));
});
assert.equal(tree.root.findByType("output").children.join(""), returnTo);
await act(async () => tree.unmount());
window.location.hash = "";
console.log(
  "PASS USC auth: original sign-in used, return to club/team retained, signup/reset/login branding and links, recovery callback preserved, signed-in return, generic login/demo unchanged, external/foreign game targets rejected.",
);
// Vereinsmarkt reuses the same auth while preserving club, listing and recovery context.
const marketClub='3db6fce2-a4c1-44a5-a333-19d1d4d62e6a';
const marketNext='/vereinsmarkt/'+marketClub+'?view=member&club='+marketClub+'&listing=fixture';
const marketQuery=new URLSearchParams({context:'vereinsmarkt',marketClub,next:marketNext}).toString();
globalThis.__uscAuthUser=null;
await mount(login.LoginPage,'/vereinsmarkt/'+marketClub+'/anmelden?'+marketQuery);
assert.match(json(),/Willkommen im Vereinsmarkt/);assert.match(json(),/market-auth-brand/);
assert.doesNotMatch(json(),/Demo ohne Login|Spieler-Login/);
assert.ok(hrefs().includes('/vereinsmarkt/'+marketClub));
assert.ok(hrefs().includes('/vereinsmarkt/'+marketClub+'/registrieren?'+marketQuery));assert.ok(hrefs().includes('/vereinsmarkt/'+marketClub+'/passwort-vergessen?'+marketQuery));
await change('login-email','market@example.test');await change('login-password','fixture-password');
await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
assert.equal(tree.root.findByType('output').children.join(''),marketNext);await act(async()=>tree.unmount());
await mount(register.RegisterPage,'/vereinsmarkt/'+marketClub+'/registrieren?'+marketQuery);assert.match(json(),/Für den Vereinsmarkt registrieren/);assert.ok(hrefs().includes('/vereinsmarkt/'+marketClub+'/anmelden?'+marketQuery));await act(async()=>tree.unmount());
await mount(forgot.ForgotPasswordPage,'/vereinsmarkt/'+marketClub+'/passwort-vergessen?'+marketQuery);assert.match(json(),/market-auth-brand/);assert.ok(hrefs().includes('/vereinsmarkt/'+marketClub+'/anmelden?'+marketQuery));await change('forgot-email','market@example.test');await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
const marketReset=globalThis.__uscAuthCalls.filter(c=>c[0]==='reset').at(-1);assert.equal(new URL(marketReset[2].redirectTo).searchParams.get('next'),marketNext);await act(async()=>tree.unmount());
window.location.hash='#type=recovery';
await mount(setPassword.SetPasswordPage,'/app/set-password?'+marketQuery);
await act(async()=>{await new Promise(resolve=>setTimeout(resolve,75));});
assert.match(json(),/market-auth-page market-auth-recovery/);assert.match(json(),/market-auth-card/);assert.match(json(),/market-auth-brand/);
await change('set-password','fixture-password');await change('set-password-confirm','fixture-password');
await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
await act(async()=>{await new Promise(resolve=>setTimeout(resolve,850));});
assert.equal(tree.root.findByType('output').children.join(''),marketNext);await act(async()=>tree.unmount());window.location.hash='';
console.log('PASS Vereinsmarkt: own auth brand, no player/demo controls, safe market back link, signup/reset continuity, original sign-in and selected listing retained.');

const marketHelpers=mods.at(-1);
for(const target of ['https://evil.test/app/tauschboerse','//evil.test/app/tauschboerse','/app/tauschboerse/../../manager','/manager']){const c=marketHelpers.marketAuthContext('?context=vereinsmarkt&next='+encodeURIComponent(target));assert.ok(c.next===('/vereinsmarkt/'+marketClub+'?view=start'));}
assert.equal(marketHelpers.marketAuthContext('?next=/manager'),null);
console.log('PASS: marketplace presentation helper rejects external, traversal and unrelated return paths');

const migrated=marketHelpers.marketAuthContext('?context=vereinsmarkt&next='+encodeURIComponent('/app/tauschboerse?club='+marketClub+'&listing=fixture'));assert.equal(new URL(migrated.next,'https://test.invalid').pathname,'/vereinsmarkt/'+marketClub);assert.equal(new URL(migrated.next,'https://test.invalid').searchParams.get('listing'),'fixture');

globalThis.__uscAuthUser={id:'existing-market-user'};await mount(login.LoginPage,'/vereinsmarkt/'+marketClub+'/anmelden?'+marketQuery);assert.equal(tree.root.findByType('output').children.join(''),marketNext);await act(async()=>tree.unmount());globalThis.__uscAuthUser=null;console.log('PASS: existing marketplace session returns directly to public shell');
