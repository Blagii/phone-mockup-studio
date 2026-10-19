// Optional Playwright check: real render pose, per-scene zoom controls, saving and export.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:process.env.CHROMIUM_SERVERLESS?require('@sparticuz/chromium').default.args:[]});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true,serviceWorkers:'block'}),base=process.env.STUDIO_URL||'http://localhost:8780';
  if(process.env.THREE_TEST_ROOT)await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',route=>route.fulfill({path:path.join(process.env.THREE_TEST_ROOT,route.request().url().split('three@0.160.0/')[1]),contentType:'application/javascript'}));
  await context.route(base+'/',async route=>{
   let html=await fs.readFile(path.join(__dirname,'../index.html'),'utf8');if(process.env.STUDIO_TEST_PIXEL_RATIO)html=html.replaceAll('Math.min(window.devicePixelRatio, 2)',process.env.STUDIO_TEST_PIXEL_RATIO);
   html=html.replace('promoLastSource = source; promoLastKey = key;', 'promoLastSource = source; promoLastKey = key; window.__imageProbe = { settings, screen: promoPhoneCanvas };');
   html=html.replace('pose(pose) {','pose(pose) { window.__zoomPose = {...pose};');await route.fulfill({body:html,contentType:'text/html'});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Model loaded'),null,{timeout:90000});
  await page.selectOption('#promo-shot','zoomin');assert.equal(await page.locator('#scene-zoom-mode').inputValue(),'in');
  async function sample(time,scale){await page.locator('#promo-seek').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},time);await page.waitForFunction(s=>Math.abs((window.__zoomPose?.scale||0)-s)<.001,scale);}
  await sample(2.5,.73*.7);await sample(4.5,.73*.9);await sample(6.49,.73*1.1);
  await page.locator('#promo-duration').fill('8');await sample(6.5,.73*.9);
  assert.match(await page.locator('#scene-zoom-duration').textContent(),/8 s/);
  await page.selectOption('#promo-shot','zoomout');await sample(2.5,.73*1.1);await sample(10.49,.73*.7);
  console.log('PASS zoom-in/out shot types and duration-synchronized real render scale');
  await page.selectOption('#scene-zoom-mode','custom');assert.equal(await page.locator('#scene-zoom-from').inputValue(),await page.locator('#scene-zoom-to').inputValue());
  await page.locator('#scene-zoom-from').fill('120');await page.locator('#scene-zoom-to').fill('120');await sample(6.5,.73*1.2);
  const selectedTime=await page.locator('#promo-seek').inputValue();
  async function position(x,y){
   for(const [axis,value]of [['x',x],['y',y]])await page.locator('#scene-device-'+axis).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
   await page.waitForFunction(([x,y])=>Math.abs(window.__zoomPose.x-x*.03)<1e-8&&Math.abs(window.__zoomPose.y-(-.38-y*.03))<1e-8,[x,y]);
  }
  await position(25,-40);
  assert.equal(await page.locator('#promo-seek').inputValue(),selectedTime,'positioning must preserve current zoom frame');
  assert.ok(Math.abs(await page.evaluate(()=>window.__zoomPose.scale)-.73*1.2)<.001);
  await page.click('#scene-device-reset');await page.waitForFunction(()=>window.__zoomPose.x===0&&window.__zoomPose.y===-.38);
  assert.equal(await page.locator('#scene-zoom-from').inputValue(),'120','reset must not change device zoom');
  await position(25,-40);
  await page.locator('#scene-scroll-options').evaluate(el=>el.open=true);
  await page.check('#scene-scroll-enabled');
  await sample(6.5,.73*1.2);
  await page.waitForFunction(()=>Number(document.querySelector('#promo-seek').value)===6.5);
  const adjustmentTime=await page.locator('#promo-seek').inputValue();
  const adjustmentPose=await page.evaluate(()=>({...window.__zoomPose}));
  const crops=[];
  for(const y of [-15,15]){
   await page.locator('#image-y').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},y);
   await page.waitForFunction(y=>window.__imageProbe?.settings.image.y===y&&window.__imageProbe.settings.image.scroll===undefined,y);
   crops.push(await page.evaluate(()=>window.__imageProbe.screen.toDataURL()));
   assert.equal(await page.locator('#promo-seek').inputValue(),adjustmentTime);
   assert.deepEqual(await page.evaluate(()=>window.__zoomPose),adjustmentPose,'image adjustment must not move or resize the zoomed phone');
  }
  assert.notEqual(crops[0],crops[1],'vertical image adjustment must change the rendered texture in a zoom preset with scroll enabled');
  await page.locator('#scene-text-options').evaluate(el=>el.open=true);
  await page.locator('#scene-text-subtitleScale').evaluate(el=>{el.value='200';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.check('#scene-text-subtitleAsTitle');
  await page.locator('.timeline-scene').first().click();
  await page.locator('.timeline-scene').nth(1).click();
  await page.waitForFunction(()=>window.__imageProbe?.settings.image.y===15&&window.__imageProbe.settings.image.scroll===undefined);
  assert.equal(await page.locator('#image-y').inputValue(),'15');
  assert.equal(await page.evaluate(()=>window.__imageProbe.screen.toDataURL()),crops[1],'subtitle editing and reselecting a scene must preserve the visible manual image position');
  await page.locator('#scene-scroll-options').evaluate(el=>el.open=true);
  assert.equal(await page.locator('#scene-scroll-preview').isChecked(),false);
  await page.check('#scene-scroll-preview');
  await page.waitForFunction(()=>Number.isFinite(window.__imageProbe?.settings.image.scroll));
  await page.uncheck('#scene-scroll-preview');
  await page.waitForFunction(()=>window.__imageProbe?.settings.image.scroll===undefined);
  assert.equal(await page.evaluate(()=>window.__imageProbe.screen.toDataURL()),crops[1]);
  console.log('PASS subtitle edits, scene reselection and explicit scroll preview preserve the manual image crop');
  await position(10,-20);
  assert.equal(await page.evaluate(()=>window.__imageProbe.settings.image.y),15,'moving the phone must preserve image crop');
  assert.equal(await page.evaluate(()=>window.__imageProbe.screen.toDataURL()),crops[1]);
  await position(25,-40);
  await page.locator('#image-y').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>window.__imageProbe?.settings.image.y===0);
  console.log('PASS image vertical movement in zoom preset with scrolling enabled preserves phone zoom, position and scene time');
  console.log('PASS zoomed device can move in both axes without changing zoom, time or image crop; reset works');
  await page.click('#promo-duplicate');await page.locator('#scene-zoom-to').fill('180');
  await position(-30,-40);

  await page.locator('.timeline-scene').nth(1).click();assert.equal(await page.locator('#scene-device-x').inputValue(),'25');assert.equal(await page.locator('#scene-zoom-to').inputValue(),'120');
  await page.locator('.timeline-scene').first().click();assert.equal(await page.locator('#scene-zoom-mode').inputValue(),'off');
  console.log('PASS custom/static zoom and independent scene/copy settings');
  const saved=page.waitForEvent('download');await page.click('#promo-save');const project=JSON.parse(await fs.readFile(await(await saved).path(),'utf8'));
  assert.deepEqual(project.scenes[1].devicePosition,{x:25,y:-40});assert.deepEqual(project.scenes[2].devicePosition,{x:-30,y:-40});assert.equal(project.scenes[1].cameraZoom.to,120);assert.equal(project.scenes[2].cameraZoom.to,180);
  project.scenes=[{...project.scenes[1],duration:2}];
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.click('#promo-open')]);await chooser.setFiles({name:'zoom.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-scene').length===1);
  assert.equal(await page.locator('#scene-zoom-to').inputValue(),'120');
  assert.equal(await page.locator('#scene-device-x').inputValue(),'25');assert.equal(await page.locator('#scene-device-y').inputValue(),'-40');
  const video=page.waitForEvent('download',{timeout:60000});await page.click('#promo-export');const result=await video;assert.ok((await fs.stat(await result.path())).size>1000);
  console.log('PASS zoom project roundtrip and composed video export');assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
