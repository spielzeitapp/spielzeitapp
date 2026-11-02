import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
async function load(entry){const r=await build({entryPoints:[entry],bundle:true,platform:'node',define:{'import.meta.env.BASE_URL':'"/"'},format:'cjs',packages:'external',write:false,plugins:[{name:'demo-fixture',setup(b){b.onResolve({filter:/DemoContext$/},()=>({path:'demo',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useDemoMode = () => null;',loader:'js'}));}}]});const m={exports:{}};new Function('require','module','exports',r.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {TeamSquadShowcase,playerMedia}=await load('src/components/team/TeamSquadShowcase.tsx');
const {ProfileHeroCard}=await load('src/components/team/profile/ProfileHeroCard.tsx');
const original='https://vereine.oefb.at/netzwerk/imagedownload/670725461856634215_1946784381171732381-80-80-KuMLNQuJ.jpg';
for(const prepared of [false,true]){
 const url=prepared?original:'https://vereine.oefb.at/netzwerk/imagedownload/synthetic-80-80.jpeg';
 const player={id:'fixture',first_name:'Test',last_name:'Portrait',jersey_number:3,avatar_url:url};
 let root;await act(async()=>{root=create(React.createElement(TeamSquadShowcase,{players:[player],ownPlayerIds:new Set(),onPlayerClick(){}}));});
 const number=root.root.find(n=>n.props['aria-label']==='Rückennummer 3');assert.equal(number.children.join(''),'3');assert.ok(number.props.className.includes('top-4'));
 const card=root.root.find(n=>n.props['data-showcase-card']!==undefined);
 const img=card.findAllByType('img').find(n=>n.props.src===playerMedia(player,false).src);assert.equal(img.props.style.objectFit,'contain');
 if(prepared)assert.ok(card.findAllByType('div').some(n=>n.props['data-portrait-background']==='clean'));
 else assert.ok(card.findAllByType('div').some(n=>n.props.className?.includes('pl-[28%]')));
 await act(async()=>root.unmount());
 await act(async()=>{root=create(React.createElement(ProfileHeroCard,{variant:'player',watermark:'3',firstNameLine:'Test',lastNameLine:'Portrait',teamSeasonLabel:'SC Melk FR · U16 · 2026/27',photoUrl:url,teamLogoUrl:'/wrong-logo.png',initials:'TP'}));});
 assert.ok(!root.root.findAllByType('img').some(n=>n.props.src.includes('stadium')));
 if(prepared)assert.ok(root.root.findAllByType('div').some(n=>n.props['data-portrait-background']==='clean'));
 const images=root.root.findAllByType('img');assert.ok(!images.some(n=>n.props.src==='/wrong-logo.png'));assert.equal(images.find(n=>n.props.style?.objectFit).props.style.objectFit,'contain');
 assert.ok(root.root.findAllByType('span').some(n=>n.children.join('')==='3' && n.props.className?.includes('top-4')));
 await act(async()=>root.unmount());
}
console.log('PASS: imported originals remain uncropped, names reserve the Melk text column, number is top-right without #, prepared portrait uses clean club background, no extra crest.');
