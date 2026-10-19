const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = import('../promo-core.mjs');
test('export sizes are native 720p, 1080p and 4K for every aspect', async () => {
    const { outputSize } = await core;
    assert.deepEqual(outputSize('vertical','720'),[720,1280]);
    assert.deepEqual(outputSize('wide','1080'),[1920,1080]);
    assert.deepEqual(outputSize('wide','2160'),[3840,2160]);
    assert.deepEqual(outputSize('vertical','2160'),[2160,3840]);
    assert.deepEqual(outputSize('square','2160'),[2160,2160]);
});
test('every scene has independent media, device, color and overlay defaults', async () => {
    const { makeScene } = await core;
    const a=makeScene('hero'),b=makeScene('hero');
    assert.equal(a.mediaId,null);assert.equal(a.device,'iphone');assert.notEqual(a.overlays,b.overlays);
    a.overlays.push({type:'text'});assert.equal(b.overlays.length,0);
});
test('version 2 restores typed embedded assets, layer settings and per-scene devices', async () => {
    const { makeScene, makeOverlay, validateProject } = await core;
    const data={version:2, quality:'2160', assets:[{id:'clip',type:'video',data:'data:video/webm;base64,AAAA'},{id:'logo',type:'image',data:'data:image/png;base64,AAAA'}],scenes:[makeScene('hero',{device:'laptop',mediaId:'clip',mediaStart:1.5,colors:{top:'#aabbcc',light:'#ffffff'},overlays:[makeOverlay('image',{assetId:'logo',x:20,y:30}),makeOverlay('text',{text:'Brand',rotation:-30,start:1,end:3})]})]};
    const p=validateProject(JSON.parse(JSON.stringify(data)));
    assert.equal(p.quality,'2160');assert.equal(p.scenes[0].device,'laptop');assert.equal(p.scenes[0].mediaId,'clip');assert.equal(p.scenes[0].mediaStart,1.5);
    assert.equal(p.scenes[0].overlays[0].assetId,'logo');assert.equal(p.scenes[0].overlays[1].rotation,-30);
    assert.equal(p.scenes[0].colors.top,'#aabbcc');assert.notEqual(p.scenes[0].overlays[0].id,data.scenes[0].overlays[0].id);
});
test('project validation rejects missing assets, unsupported URLs and video logo layers', async () => {
    const { makeScene, makeOverlay, validateProject } = await core;
    const base={version:2,assets:[],scenes:[makeScene('hero')]};
    assert.throws(()=>validateProject({...base,scenes:[makeScene('hero',{mediaId:'missing'})]}));
    assert.throws(()=>validateProject({...base,assets:[{id:'logo',type:'image',data:'https://example.com/a.png'}]}));
    assert.throws(()=>validateProject({...base,assets:[{id:'v',type:'video',data:'data:image/png;base64,AAAA'}]}));
    assert.throws(()=>validateProject({...base,assets:[{id:'v',type:'video',data:'data:video/webm;base64,AAAA'}],scenes:[makeScene('hero',{overlays:[makeOverlay('image',{assetId:'v'})]})]}));
    assert.throws(()=>validateProject({...base,scenes:[makeScene('hero',{overlays:Array.from({length:9},()=>makeOverlay('text'))})]}));
});
test('layer values are bounded and unsafe CSS color strings cannot reach rendering', async () => {
    const { makeScene, makeOverlay, validateProject, styleFor }=await core;
    const p=validateProject({version:2,scenes:[makeScene('hero',{colors:{top:'url(bad)',ink:'#aabbcc',__proto__:{}},overlays:[makeOverlay('text',{x:-30,y:200,opacity:50,size:-4,color:'red'})]})]});
    const layer=p.scenes[0].overlays[0];assert.equal(layer.x,0);assert.equal(layer.y,100);assert.equal(layer.opacity,1);assert.equal(layer.size,1);assert.equal(layer.color,'#ffffff');
    assert.equal(styleFor(p.scenes[0]).top,'#fae8db');assert.equal(styleFor(p.scenes[0]).ink,'#aabbcc');
});
test('text styling is independent per scene and survives project roundtrip', async () => {
    const {makeScene,validateProject}=await core;
    const a=makeScene('hero'),b=makeScene('hero');
    a.title='Prva';b.title='Druga';a.textStyle.scale=140;a.textStyle.font='serif';a.textStyle.showSubtitle=false;
    assert.equal(b.textStyle.scale,100);assert.equal(b.textStyle.showSubtitle,true);
    const p=validateProject({version:2,scenes:[a,b]});
    assert.equal(p.scenes[0].title,'Prva');assert.equal(p.scenes[1].title,'Druga');
    assert.equal(p.scenes[0].textStyle.scale,140);assert.equal(p.scenes[0].textStyle.font,'serif');assert.equal(p.scenes[0].textStyle.showSubtitle,false);assert.equal(p.scenes[1].textStyle.scale,100);
    const old={...a};delete old.textStyle;
    assert.equal(validateProject({version:1,scenes:[old]}).scenes[0].textStyle.scale,100);
});
test('image position and filters are isolated between scenes, copies and project reloads', async () => {
    const {makeScene,validateProject}=await core;
    const source={image:{x:30,y:-20,zoom:140,fit:'contain',angle:12},filters:{bri:130,con:120,sat:80}};
    const a=makeScene('hero',{screenAdjust:source}),b=makeScene('hero'),copy=makeScene('hero',{...a,id:'copy'});
    copy.screenAdjust.image.x=-50;copy.screenAdjust.filters.bri=60;source.image.x=99;
    assert.equal(a.screenAdjust.image.x,30);assert.equal(a.screenAdjust.filters.bri,130);assert.equal(b.screenAdjust.image.x,0);
    const p=validateProject({version:2,scenes:[a,b,copy]});
    assert.deepEqual(p.scenes.map(s=>s.screenAdjust.image.x),[30,0,-50]);
    const old=makeScene('hero');delete old.screenAdjust;
    const migrated=validateProject({version:1,screen:source,scenes:[old,{...old}]});
    assert.equal(migrated.scenes[0].screenAdjust.image.x,99);
    migrated.scenes[0].screenAdjust.image.x=0;assert.equal(migrated.scenes[1].screenAdjust.image.x,99);
});
test('subtitle size and heading style are independent, cloned and portable',async()=>{
 const {makeScene,validateProject}=await core;
 const scene=makeScene('title',{textStyle:{subtitleScale:150,subtitleAsTitle:true}});
 assert.equal(scene.textStyle.scale,100);assert.equal(scene.textStyle.font,'sans');
 const copy=makeScene('title',{...scene,id:'copy'});copy.textStyle.subtitleScale=250;
 assert.equal(scene.textStyle.subtitleScale,150);
 const loaded=validateProject({version:2,scenes:[scene,copy]}).scenes;
 assert.equal(loaded[0].textStyle.subtitleAsTitle,true);assert.equal(loaded[0].textStyle.subtitleScale,150);assert.equal(loaded[1].textStyle.subtitleScale,250);
 const old=makeScene('hero');delete old.textStyle.subtitleScale;delete old.textStyle.subtitleAsTitle;
 const legacy=validateProject({version:1,scenes:[old]}).scenes[0];
 assert.equal(legacy.textStyle.subtitleScale,100);assert.equal(legacy.textStyle.subtitleAsTitle,false);
 assert.equal(makeScene('title',{textStyle:{subtitleScale:999}}).textStyle.subtitleScale,500);
});
