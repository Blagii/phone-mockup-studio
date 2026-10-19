// Optional Playwright check: real render pose, per-scene zoom controls, saving and export.
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:process.env.CHROMIUM_SERVERLESS?require('@sparticuz/chromium').default.args:[]});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true,serviceWorkers:'block'}),base=process.env.STUDIO_URL||'http://localhost:8780';
  if(process.env.THREE_TEST_ROOT)await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',route=>route.fulfill({path:path.join(process.env.THREE_TEST_ROOT,route.request().url().split('three@0.160.0/')[1]),contentType:'application/javascript'}));
  await context.route(base+'/promo-devices.js',async route=>{let js=await fs.readFile(path.join(__dirname,'../promo-devices.js'),'utf8');js=js.replace('        update(device,', `        caseSnapshot() { return shells.map(mat=>({color:mat.color.getHexString(),metalness:mat.metalness,roughness:mat.roughness})); },\n        update(device,`);await route.fulfill({body:js,contentType:'application/javascript'});});
  await context.route(base+'/',async route=>{
   let html=await fs.readFile(path.join(__dirname,'../index.html'),'utf8');if(process.env.STUDIO_TEST_PIXEL_RATIO)html=html.replaceAll('Math.min(window.devicePixelRatio, 2)',process.env.STUDIO_TEST_PIXEL_RATIO);
   html=html.replace('promoLastSource = source; promoLastKey = key;', 'promoLastSource = source; promoLastKey = key; window.__imageProbe = { settings, screen: promoPhoneCanvas };');
   html=html.replace('                    source ||= lastShotImg;', `                    window.__caseMaterials = device === 'iphone' ? bodyMats.map(({mat})=>({color:mat.color.getHexString(),metalness:mat.metalness,roughness:mat.roughness})) : promoDevices.caseSnapshot();\n                    source ||= lastShotImg;`);
   html=html.replace('pose(pose) {','pose(pose) { window.__zoomPose = {...pose};');await route.fulfill({body:html,contentType:'text/html'});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Model loaded'),null,{timeout:90000});

  await page.locator('#phone-case-options').evaluate(el=>el.open=true);
  const pose=await page.evaluate(()=>({...window.__zoomPose}));
  async function finish(value,color,roughness,metalness){
   await page.selectOption('#phone-case-finish',value);
   await page.selectOption('#phone-case-palette',color);
   await page.waitForFunction(({color,roughness,metalness})=>window.__caseMaterials?.length>0&&window.__caseMaterials.every(m=>m.color===color.slice(1)&&m.roughness===roughness&&m.metalness===metalness),{color,roughness,metalness});
  }
  await finish('matte','#e89fad',.85,0);
  assert.deepEqual(await page.evaluate(()=>window.__zoomPose),pose);
  assert.equal(await page.locator('#brand-frame').inputValue(),'#e89fad');
  assert.equal(await page.locator('#image-y').inputValue(),'0');
  await page.click('#promo-duplicate');
  await finish('metallic','#4266a9',.24,.95);
  await page.locator('.timeline-scene').nth(1).click();
  assert.equal(await page.locator('#phone-case-finish').inputValue(),'matte');
  assert.equal(await page.locator('#phone-case-color').inputValue(),'#e89fad');
  await page.selectOption('#promo-device','android');
  await finish('glossy','#a8ccb5',.12,.08);
  console.log('PASS actual iPhone and Samsung/Android frame material colors/finishes and independent copies');
  await page.click('#phone-case-reset');
  assert.equal(await page.locator('#phone-case-finish').inputValue(),'original');
  await page.waitForFunction(()=>window.__caseMaterials.every(m=>m.color==='62646b'&&m.roughness===.28&&m.metalness===.72));
  await finish('matte','#ccb078',.85,0);
  await page.selectOption('#promo-device','laptop');
  assert.equal(await page.locator('#phone-case-options').isVisible(),false);
  await page.waitForFunction(()=>window.__caseMaterials.every(m=>m.roughness===.28&&m.metalness===.72));
  await page.selectOption('#promo-device','android');
  await page.waitForFunction(()=>window.__caseMaterials.every(m=>m.roughness===.85&&m.metalness===0));
  const saved=page.waitForEvent('download');await page.click('#promo-save');
  const project=JSON.parse(await fs.readFile(await(await saved).path(),'utf8'));
  assert.equal(project.scenes[1].phoneCase.finish,'matte');assert.equal(project.scenes[1].colors.frame,'#ccb078');
  assert.equal(project.scenes[2].phoneCase.finish,'metallic');assert.equal(project.scenes[2].colors.frame,'#4266a9');
  project.scenes=[{...project.scenes[1],duration:1},{...project.scenes[2],duration:1}];
  const [open]=await Promise.all([page.waitForEvent('filechooser'),page.click('#promo-open')]);
  await open.setFiles({name:'phone-cases.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-scene').length===2);
  assert.equal(await page.locator('#phone-case-finish').inputValue(),'matte');
  const video=page.waitForEvent('download',{timeout:60000});await page.click('#promo-export');const result=await video;assert.ok((await fs.stat(await result.path())).size>1000);
  console.log('PASS frame reset, switching devices, portable project and both phone cases in video export');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
