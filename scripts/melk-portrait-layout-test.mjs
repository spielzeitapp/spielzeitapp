import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
async function load(entry){const r=await build({entryPoints:[entry],bundle:true,platform:'node',define:{'import.meta.env.BASE_URL':'"/"'},format:'cjs',packages:'external',write:false,plugins:[{name:'demo-fixture',setup(b){b.onResolve({filter:/DemoContext$/},()=>({path:'demo',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useDemoMode = () => null;',loader:'js'}));}}]});const m={exports:{}};new Function('require','module','exports',r.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {TeamSquadShowcase,playerMedia}=await load('src/components/team/TeamSquadShowcase.tsx');
const {ProfileHeroCard}=await load('src/components/team/profile/ProfileHeroCard.tsx');
const original='https://vereine.oefb.at/netzwerk/imagedownload/670725461856634215_1946784381171732381-80-80-KuMLNQuJ.jpg';
for(const prepared of [false,true,'uploaded']){
 const url=prepared==='uploaded'?'/profile/melk-luisa-canva-v1.jpg':prepared?original:'https://vereine.oefb.at/netzwerk/imagedownload/synthetic-80-80.jpeg';
 const player={id:'fixture',first_name:'Test',last_name:'Portrait',jersey_number:3,avatar_url:url};
 let root;await act(async()=>{root=create(React.createElement(TeamSquadShowcase,{players:[player],ownPlayerIds:new Set(),onPlayerClick(){}}));});
 if(prepared==='uploaded'){const image=root.root.findByType('ul').findByType('img');assert.ok(image.props.className.includes('object-contain'));assert.ok(!image.props.className.includes('scale-'));await act(async()=>root.unmount());continue;}
 const number=root.root.find(n=>n.props['aria-label']==='Rückennummer 3');assert.equal(number.children.join(''),'3');assert.ok(number.props.className.includes('top-4'));
 const rowImage=root.root.findByType('ul').findByType('img');
 if(prepared){assert.ok(rowImage.props.className.includes('object-contain'));assert.ok(!rowImage.props.className.includes('scale-'));}
 const card=root.root.find(n=>n.props['data-showcase-card']!==undefined);
 const img=card.findAllByType('img').find(n=>n.props.src===playerMedia(player,false).src);assert.equal(img.props.style.objectFit,'contain');
 if(prepared===true)assert.ok(card.findAllByType('div').some(n=>n.props['data-portrait-background']==='clean'));
 else if(!prepared)assert.ok(card.findAllByType('div').some(n=>n.props.className?.includes('pl-[28%]')));
 await act(async()=>root.unmount());
 await act(async()=>{root=create(React.createElement(ProfileHeroCard,{variant:'player',photoLayout:{background:'blue-left',source:'original',zoom:100,x:50,y:50,nameX:28,nameY:85,numberX:88,numberY:8,numberSize:44},watermark:'3',firstNameLine:'Test',lastNameLine:'Portrait',teamSeasonLabel:'SC Melk FR · U16 · 2026/27',photoUrl:url,teamLogoUrl:'/wrong-logo.png',initials:'TP'}));});
 assert.ok(!root.root.findAllByType('img').some(n=>n.props.src.includes('stadium')));
 if(prepared===true)assert.ok(root.root.findAllByType('img').some(n=>n.props.src.includes('melk-portrait-9755193-v1.webp')));
 const images=root.root.findAllByType('img');assert.ok(!images.some(n=>n.props.src==='/wrong-logo.png'));assert.equal(images.find(n=>n.props.style?.objectFit).props.style.objectFit,'contain');
 assert.ok(root.root.findAllByType('span').some(n=>n.children.join('')==='3' && n.props.style?.left==='88%' && n.props.style?.top==='8%'));
 await act(async()=>root.unmount());
}
console.log('PASS: imported originals remain uncropped, names reserve the Melk text column, number is top-right without #, prepared portrait uses clean club background, no extra crest.');
// Saved Manager settings must be rendered without the extra trainer composition.
const {PlayerPortraitCanvas}=await load('src/components/team/PlayerPortraitCanvas.tsx');
const layout={background:'blue-left',source:'original',zoom:100,x:50,y:50,nameX:28,nameY:85,numberX:88,numberY:8,numberSize:44};
let root;
await act(async()=>{root=create(React.createElement(ProfileHeroCard,{variant:'player',photoLayout:layout,watermark:'12',firstNameLine:'Test',lastNameLine:'Portrait',teamSeasonLabel:'SC Melk FR · U16 · 2026/27',photoUrl:'https://vereine.oefb.at/netzwerk/imagedownload/synthetic-80-80.jpeg',cutoutUrl:'/unused-cutout.png',teamLogoUrl:'/no-extra-logo.png',initials:'TP'}));});
assert.ok(root.root.findByProps({'data-profile-artwork':'player-canvas'}));
assert.equal(root.root.findAllByType('img').length,1,'No duplicated crest or background image');
assert.ok(root.root.findByType('img').props.className.includes('object-contain'));
assert.equal(root.root.findByType('img').props.style.opacity,0,'Partial image stays hidden until fully loaded');
await act(async()=>root.root.findByType('img').props.onLoad());
assert.equal(root.root.findByType('img').props.style.opacity,1);
assert.equal(root.root.findByType('img').props.fetchPriority,'high');
assert.equal(root.root.findAllByType('span').find(n=>n.props.style?.fontSize).props.style.fontSize,'44px');
await act(async()=>root.unmount());
await act(async()=>{root=create(React.createElement(PlayerPortraitCanvas,{layout,photoUrl:'/first.jpg',firstName:'First',lastName:'Player',eager:false}));});
assert.equal(root.root.findByType('img').props.loading,'lazy');
await act(async()=>root.root.findByType('img').props.onLoad());
await act(async()=>root.update(React.createElement(PlayerPortraitCanvas,{layout,photoUrl:'/second.jpg',firstName:'Second',lastName:'Player',eager:false})));
assert.equal(root.root.findByType('img').props.style.opacity,0,'New source cannot reuse previous loaded state');
await act(async()=>root.unmount());
console.log('PASS: saved Melk layout uses shared canvas, no duplicate crest/watermark, original source wins, full-image loading and changed-source reset.');

const {defaultClubProfileDesign}=await load('src/lib/clubProfileDesign.ts');
const shared=defaultClubProfileDesign('square');shared.name.size=11;
const individual=structuredClone(shared);individual.name.size=8;
for(const override of [undefined,individual]){
 const member={id:'design-fixture',first_name:'Test',last_name:'Player',jersey_number:6,avatar_url:'/portrait.jpg',club_profile_design:shared,photo_layout:{...layout,profileDesign:override}};
 await act(async()=>root=create(React.createElement(TeamSquadShowcase,{players:[member],ownPlayerIds:new Set(),onPlayerClick(){},teamName:'SC Melk',teamSeasonLabel:'U16 · 2026/27',teamLogoUrl:'/club.png'})));
 assert.equal(root.root.findByProps({'data-profile-element':'name'}).props.style.fontSize,override?'8cqw':'11cqw','Carousel uses the same team/player element design as profile preview');
 await act(async()=>root.unmount());
}
console.log('PASS carousel: shared team design and individual precedence.');
