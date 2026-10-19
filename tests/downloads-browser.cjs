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
  await context.addInitScript(()=>{const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.id==='promo-canvas'&&text==='Podnaslov')window.__subtitleFont=this.font;return original.call(this,text,...args);};});
  await context.addInitScript(()=>{
   const original=HTMLAnchorElement.prototype.click;
   HTMLAnchorElement.prototype.click=function(){if(this.download){window.__blockedDownloads=(window.__blockedDownloads||0)+1;return;}return original.call(this);};
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Model loaded'),null,{timeout:90000});


  await page.click('#promo-save');
  const projectLink=page.locator('a[data-file="project"]');await projectLink.waitFor({state:'visible'});
  const project=await projectLink.evaluate(async a=>JSON.parse(await(await fetch(a.href)).text()));
  assert.equal(project.version,2);assert.equal(project.scenes.length,5);
  assert.equal(await page.evaluate(()=>window.__blockedDownloads),1);
  const projectDownload=page.waitForEvent('download');await projectLink.click();
  const file=await projectDownload;assert.equal(file.suggestedFilename(),'promo-studio.json');
  assert.equal(JSON.parse(await fs.readFile(await file.path(),'utf8')).scenes.length,5);
  console.log('PASS blocked automatic project download has a working user-clicked fallback');
  project.scenes=[{...project.scenes[0],duration:1}];project.quality='720';
  const [open]=await Promise.all([page.waitForEvent('filechooser'),page.click('#promo-open')]);
  await open.setFiles({name:'short-promo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-scene').length===1);
  await page.click('#promo-export');
  const videoLink=page.locator('a[data-file="video"]');await videoLink.waitFor({state:'visible',timeout:60000});
  assert.equal(await page.locator('#promo-export').isEnabled(),true);
  const bytes=await videoLink.evaluate(async a=>[...(new Uint8Array(await(await fetch(a.href)).arrayBuffer())).slice(0,4)]);
  assert.deepEqual(bytes,[0x1a,0x45,0xdf,0xa3],'real WebM data must be generated');
  const videoDownload=page.waitForEvent('download');await videoLink.click();const clip=await videoDownload;
  assert.ok((await fs.stat(await clip.path())).size>1000);assert.match(clip.suggestedFilename(),/moj-promo\.webm$/);
  console.log('PASS blocked automatic video download retains a working link and a real playable-file container');
  const videoURL=await videoLink.getAttribute('href');
  await page.click('#promo-save');await page.waitForFunction(()=>window.__blockedDownloads===3);
  assert.equal(await page.locator('a[data-file="project"]').count(),1);
  assert.equal(await videoLink.getAttribute('href'),videoURL);
  await page.getByRole('button',{name:'Zatvori preuzimanja'}).click();
  assert.equal(await page.locator('#promo-downloads').isVisible(),false);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#promo-save').isVisible(),true);
  assert.equal(await page.locator('#promo-export').isVisible(),true);
  for(const selector of ['#promo-save','#promo-export']){const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);}
  await page.click('#promo-save');await projectLink.waitFor({state:'visible'});
  console.log('PASS repeated saves retain the video link; save and export remain usable on mobile');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
