const {test}=require('node:test');const assert=require('node:assert/strict');const core=import('../promo-core.js');
test('phone case finish/color are scene-local, independently copied and portable',async()=>{
 const {makeScene,validateProject,styleFor,caseMaterial}=await core;
 const a=makeScene('hero',{phoneCase:{finish:'matte'},colors:{frame:'#e89fad'}});
 const b=makeScene('hero',{...a,id:'copy',colors:{...a.colors}});b.phoneCase.finish='metallic';b.colors.frame='#4266a9';
 assert.equal(a.phoneCase.finish,'matte');assert.equal(styleFor(a).frame,'#e89fad');
 const scenes=validateProject({version:2,scenes:[a,b]}).scenes;
 assert.equal(styleFor(scenes[0]).caseFinish,'matte');assert.equal(styleFor(scenes[1]).frame,'#4266a9');
 assert.deepEqual(caseMaterial('matte'),{metalness:0,roughness:.85});assert.equal(caseMaterial('original'),null);
 assert.equal(makeScene('hero',{phoneCase:{finish:'bad'}}).phoneCase.finish,'original');
 const old={...a};delete old.phoneCase;assert.equal(validateProject({version:1,scenes:[old]}).scenes[0].phoneCase.finish,'original');
});
