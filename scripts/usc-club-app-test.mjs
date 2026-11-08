import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  React = require("react"),
  { act, create } = require("react-test-renderer"),
  { MemoryRouter } = require("react-router-dom");
const season = {
  id: "km",
  team_id: "team",
  age_group: "KM",
  status: "active",
  team: {
    name: "USC Rohrbach",
    club_id: "3db6fce2-a4c1-44a5-a333-19d1d4d62e6a",
  },
  season: { name: "2026/27" },
};
const fixtures = {
  seasons: [season, { ...season, id: "res", age_group: "RES" }],
  events: [
    {
      id: "old",
      team_season_id: "km",
      type: "game",
      kind: "match",
      opponent: "Ober - Grafendorf",
      is_home: false,
      starts_at: "2026-11-06T18:30:00Z",
      status: "finished",
      match_type: "league",
      match_id: "m-old",
      location: "Arena",
    },
    {
      id: "next",
      team_season_id: "km",
      type: "game",
      kind: "match",
      opponent: "Wilhelmsburg",
      is_home: false,
      starts_at: "2099-01-24T12:00:00Z",
      status: "upcoming",
      match_type: "friendly",
      match_id: "m-next",
      location: "Sportplatz",
    },
  ],
};
globalThis.fetch = async () => ({ ok: false });
globalThis.__uscFixture = fixtures;
globalThis.__uscUser = { id: "authorized-user" };
globalThis.__uscReadCalls = [];
const mocks = {
  AuthProvider:
    "export const useAuth=()=>({user:globalThis.__uscUser,loading:false});",
  useUscClub:
    "export const useUscClub=()=>({seasons:globalThis.__uscFixture.seasons,loading:false,error:null,retry(){}});",
  useEvents:
    "export const useEvents=()=>({events:globalThis.__uscFixture.events,loading:false,error:null,refetch(){}});",
  useTeamFeedPosts:
    'export const useTeamFeedPosts=(id,team,opts)=>{if(!opts.skipEnsures)throw Error("Club app must not generate posts");return {activePosts:[{post:{id:"real-post",team_season_id:id}}],loading:false,error:null,refetch(){}}};',
  usePlayers:
    "export const usePlayers=()=>({players:[],loading:false,error:null});",
  useTeamStaff:
    'export const useTeamStaff=()=>({staff:[],loading:false,error:null});export const staffDisplayName=()=>"Trainer";export const staffRoleLabelDe=()=>"Trainer";',
  supabaseClient: `export const supabase={from:table=>{globalThis.__uscReadCalls.push(table);const q={select:()=>q,eq:()=>q,in:()=>q,maybeSingle:()=>Promise.resolve({data:null,error:null}),then:fn=>Promise.resolve({data:table==='matches'?[{id:'m-old',status:'finished',score_home:4,score_away:0}]:[],error:null}).then(fn)};return q;}};`,
  HomeFeedPostRenderer:
    'import React from "react";export const HomeFeedPostRenderer=({item})=>React.createElement("article",null,"Vorhandener USC-Beitrag "+item.post.id);',
  PlayerProfileModal: "export const PlayerProfileModal=()=>null;",
  ProfileHeroCard: "export const ProfileHeroCard=()=>null;",
  OefbCompetitionTable:
    'import React from "react";export const OefbCompetitionTable=({teamSeasonId})=>React.createElement("section",null,"Tabelle "+teamSeasonId);',
  UscMatchReport:'export const UscMatchReport=()=>null;',
  oefbTableSettings:
    'export const getOefbTableSettings=async()=>({data:{competitionId:"",sourceUrl:"https://vereine.oefb.at/USCRohrbach/Mannschaften/Saison-2026-27/KM/Tabellen/",teamName:"Rohrbach / Gölsen"},error:null});',
};
const b = await build({
  entryPoints: [
    "src/features/club/UscClubApp.tsx",
    "src/features/club/uscClub.ts",
  ],
  outdir: "out",
  bundle: true,
  format: "cjs",
  platform: "node",
  packages: "external",
  write: false,
  define: { "import.meta.env": "{}" },
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "fixtures",
      setup(b) {
        b.onResolve({ filter: /^react$/ }, () => ({
          path: "react",
          external: true,
        }));
        b.onResolve(
          {
            filter:
              /AuthProvider$|useUscClub$|useEvents$|useTeamFeedPosts$|usePlayers$|useTeamStaff$|supabaseClient$|HomeFeedPostRenderer$|PlayerProfileModal$|ProfileHeroCard$|OefbCompetitionTable$|oefbTableSettings$|UscMatchReport$/,
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
const modules = b.outputFiles.map((f) => {
  const m = { exports: {} };
  new Function("require", "module", "exports", f.text)(require, m, m.exports);
  return m.exports;
});
const { UscClubApp: App } = modules[0],
  config = modules[1];
assert.equal(config.isUscAppPath("/app/usc-rohrbach"), true);
assert.equal(config.isUscAppPath("/app/usc-rohrbach-copy"), false);
assert.equal(config.clubTab("tabelle"), "tabelle");
assert.deepEqual(
  config
    .sortClubSeasons([
      { ...season, id: "other", team: { club_id: "other" } },
      { ...season, id: "archive", status: "archived" },
      { ...season, id: "res", age_group: "RES" },
      season,
    ])
    .map((x) => x.id),
  ["km", "res"],
);
let tree;
const html = () => JSON.stringify(tree.toJSON());
const mount = async (path) => {
  await act(async () => {
    tree = create(
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(App),
      ),
      {
        createNodeMock: (e) =>
          e.type === "dialog" ? { showModal() {}, close() {} } : null,
      },
    );
  });
};
const click = async (label) => {
  const btn = tree.root
    .findAllByType("button")
    .find((b) => b.props["aria-label"] === label || b.children.some((c) => c === label));
  assert.ok(btn, label);
  await act(async () => btn.props.onClick());
};
globalThis.document = { querySelector: () => null };
await mount("/app/usc-rohrbach");
assert.match(html(), /Vorhandener USC-Beitrag real-post/);
assert.match(html(), /Wilhelmsburg/);
assert.match(html(), /Kampfmannschaft/);
await click("Spiele");
assert.match(html(), /Ober-Grafendorf/);
assert.match(html(), /4:0/);
await click("kommende");
assert.doesNotMatch(html(), /Ober-Grafendorf/);
assert.match(html(), /Wilhelmsburg/);
await click("vergangene");
assert.match(html(), /Ober-Grafendorf/);
assert.doesNotMatch(html(), /Wilhelmsburg/);
await act(async () =>
  tree.root.findByType("select").props.onChange({ target: { value: "res" } }),
);
assert.match(html(), /Reserve/);
await act(async () => tree.unmount());
await mount("/app/usc-rohrbach?tab=tabelle");
assert.match(html(), /Tabelle km/);
await act(async () => tree.unmount());
globalThis.__uscUser = null;
globalThis.__uscReadCalls = [];
await mount("/app/usc-rohrbach");
assert.match(html(), /Beim USC Rohrbach anmelden/);
assert.doesNotMatch(html(), /Vorhandener USC-Beitrag/);
assert.deepEqual(globalThis.__uscReadCalls, []);
assert.ok(
  tree.root
    .findAllByType("a")
    .some((a) => a.props.href.includes("/anmelden?next=")),
);
await act(async () => tree.unmount());
const manifest = JSON.parse(
  await readFile("public/clubs/usc-rohrbach/manifest.json", "utf8"),
);
assert.equal(manifest.id, "/app/usc-rohrbach");
assert.equal(manifest.start_url, manifest.id);
assert.equal(manifest.display, "standalone");
for (const icon of manifest.icons) {
  const bytes = await readFile("public" + icon.src);
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
}
console.log(
  "PASS USC club app: club/active-season isolation, real feed reuse without ensures, score home/away order, future/past filters, team switching, table scope, signed-out data gate, login return link and installable original-crest PNG icons.",
);
const metaBuild = await build({
  entryPoints: ["src/app/ManifestSync.tsx"],
  bundle: true,
  format: "cjs",
  platform: "node",
  packages: "external",
  write: false,
});
const metaModule = { exports: {} };
new Function("require", "module", "exports", metaBuild.outputFiles[0].text)(
  require,
  metaModule,
  metaModule.exports,
);
let manifestLink = {
    href: "",
    getAttribute() {
      return this.href;
    },
  },
  icon = { href: "" },
  appleTitle = { content: "" };
globalThis.window = { __HOST_IS_INTERNAL__: true };
globalThis.document = {
  title: "SpielzeitApp",
  getElementById: () => manifestLink,
  querySelector: (selector) =>
    selector.includes("apple-touch")
      ? icon
      : selector.includes("apple-mobile")
        ? appleTitle
        : null,
};
for (const [path, expected, title] of [
  ["/app/usc-rohrbach", "/clubs/usc-rohrbach/manifest.json", "USC Rohrbach"],
  [
    "/login?next=%2Fapp%2Fusc-rohrbach",
    "/clubs/usc-rohrbach/manifest.json",
    "USC Rohrbach",
  ],
  ["/app/home", "/manifest-trainer.json", "SpielzeitApp"],
  ["/manager", "/manifest-manager.json", "Spielzeit Manager"],
  ["/demo/home", "/manifest-demo.json", "Spielzeit Demo"],
]) {
  await act(async () => {
    tree = create(
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(metaModule.exports.ManifestSync),
      ),
    );
  });
  assert.equal(manifestLink.href, expected);
  assert.equal(appleTitle.content, title);
  assert.equal(
    icon.href,
    path.startsWith("/manager")
      ? "/manager-apple-touch-icon.png"
      : title === "USC Rohrbach"
        ? "/clubs/usc-rohrbach/icon-180.png"
        : "/apple-touch-icon.png",
  );
  await act(async () => tree.unmount());
}
console.log(
  "PASS route metadata: USC icon survives login return URL, standard/manager/demo installation branding restored after leaving.",
);
