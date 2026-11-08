import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  React = require("react"),
  { act, create } = require("react-test-renderer"),
  { MemoryRouter, useLocation } = require("react-router-dom");
const store = new Map();
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
