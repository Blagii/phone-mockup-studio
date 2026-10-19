// Optional Playwright smoke test: actual screen texture pixels and scene-time synchronization.
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:process.env.CHROMIUM_SERVERLESS?require('@sparticuz/chromium').default.args:[]});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true,serviceWorkers:'block'});
  const base=process.env.STUDIO_URL||'http://localhost:8780';
  if(process.env.THREE_TEST_ROOT)await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',route=>route.fulfill({path:path.join(process.env.THREE_TEST_ROOT,route.request().url().split('three@0.160.0/')[1]),contentType:'application/javascript'}));
  await context.route(base+'/',async route=>{
   let html=await fs.readFile(path.join(__dirname,'../index.html'),'utf8');
   if(process.env.STUDIO_TEST_PIXEL_RATIO)html=html.replaceAll('Math.min(window.devicePixelRatio, 2)',process.env.STUDIO_TEST_PIXEL_RATIO);
   html=html.replace('pose(pose) {','pose(pose) { window.__staticPose = {...pose};');
   html=html.replace('promoLastSource = source; promoLastKey = key;', 'promoLastSource = source; promoLastKey = key; window.__scrollProbe = { settings, screen: promoPhoneCanvas };');
   await route.fulfill({body:html,contentType:'text/html'});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Model loaded'),null,{timeout:90000});
  await page.selectOption('#promo-shot','zoomin');
  await page.selectOption('#promo-shot','staticScroll');
  assert.equal(await page.locator('#scene-zoom-mode').inputValue(),'off');
  assert.equal(await page.locator('#scene-scroll-enabled').isChecked(),true);
  assert.equal(await page.locator('#promo-transition').inputValue(),'cut');
  await page.getByRole('button',{name:'Dodaj scenu: Statičan telefon + skrol',exact:true}).click();
  assert.equal(await page.locator('#promo-duration').inputValue(),'8');
  assert.equal(await page.locator('#scene-scroll-enabled').isChecked(),true);
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=1800;const g=c.getContext('2d');for(const [color,y]of[['#ee2020',0],['#20dd20',600],['#2020ee',1200]]){g.fillStyle=color;g.fillRect(0,y,300,600);for(let row=y;row<y+600;row++){const v=(Math.imul(row+1,2654435761)>>>24)%31;g.fillStyle=y===0?`rgb(238,${v},${v})`:y===600?`rgb(${v},221,${v})`:`rgb(${v},${v},238)`;g.fillRect(0,row,300,1);}}return c.toDataURL('image/png');});
  const core=await import('../promo-core.mjs');
  const project={version:2,assets:[{id:'long',type:'image',name:'long.png',data:image}],scenes:[core.makeScene('staticScroll',{duration:4,mediaId:'long',transition:'cut',screenAdjust:{image:{x:45,y:100,zoom:70,angle:12,fit:'cover'}}})]};
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.click('#promo-open')]);await chooser.setFiles({name:'scroll.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-scene').length===1);
  await page.locator('#scene-scroll-options').evaluate(el=>el.open=true);await page.check('#scene-scroll-enabled');await page.locator('#scene-scroll-zoom').fill('100');
  async function sample(time,progress){
   await page.locator('#promo-seek').evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(time));
   await page.waitForFunction(p=>Math.abs((window.__scrollProbe?.settings.image.scroll??-10)-p)<.001,progress);
   const pose=await page.evaluate(()=>window.__staticPose);
   assert.equal(pose.scale,.78);assert.equal(pose.x,0);assert.equal(pose.y,0);assert.equal(pose.rx,0);assert.equal(pose.ry,0);assert.equal(pose.rz,0);
   return page.evaluate(()=>{const c=window.__scrollProbe.screen;return [...c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data];});
  }
  const top=await sample(0,0),middle=await sample(2,.5),bottom=await sample(3.999,.99975);
  assert.ok(top[0]>200&&top[1]<60);assert.ok(middle[1]>180&&middle[0]<60);assert.ok(bottom[2]>200&&bottom[0]<60);
  await page.locator('#image-zoom').evaluate(el=>{el.value='150';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#image-angle').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  const initialCrops=[];
  for(const offset of [-100,-50,0,50,100]){
   const editTime=await page.locator('#promo-seek').inputValue();
   await page.locator('#image-y').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},offset);
   await page.waitForFunction(y=>window.__scrollProbe?.settings.image.y===y,offset);
   assert.equal(await page.locator('#promo-seek').inputValue(),editTime,'manual positioning must preserve the current device pose and time');
   assert.equal(await page.evaluate(()=>window.__scrollProbe.settings.image.scroll),undefined,'manual editing must use the normal non-scrolling renderer');
   if(offset===0){
    const manual=await page.evaluate(()=>window.__scrollProbe.screen.toDataURL());
    await page.uncheck('#scene-scroll-enabled');
    await page.selectOption('#promo-shot','hero');
    await page.waitForFunction(()=>window.__staticPose?.ry===-28);
    assert.equal(await page.evaluate(()=>window.__scrollProbe.screen.toDataURL()),manual,'static manual crop must match the existing Hero preset pixel for pixel');
    await page.selectOption('#promo-shot','staticScroll');
    await page.waitForFunction(()=>window.__staticPose?.scale===.78);
    assert.equal(await page.locator('#scene-scroll-enabled').isChecked(),true);
    assert.equal(await page.evaluate(()=>window.__scrollProbe.screen.toDataURL()),manual);
    console.log('PASS static preset reuses the existing Hero manual image composition pixel for pixel');
   }
   initialCrops.push(await page.evaluate(()=>window.__scrollProbe.screen.toDataURL()));
   const frames=[];
   for(const p of [0,.25,.5,.75,.99]){
    await sample(p*4,p);
    frames.push(await page.evaluate(()=>window.__scrollProbe.screen.toDataURL()));
   }
   assert.equal(new Set(frames).size,5,'extreme manual Y must not freeze any part of the visible scroll');
  }
  assert.equal(new Set(initialCrops).size,5,'all slider positions must visibly change the initial crop');
  await page.locator('#image-zoom').evaluate(el=>{el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#image-angle').evaluate(el=>{el.value='12';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#image-y').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>window.__scrollProbe?.settings.image.y===100);
  console.log('PASS visible image keeps moving across the whole scene at both extreme manual Y positions');
  await page.locator('#promo-duration').fill('120');assert.match(await page.locator('#scene-scroll-duration').textContent(),/120 s/);
  assert.equal(await page.locator('#promo-duration').evaluate(el=>el.validity.valid),true);
  assert.deepEqual(await sample(60,.5),middle);
  await page.locator('#image-y').evaluate(el=>{el.value='-100';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#promo-play');
  await page.waitForFunction(()=>Number.isFinite(window.__scrollProbe?.settings.image.scroll)&&window.__scrollProbe.settings.image.scroll<.05);
  await page.click('#promo-play');
  assert.ok(Number(await page.locator('#promo-seek').inputValue())<6,'playing after manual image editing must restart the scroll scene rather than skip the beginning');
  console.log('PASS Play after manual editing restarts scrolling at the true scene beginning');
  await page.selectOption('#scene-scroll-direction','up');const reverse=await sample(0,1);assert.ok(reverse[2]>200&&reverse[0]<60);
  console.log('PASS actual scrolling pixels with nonzero position, low zoom and rotation, reversed direction and duration sync');
  const edges = await page.evaluate(()=>{const c=window.__scrollProbe.screen,g=c.getContext('2d'); return [[3,3],[c.width-4,3],[3,c.height-4],[c.width-4,c.height-4]].map(([x,y])=>[...g.getImageData(x,y,1,1).data]);});
  for(const color of edges)assert.ok(Math.max(...color.slice(0,3))>100,'scroll must not reveal a black corner');
  await page.click('#promo-duplicate');await page.selectOption('#scene-scroll-direction','down');await page.uncheck('#scene-scroll-enabled');
  await page.locator('.timeline-scene').first().click();assert.equal(await page.locator('#scene-scroll-enabled').isChecked(),true);assert.equal(await page.locator('#scene-scroll-direction').inputValue(),'up');
  await page.locator('#promo-layers > summary').click(); await page.click('#layer-add-text');
  await page.locator('#layer-start').fill('110'); await page.locator('#layer-end').fill('120');
  assert.equal(await page.locator('#layer-end').evaluate(el=>el.validity.valid),true);
  const saved=page.waitForEvent('download');await page.click('#promo-save');const data=JSON.parse(await fs.readFile(await(await saved).path(),'utf8'));
  assert.equal(data.scenes[0].duration,120); assert.equal(data.scenes[0].overlays[0].start,110); assert.equal(data.scenes[0].overlays[0].end,120);
  assert.equal(data.scenes[0].screenMotion.enabled,true);assert.equal(data.scenes[1].screenMotion.enabled,false);
  console.log('PASS per-scene scroll isolation, independent duplication and project save');
  // Exercise the exact boundary into a scrolling second scene, then export it.
  data.scenes=[{...data.scenes[1],duration:1,overlays:[]},{...data.scenes[0],duration:2,overlays:[]}];
  const [again]=await Promise.all([page.waitForEvent('filechooser'),page.click('#promo-open')]);await again.setFiles({name:'export.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-scene').length===2 && Number(document.querySelector('#promo-seek').max)===3);
  const boundary=await sample(1,1);assert.ok(boundary[2]>200&&boundary[0]<60);
  const boundaryEdges=await page.evaluate(()=>{const c=window.__scrollProbe.screen,g=c.getContext('2d');return [[3,3],[c.width-4,3],[3,c.height-4],[c.width-4,c.height-4]].map(([x,y])=>[...g.getImageData(x,y,1,1).data]);});
  for(const color of boundaryEdges)assert.ok(Math.max(...color.slice(0,3))>100,'second scene must start without black edges');
  console.log('PASS exact second-scene boundary has no black screen corners');
  const download=page.waitForEvent('download',{timeout:60000});await page.click('#promo-export');const result=await download;assert.ok((await fs.stat(await result.path())).size>1000);
  console.log('PASS video export with duration-synchronized screen scrolling');assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
