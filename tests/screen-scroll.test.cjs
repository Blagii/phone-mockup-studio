const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=import('../promo-core.mjs');
test('scroll maps the whole scene duration to top, middle and bottom',async()=>{
 const {makeScene,sceneAt,screenSettingsAt}=await core;
 for(const duration of [2,4,10,12,30,60,120]){
  const scene=makeScene('hero',{duration,screenMotion:{enabled:true,zoom:100}});
  for(const [time,p] of [[0,0],[duration/2,.5],[duration,1]]) assert.equal(screenSettingsAt(scene,sceneAt([scene],time).progress).image.scroll,p);
 }
});
test('direction, easing and extra zoom are deterministic without changing manual position',async()=>{
 const {makeScene,screenSettingsAt}=await core;
 const scene=makeScene('hero',{screenMotion:{enabled:true,direction:'up',easing:'smooth',zoom:125},screenAdjust:{image:{zoom:120,y:10,fit:'contain'}}});
 const settings=screenSettingsAt(scene,.25);
 assert.equal(settings.image.scroll,.84375);assert.equal(settings.image.zoom,150);assert.equal(settings.image.y,10);assert.equal(settings.image.fit,'cover');
 assert.equal(scene.screenAdjust.image.zoom,120);assert.equal(scene.screenAdjust.image.fit,'contain');assert.equal(scene.screenAdjust.image.scroll,undefined);
 assert.deepEqual(screenSettingsAt(scene,.25),settings);
});
test('scroll is opt-in, independently copied, validated and saved per scene',async()=>{
 const {makeScene,validateProject,screenSettingsAt}=await core;
 const first=makeScene('hero',{screenMotion:{enabled:true,direction:'down',zoom:135}}), second=makeScene('orbit');
 const copy=makeScene('hero',{...first,id:'copy'});copy.screenMotion.direction='up';
 assert.equal(first.screenMotion.direction,'down');assert.equal(second.screenMotion.enabled,false);assert.equal(screenSettingsAt(second,.5).image.scroll,undefined);
 const p=validateProject({version:2,scenes:[first,second,copy]});assert.equal(p.scenes[0].screenMotion.zoom,135);assert.equal(p.scenes[1].screenMotion.enabled,false);assert.equal(p.scenes[2].screenMotion.direction,'up');
 const old={...first};delete old.screenMotion;assert.equal(validateProject({version:1,scenes:[old]}).scenes[0].screenMotion.enabled,false);
 const invalid=makeScene('hero',{screenMotion:{enabled:'yes',zoom:900,direction:'bad',easing:'bad'}});assert.deepEqual(invalid.screenMotion,{enabled:false,direction:'down',easing:'linear',zoom:200});
});

test('long scenes and overlay times survive project loading with a shared duration limit',async()=>{
 const {makeScene,makeOverlay,validateProject,MAX_SCENE_DURATION}=await core;
 for(const duration of [15,30,60,120]){
  const s=makeScene('hero',{duration,overlays:[makeOverlay('text',{start:duration-5,end:duration})]});
  const p=validateProject({version:2,scenes:[s]});assert.equal(p.scenes[0].duration,duration);assert.equal(p.scenes[0].overlays[0].end,duration);
 }
 assert.equal(MAX_SCENE_DURATION,120);
 assert.throws(()=>validateProject({version:2,scenes:[makeScene('hero',{duration:120.5})]}));
});
test('scroll never exposes empty edges with manual offsets, low zoom or image rotation',async()=>{
 const {scrollPlacement}=await core;
 for(const [sw,sh,w,h]of [[300,1800,1179,2556],[1200,800,1440,900],[1179,2556,1179,2556]])
 for(const angle of [-45,-12,0,12,45,90])for(const zoom of [25,70,100,150])for(const p of [0,.001,.5,.999,1]){
  const image={x:45,y:35,zoom,angle,scroll:p};const pose=scrollPlacement(sw,sh,w,h,image);
  const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  for(const [x,y]of [[0,0],[w,0],[0,h],[w,h]]){
   const dx=x-pose.x,dy=y-pose.y;
   assert.ok(Math.abs(c*dx+s*dy)<=sw*pose.scale/2+1e-7);
   assert.ok(Math.abs(-s*dx+c*dy)<=sh*pose.scale/2+1e-7);
  }
 }
});
test('static scroll preset keeps the device still while the image scrolls and survives saving',async()=>{
 const {makeScene,poseForScene,screenSettingsAt,validateProject,sceneOpacity}=await core;
 const scene=makeScene('staticScroll');
 assert.equal(scene.duration,8);assert.equal(scene.cameraZoom.enabled,false);
 assert.equal(scene.screenMotion.enabled,true);assert.equal(scene.screenMotion.zoom,100);
 for(const t of [0,.01,.25,.5,.99,1]){
  assert.deepEqual(poseForScene(scene,t),poseForScene(scene,0));
  assert.equal(poseForScene(scene,t).ry,0);assert.equal(sceneOpacity(scene,t*8),1);
  assert.equal(screenSettingsAt(scene,t).image.scroll,t);
 }
 const restored=validateProject(JSON.parse(JSON.stringify({version:2,assets:[],scenes:[scene]}))).scenes[0];
 assert.deepEqual(restored.screenMotion,scene.screenMotion);
 const copy=makeScene('staticScroll',{...scene,id:'copy'});copy.screenMotion.direction='up';
 assert.equal(scene.screenMotion.direction,'down');
});
test('horizontal crop remains effective while automatic scrolling owns vertical position',async()=>{
 const {scrollPlacement}=await core;
 const image={x:0,y:0,zoom:150,angle:0,scroll:.5};
 const center=scrollPlacement(300,1800,600,1200,image);
 const shifted=scrollPlacement(300,1800,600,1200,{...image,x:10,y:-20});
 assert.ok(shifted.x>center.x);assert.equal(shifted.y,center.y);
 const start=scrollPlacement(300,1800,600,1200,{...image,scroll:0});
 const adjustedStart=scrollPlacement(300,1800,600,1200,{...image,scroll:0,y:-20});
 assert.equal(adjustedStart.y,start.y);
 const bounded=scrollPlacement(300,1800,600,1200,{...image,x:100,y:100});
 assert.ok(bounded.x-300<=300*bounded.scale/2-300);
 assert.ok(bounded.y-600<=1800*bounded.scale/2-600);
});
test('manual offsets never freeze any segment of the scroll path',async()=>{
 const {scrollPlacement}=await core;
 for(const y of [-100,-35,0,35,100])for(const x of [-100,0,100])for(const angle of [-12,0,12]){
  const image={x,y,angle,zoom:100};
  const a=angle*Math.PI/180;
  const along=p=>{const pose=scrollPlacement(300,1800,600,1200,{...image,scroll:p});return -Math.sin(a)*(pose.x-300)+Math.cos(a)*(pose.y-600);};
  let previous=along(0);
  const travel=previous-along(1);assert.ok(travel>0);
  for(let i=1;i<=100;i++){
   const next=along(i/100);assert.ok(next<previous,'every timeline step must move the image');
   assert.ok(Math.abs((previous-next)-travel/100)<1e-7,'manual position must not introduce a pause');previous=next;
  }
 }
});
test('vertical position 100 shows the exact image beginning at the first static-scroll frame',async()=>{
 const {makeScene,screenSettingsAt,scrollPlacement}=await core;
 for(const zoom of [100,115,200]){
  const scene=makeScene('staticScroll',{screenAdjust:{image:{y:100,zoom}}});
  const image=screenSettingsAt(scene,0).image;
  const pose=scrollPlacement(300,1800,600,1200,image);
  assert.equal(pose.y-1800*pose.scale/2,0,'source top must align with screen top');
  assert.ok(scrollPlacement(300,1800,600,1200,screenSettingsAt(scene,.5).image).y<pose.y);
 }
});
test('scroll starts at the exact source edge for every manual Y, direction and zoom',async()=>{
 const {makeScene,screenSettingsAt,scrollPlacement}=await core;
 for(const y of [-100,-50,0,10,50,100])for(const zoom of [70,100,150,200])for(const direction of ['down','up']){
  const scene=makeScene('staticScroll',{screenAdjust:{image:{y,zoom}},screenMotion:{enabled:true,direction,zoom:100}});
  for(const p of [0,.1,1]){
   const image=screenSettingsAt(scene,p).image,pose=scrollPlacement(300,1800,600,1200,image);
   const overflow=1800*pose.scale-1200;
   const expected=direction==='down'?p:1-p;
   const fraction=(1800*pose.scale/2-pose.y)/overflow;
   assert.ok(Math.abs(fraction-expected)<1e-10,'no initial 10% crop may be skipped');
  }
  assert.equal(scene.screenAdjust.image.y,y,'manual position must remain stored');
 }
});
test('static preset uses the same manual image defaults as existing presets',async()=>{
 const {makeScene}=await core;
 assert.deepEqual(makeScene('staticScroll').screenAdjust,makeScene('hero').screenAdjust);
});
