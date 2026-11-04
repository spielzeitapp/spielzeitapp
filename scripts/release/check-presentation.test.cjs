const {test}=require('node:test');const assert=require('node:assert/strict');
const {checkPresentation}=require('../../server/lib/releaseCheckPresentation');
test('confirmed Vercel build limit is explained without changing the failed release check',()=>{
 const result=checkPresentation({name:'Vercel – spielzeitapp',state:'failure'},{target_url:'https://vercel.com/team?upgradeToPro=build-rate-limit'});
 assert.equal(result.state,'failure');assert.equal(result.label,'Vercel-Build-Limit erreicht');assert.match(result.help,/erneut starten/);assert.ok(result.detailsUrl);
});
test('unknown failures and untrusted links are not called a build limit',()=>{
 for(const url of [undefined,'https://example.com/?upgradeToPro=build-rate-limit','javascript:alert(1)','https://vercel.com.evil.test/?upgradeToPro=build-rate-limit']){
 const result=checkPresentation({state:'failure'},{target_url:url});assert.equal(result.label,'Bereitstellungsprüfung fehlgeschlagen');assert.equal(result.detailsUrl,undefined);
 }
});
test('pending, missing and successful checks have separate German instructions',()=>{
 assert.match(checkPresentation({state:'pending'}).help,/warten/);assert.match(checkPresentation({state:'missing'}).label,/fehlt/);
 assert.equal(checkPresentation({state:'success'}).help,null);
 assert.notEqual(checkPresentation({state:'success'},{target_url:'https://vercel.com/?upgradeToPro=build-rate-limit'}).label,'Vercel-Build-Limit erreicht');
});
