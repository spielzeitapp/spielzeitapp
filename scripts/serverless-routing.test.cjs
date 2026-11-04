const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('esbuild');
function entries(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?entries(path.join(dir,e.name)):/\.(js|ts)$/.test(e.name)?[path.join(dir,e.name)]:[]);}
test('all deployable API entries fit Hobby and resolve their server dependencies',async()=>{
 const files=entries('api');assert.ok(files.length<=12,`${files.length} functions exceeds Hobby limit`);
 await build({entryPoints:files,bundle:true,platform:'node',format:'cjs',packages:'external',outdir:'/tmp/spielzeit-api-check',write:false,logLevel:'silent'});
});
test('push router preserves each URL and delegates authorization to its original handler',async()=>{
 const result=await build({entryPoints:['api/push/router.js'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'push-fixtures',setup(b){
  b.onResolve({filter:/server\/push\/.*\.js$/},a=>({path:a.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:`export default (req,res)=>res.status(207).json({handler:${JSON.stringify(path.basename(a.path,'.js'))},url:req.url,auth:req.headers.authorization});`}));
 }}]});
 const m={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,m,m.exports);
 for(const name of ['subscribe','unsubscribe','send-team','test']){
  let status,body;const req={url:'/api/push/router',query:{pushAction:name,team_season_id:'fixture'},headers:{authorization:'Bearer fixture'}};
  const res={status(s){status=s;return this;},json(b){body=b;return this;}};
  await m.exports.default(req,res);assert.equal(status,207);assert.equal(body.handler,name);assert.equal(body.auth,req.headers.authorization);assert.equal(body.url,req.url);
 }
 for(const url of ['/api/push/unknown','/api/push/__proto__','/api/push/nope?action=send-team']){
  let status;await m.exports.default({url},{status(s){status=s;return this;},json(){}});assert.equal(status,404);
 }
});
