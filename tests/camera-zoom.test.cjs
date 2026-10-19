const {test}=require('node:test');const assert=require('node:assert/strict');const core=import('../promo-core.mjs');
test('zoom-in and zoom-out shots animate in opposite directions across the whole scene',async()=>{
 const {makeScene,poseForScene,sceneAt}=await core;
 for(const duration of [2,10,60,120])for(const shot of ['zoomin','zoomout']){
  const s=makeScene(shot,{duration});const sample=t=>poseForScene(s,sceneAt([s],t).progress).scale;
  assert.ok(shot==='zoomin'?sample(0)<sample(duration):sample(0)>sample(duration));
  assert.ok(Math.abs(sample(duration/2)-.73*.9)<1e-10);
 }
});
test('custom zoom, static zoom and disabled zoom sample deterministically',async()=>{
 const {makeScene,poseForScene,poseFor}=await core;
 const s=makeScene('orbit',{cameraZoom:{enabled:true,from:100,to:150,easing:'linear'}});
 assert.equal(poseForScene(s,.5).scale,poseFor('orbit',.5).scale*1.25);
 s.cameraZoom.to=100;assert.equal(poseForScene(s,.5).scale,poseFor('orbit',.5).scale);
 s.cameraZoom.enabled=false;assert.deepEqual(poseForScene(s,.5),poseFor('orbit',.5));
});
test('camera zoom settings are bounded, independently copied and saved',async()=>{
 const {makeScene,validateProject,normalizeCameraZoom}=await core;
 const a=makeScene('zoomin'),b=makeScene('zoomin',{...a,id:'copy'});b.cameraZoom.from=150;
 assert.equal(a.cameraZoom.from,70);assert.equal(b.cameraZoom.from,150);
 const p=validateProject({version:2,scenes:[a,b]});assert.equal(p.scenes[0].cameraZoom.from,70);assert.equal(p.scenes[1].cameraZoom.from,150);
 const old=makeScene('hero');delete old.cameraZoom;assert.equal(validateProject({version:1,scenes:[old]}).scenes[0].cameraZoom.enabled,false);
 assert.deepEqual(normalizeCameraZoom({enabled:true,from:0,to:999,easing:'bad'}),{enabled:true,from:25,to:250,easing:'smooth'});
});
test('device positioning is independent of camera zoom, image crop and scene motion',async()=>{
 const {makeScene,poseForScene,poseFor}=await core;
 for(const shot of ['staticScroll','hero','orbit','zoomin'])for(const t of [0,.25,.5,1]){
  const s=makeScene(shot,{devicePosition:{x:25,y:-40},cameraZoom:{enabled:true,from:200,to:200}});
  const base=poseFor(shot,t),actual=poseForScene(s,t);
  assert.equal(actual.x,base.x+.75);assert.equal(actual.y,base.y+1.2);
  assert.equal(actual.scale,base.scale*2);
  assert.equal(s.screenAdjust.image.x,0);assert.equal(s.screenAdjust.image.y,0);
 }
});
test('device positions are cloned, bounded, saved and backwards compatible',async()=>{
 const {makeScene,validateProject,normalizeDevicePosition}=await core;
 const a=makeScene('staticScroll',{devicePosition:{x:30,y:45}});
 const copy=makeScene(a.shot,{...a,id:'copy'});copy.devicePosition.x=-50;
 assert.equal(a.devicePosition.x,30);
 const project=validateProject(JSON.parse(JSON.stringify({version:2,scenes:[a,copy]})));
 assert.deepEqual(project.scenes[0].devicePosition,{x:30,y:45});assert.equal(project.scenes[1].devicePosition.x,-50);
 const old={...a};delete old.devicePosition;
 assert.deepEqual(validateProject({version:1,scenes:[old]}).scenes[0].devicePosition,{x:0,y:0});
 assert.deepEqual(normalizeDevicePosition({x:Infinity,y:1000}),{x:0,y:100});
});
