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
    'export const useTeamFeedPosts=(id,team,opts)=>{if(!opts.skipEnsures)throw Error("Club app must not generate posts");globalThis.__uscFeedScope=opts.teamSeasonIds;globalThis.__uscChronicle=opts.chronicleView;return {activePosts:globalThis.__uscFixture.posts??(opts.teamSeasonIds??[id]).map((sid,i)=>({kind:"image",post:{id:i?"reserve-post":"real-post",team_season_id:sid,created_at:i?"2026-11-08T12:00:00Z":"2026-11-06T12:00:00Z"}})),loading:false,error:null,refetch(){}}};',

  usePlayers:
    "export const usePlayers=(id)=>({players:globalThis.__uscFixture.players?.[id]??[],loading:false,error:null});",
  useTeamStaff:
    'export const useTeamStaff=(id)=>({staff:globalThis.__uscFixture.staff?.[id]??[],loading:false,error:null});export const staffDisplayName=()=>"Trainer";export const staffRoleLabelDe=()=>"Trainer";',
  supabaseClient: `export const supabase={from:table=>{globalThis.__uscReadCalls.push(table);const q={select:()=>q,eq:()=>q,in:()=>q,maybeSingle:()=>Promise.resolve({data:null,error:null}),then:fn=>Promise.resolve({data:table==='matches'?[{id:'m-old',status:'finished',score_home:4,score_away:0}]:[],error:null}).then(fn)};return q;}};`,
  HomeFeedPostRenderer:
    'import React from "react";export const HomeFeedPostRenderer=({item})=>React.createElement("article",null,"Vorhandener USC-Beitrag "+item.post.id);',
  PlayerProfileModal: "export const PlayerProfileModal=(props)=>{globalThis.__uscProfile=props;return null;};",
  ProfileHeroCard: "export const ProfileHeroCard=()=>null;",
  OefbCompetitionTable:
    'import React from "react";export const OefbCompetitionTable=({teamSeasonId})=>React.createElement("section",null,"Tabelle "+teamSeasonId);',
  MatchCardGameCore:'import React from "react";export const MatchCardGameCore=({leftName,rightName,timeDisplay})=>React.createElement("div",null,leftName," ",timeDisplay," ",rightName);',
  TeamHeroFrame:'import React from "react";export const TeamHeroFrame=({children})=>React.createElement("section",null,children);',
  TeamSquadShowcase:'import React from "react";export const TeamSquadShowcase=(props)=>{globalThis.__uscSquad=props;const {players,onPlayerClick}=props;return React.createElement("section",{"aria-label":"Spieler-Karussell"},players.map(p=>React.createElement("button",{key:p.id,onClick:()=>onPlayerClick(p)},p.display_name)));};',
  TeamTrainerShowcase:'import React from "react";export const TeamTrainerShowcase=(props)=>{globalThis.__uscTrainers=props;return React.createElement("section",{"aria-label":"Trainer-Karussell"});};',
  PastMatchResultCard:'import React from "react";export const PastMatchResultCard=({ev,scoreHome,scoreAway,onNavigate})=>React.createElement("button",{onClick:onNavigate},ev.opponent.replace(/\\s*-\\s*/g,"-")," ",scoreHome+":"+scoreAway);',
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
              /AuthProvider$|useUscClub$|useEvents$|useTeamFeedPosts$|usePlayers$|useTeamStaff$|supabaseClient$|HomeFeedPostRenderer$|PlayerProfileModal$|ProfileHeroCard$|OefbCompetitionTable$|oefbTableSettings$|UscMatchReport$|MatchCardGameCore$|TeamHeroFrame$|TeamSquadShowcase$|TeamTrainerShowcase$|PastMatchResultCard$/,
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
assert.match(html(), /reserve-post/);
assert.deepEqual(globalThis.__uscFeedScope, ["km", "res"]);
assert.equal(globalThis.__uscChronicle,true);
assert.ok(html().indexOf("reserve-post") < html().indexOf("real-post"), "club feed orders newest first across teams");
assert.doesNotMatch(html(), /Mannschaft wählen|Mannschaftsfoto|Unser Verein. Unser Team.|Nächstes Spiel|Kampfmannschaft/);
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
  tree.root.findAllByType("button").find((b) => b.props["aria-label"] === "Reserve · 2026/27").props.onClick(),
);
assert.match(html(), /Reserve/);
await act(async () => tree.unmount());
fixtures.posts=[
  {kind:"image",post:{id:"foreign",team_season_id:"other-club",created_at:"2099-01-01T00:00:00Z"}},
  {kind:"image",post:{id:"reserve-new",team_season_id:"res",created_at:"2026-11-09T10:00:00Z"}},
  {kind:"image",post:{id:"km-old",team_season_id:"km",created_at:"2026-11-08T10:00:00Z"}},
  {kind:"image",post:{id:"km-old",team_season_id:"km",created_at:"2026-11-08T10:00:00Z"}},
];
await mount("/app/usc-rohrbach?teamSeason=res");
assert.deepEqual(globalThis.__uscFeedScope,["km","res"]);
assert.match(html(), /reserve-new/);assert.match(html(), /km-old/);assert.doesNotMatch(html(), /foreign/);
assert.equal(tree.root.findAllByType("article").length,2, "same post occurs only once");
fixtures.events.push({id:"party",team_season_id:"res",type:"event",kind:"event",opponent:"4 Seasons",starts_at:"2026-11-15T18:00:00Z",location:"Sportplatz",status:"upcoming",notes:"Vereinsveranstaltung"});
let followed = false;
await act(async()=>tree.root.findByProps({"aria-label":"Vereinsnews"}).props.onClickCapture({button:0,preventDefault(){followed=true;},target:{closest:()=>({getAttribute:name=>name==="href"?"/app/events/party":null,hasAttribute:()=>false})}}));
assert.equal(followed,true);
assert.match(html(), /4 Seasons/);
assert.match(html(), /Vereinsveranstaltung/);
assert.doesNotMatch(html(), /Gegner noch offen/);
assert.ok(tree.root.findByProps({"aria-label":"Termindetails"}));
assert.ok(tree.root.findByProps({"aria-label":"Vereinsnews"}), "event opens in Home instead of changing to match schedule");
fixtures.events.pop();

assert.doesNotMatch(html(), /Mannschaft wählen|Mannschaftsfoto|Nächstes Spiel/);
await act(async()=>tree.unmount());
delete fixtures.posts;
await mount("/app/usc-rohrbach?tab=tabelle");
assert.match(html(), /Tabelle km/);
await act(async () => tree.unmount());
fixtures.players = {km:[
  {id:"p4",display_name:"Josef Gradinger",first_name:"Josef",last_name:"Gradinger",jersey_number:4,status:"active",photo_layout:{brightness:120}},
  {id:"p2",display_name:"Leonidas Rotteneder",first_name:"Leonidas",last_name:"Rotteneder",jersey_number:2,status:"active"},
  {id:"paused",display_name:"Pausiert",status:"paused"}
],res:[]};
fixtures.staff = {km:[{user_id:"coach",role:"head_coach",first_name:"Trainer",last_name:"USC"}],res:[]};
await mount("/app/usc-rohrbach?tab=teams");
assert.deepEqual(globalThis.__uscSquad.players.map(p=>p.id),["p2","p4"]);
assert.equal(globalThis.__uscSquad.players[1].photo_layout.brightness,120);
await act(async()=>globalThis.__uscSquad.onPlayerClick(fixtures.players.km[0]));
assert.equal(globalThis.__uscProfile.player.id,"p4");
assert.equal(globalThis.__uscProfile.teamSeasonId,"km");
assert.equal(globalThis.__uscProfile.canManage,false);
await act(async()=>globalThis.__uscSquad.onTrainerSelect(0));
assert.equal(globalThis.__uscTrainers.trainers[0].user_id,"coach");
await click("Reserve · 2026/27");
assert.equal(globalThis.__uscSquad.players.length,0);
assert.match(html(), /RES/);
await click("Spiele");
await click("Zur Tabelle ");
assert.match(html(), /Tabelle res/);
await act(async()=>tree.unmount());
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
  "PASS USC club news: combined authorized seasons, newest first, no team picker/hero, foreign posts excluded and duplicates removed. USC club app: club/active-season isolation, real feed reuse without ensures, score home/away order, future/past filters, team switching, table scope, signed-out data gate, login return link and installable original-crest PNG icons.",
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
