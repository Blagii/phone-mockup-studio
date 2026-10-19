const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const core=import('../promo-core.js');
const code=fs.readFileSync(require.resolve('../promo.js'),'utf8');
const renderer=code.slice(code.indexOf('    function drawTitleMedia('),code.indexOf('    function drawComposition('));
test('title media uses scene-local image transforms and filters without mutating settings',async()=>{
 const {makeScene,normalizeScreenSettings,validateProject}=await core;
 const calls=[];const ctx={save(){},restore(){},translate(...v){calls.push(['translate',...v]);},rotate(v){calls.push(['rotate',v]);},drawImage(...v){calls.push(['draw',...v]);}};
 const element={};const media={assets:new Map([['image',{type:'image',width:400,height:800,element}]])};
 const sandbox={ctx,media,normalizeScreenSettings};vm.createContext(sandbox);vm.runInContext(renderer,sandbox);
 const scene=makeScene('title',{mediaId:'image',screenAdjust:{image:{zoom:150,x:10,y:20,angle:0},filters:{bri:120,con:80,sat:60}}});
 const before=JSON.stringify(scene);
 sandbox.drawTitleMedia(scene,.5,720,1280);
 assert.deepEqual(calls[0],['translate',432,896]);assert.deepEqual(calls[1],['rotate',0]);
 assert.deepEqual(calls[2],['draw',element,-540,-1080,1080,2160]);
 assert.equal(ctx.filter,'brightness(1.2) contrast(0.8) saturate(0.6)');assert.equal(JSON.stringify(scene),before);
 const restored=validateProject({version:2,assets:[{id:'image',type:'image',name:'title.png',data:'data:image/png;base64,YQ=='}],scenes:[scene]}).scenes[0];
 assert.equal(restored.mediaId,'image');assert.deepEqual(restored.screenAdjust,scene.screenAdjust);
});
test('legacy text-only title and CTA scenes do not render an image',async()=>{
 const {makeScene,normalizeScreenSettings}=await core;
 const sandbox={ctx:{drawImage(){assert.fail('text-only title must not draw media');}},media:{assets:new Map()},normalizeScreenSettings};
 vm.createContext(sandbox);vm.runInContext(renderer,sandbox);
 for(const shot of ['title','cta'])sandbox.drawTitleMedia(makeScene(shot),.5,720,1280);
});
