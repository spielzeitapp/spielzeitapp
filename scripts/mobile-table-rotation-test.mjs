import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
async function bundle(path){const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,define:{'import.meta.env.BASE_URL':'"/"'}});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {CompetitionStandingsTable}=await bundle('src/components/schedule/CompetitionStandingsTable.tsx');
let root;await act(async()=>{root=create(React.createElement(CompetitionStandingsTable,{ourTeam:'Rohrbach',rows:[{rank:13,team:'Rohrbach/Gölsen',logo:null,played:13,won:2,drawn:0,lost:11,goalsFor:12,goalsAgainst:39,goalDifference:-27,points:6}]}));});
assert.deepEqual(root.root.findByType('thead').findAllByType('th').map(n=>n.children.join('')),['#','Mannschaft','Sp','Pkt','+/−','S','U','N','Tore']);
const cells=root.root.findByType('tbody').findAllByType('td');assert.equal(cells[2].children[0],'6');assert.equal(cells[3].children.join(''),'-27');assert.equal(cells.at(-1).children.join(''),'12:39');assert.match(root.root.findByType('table').props.className,/text-base/);assert.equal(root.root.findByProps({role:'region'}).props.tabIndex,0);await act(async()=>root.unmount());
const {PlayerPortraitCanvas}=await bundle('src/components/team/PlayerPortraitCanvas.tsx');
const layout={background:'black',source:'original',zoom:95,x:55,y:50,nameX:28,nameY:85,numberX:88,numberY:8};
for(const rotation of [undefined,0,90,180,270]){await act(async()=>{root=create(React.createElement(PlayerPortraitCanvas,{layout:{...layout,rotation},photoUrl:'https://example.test/original.jpg',firstName:'Christian',lastName:'Plank',number:1}));});assert.match(root.root.findByType('img').props.style.transform,new RegExp(`rotate\\(${rotation??0}deg\\)`));assert.equal(root.root.findByType('img').props.src,'https://example.test/original.jpg');assert.ok(!root.root.findAllByType('span').some(n=>String(n.props.style?.transform).includes('rotate')),'number remains upright');await act(async()=>root.unmount());}
console.log('PASS large table column/data mapping, accessible scrolling and original-photo-only rotation across all quarter turns.');
