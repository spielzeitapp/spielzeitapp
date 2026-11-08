import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{create,act}=require('react-test-renderer');
async function bundle(path){const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',packages:'external',write:false});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {validPortraitOutline,outlinePortrait}=await bundle('src/lib/portraitRetouch.ts');
const polygon=[{x:.1,y:.1},{x:.8,y:.1},{x:.8,y:.9},{x:.1,y:.9}];
assert(validPortraitOutline(polygon));assert(!validPortraitOutline(polygon.slice(0,2)));assert(!validPortraitOutline([{x:0,y:0},{x:.5,y:.5},{x:1,y:1}]));assert(!validPortraitOutline([{x:NaN,y:0},...polygon]));
let operations=[];
function context(){return {lineWidth:1,globalCompositeOperation:'source-over',save(){operations.push(['save']);},restore(){operations.push(['restore']);},beginPath(){operations.push(['path']);},closePath(){operations.push(['close']);},moveTo(x,y){operations.push(['move',x,y]);},lineTo(x,y){operations.push(['line',x,y]);},arc(){},fill(){},stroke(){},clip(){operations.push(['clip']);},clearRect(){operations.push(['clear']);},drawImage(source){operations.push(['draw',source]);},translate(){},rotate(){}};}
const original={id:'original'};outlinePortrait(context(),polygon,1000,600,original);
assert.equal(operations.findIndex(x=>x[0]==='clear'),1);const clip=operations.findIndex(x=>x[0]==='clip');assert.equal(operations[clip-1][0],'close');assert.deepEqual(operations[clip+1],['draw',original]);
operations=[];outlinePortrait(context(),polygon.slice(0,2),1000,600,original);assert.equal(operations.length,0,'invalid contour never clears the photo');
const old={fetch:globalThis.fetch,bitmap:globalThis.createImageBitmap,document:globalThis.document};let fetches=0,applied=[];
globalThis.fetch=async()=>{fetches++;return {ok:true,blob:async()=>new Blob(['photo'],{type:'image/png'})};};
globalThis.createImageBitmap=async()=>({width:1000,height:600,close(){}});
function makeCanvas(){return {width:1000,height:600,getContext:()=>context(),getBoundingClientRect:()=>({left:0,top:0,width:500,height:300}),setPointerCapture(){},toBlob(cb,type){cb(new Blob(['result'],{type}));}};}
const canvas=makeCanvas(),guide=makeCanvas();globalThis.document={activeElement:{focus(){}},createElement:makeCanvas};
const {PortraitCutoutRetouch}=await bundle('src/manager/PortraitCutoutRetouch.tsx');let root;
const btn=text=>root.root.findAllByType('button').find(n=>n.children.join('')===text);
const edit=()=>root.root.findByProps({'data-portrait-editor-canvas':'true'});
const e=(x,y)=>({button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y,currentTarget:canvas,preventDefault(){}});
try{
 await act(async()=>{root=create(React.createElement(PortraitCutoutRetouch,{source:'https://example.test/original.jpg',originalSource:'https://example.test/original.jpg',sourceIsOriginal:true,initialMode:'outline',onApply:b=>applied.push(b),onClose(){}}),{createNodeMock:el=>el.type==='canvas'?(el.props['data-portrait-editor-canvas']?canvas:guide):el.props.role==='dialog'?{focus(){},querySelectorAll(){return[];}}:null});await new Promise(r=>setImmediate(r));});
 assert.equal(fetches,1,'manual mode does not need an AI service or pre-existing cutout');assert.equal(btn('Person umranden').props['aria-pressed'],true);assert.equal(btn('Korrektur in Vorschau übernehmen').props.disabled,true);
 await act(async()=>edit().props.onPointerDown(e(50,30)));assert.equal(btn('Person freistellen').props.disabled,true);assert.equal(btn('Radierer').props.disabled,true,'unfinished contour cannot be lost by switching tools');
 await act(async()=>btn('Rückgängig').props.onClick());assert.equal(btn('Radierer').props.disabled,false);
 await act(async()=>{for(const [x,y] of [[50,30],[400,30],[400,270],[50,270]])edit().props.onPointerDown(e(x,y));});
 assert.equal(btn('Person freistellen').props.disabled,false);operations=[];await act(async()=>btn('Person freistellen').props.onClick());assert(operations.some(x=>x[0]==='clip'));assert.equal(btn('Korrektur in Vorschau übernehmen').props.disabled,false);assert.equal(applied.length,0,'manual outline only changes the draft');
 operations=[];await act(async()=>btn('Rückgängig').props.onClick());assert(!operations.some(x=>x[0]==='clip'));assert.equal(btn('Wiederholen').props.disabled,false);
 operations=[];await act(async()=>btn('Wiederholen').props.onClick());assert(operations.some(x=>x[0]==='clip'));assert.equal(btn('Korrektur in Vorschau übernehmen').props.disabled,false);
 const check=root.root.findByProps({'aria-label':'Original als Vorlage einblenden'});await act(async()=>check.props.onChange({target:{checked:true}}));assert.equal(root.root.findByProps({'data-portrait-guide':'true'}).props.style.opacity,.35);assert.equal(guide.width,canvas.width);assert.notEqual(guide,canvas,'reference is separate from editable pixels');
 await act(async()=>btn('Korrektur in Vorschau übernehmen').props.onClick());assert.equal(applied[0].type,'image/png');
 console.log('PASS: manual outline without AI/cutout, contour validation, point undo, mask undo/redo, separate original guide and explicit PNG draft output.');
}finally{if(root)await act(async()=>root.unmount());globalThis.fetch=old.fetch;globalThis.createImageBitmap=old.bitmap;globalThis.document=old.document;}
