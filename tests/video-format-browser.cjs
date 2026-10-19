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
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Model loaded'),null,{timeout:90000});


  const core=await import('../promo-core.js');
  const project={version:2,quality:'720',videoFormat:'webm',scenes:[core.makeScene('title',{duration:1,transition:'cut'})]};
  const [open]=await Promise.all([page.waitForEvent('filechooser'),page.click('#promo-open')]);
  await open.setFiles({name:'formats.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-scene').length===1);
  assert.equal(await page.locator('#promo-video-format').inputValue(),'webm');
  for(const format of ['webm','mp4']){
   await page.selectOption('#promo-video-format',format);
   const supported=await page.evaluate(format=>format==='webm'?['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].some(t=>MediaRecorder.isTypeSupported(t)):['video/mp4;codecs=avc1','video/mp4'].some(t=>MediaRecorder.isTypeSupported(t)),format);
   if(!supported){await page.click('#promo-export');assert.match(await page.locator('#promo-notice').textContent(),/nije podržan/);console.log('PASS unsupported native '+format+' shows explicit notice');continue;}
   const download=page.waitForEvent('download',{timeout:60000});await page.click('#promo-export');const result=await download;
   assert.equal(result.suggestedFilename(),'moj-promo.'+format);
   const bytes=await fs.readFile(await result.path());assert.ok(bytes.length>1000);
   if(format==='webm')assert.deepEqual([...bytes.subarray(0,4)],[0x1a,0x45,0xdf,0xa3]);
   else assert.equal(bytes.subarray(4,8).toString(),'ftyp');
   console.log('PASS real '+format.toUpperCase()+' container and matching download filename');
  }
  await page.selectOption('#promo-video-format','mp4');
  const saved=page.waitForEvent('download');await page.click('#promo-save');const file=await saved;
  const stored=JSON.parse(await fs.readFile(await file.path(),'utf8'));assert.equal(stored.videoFormat,'mp4');
  await page.evaluate(()=>{const original=MediaRecorder.isTypeSupported.bind(MediaRecorder);MediaRecorder.isTypeSupported=type=>type.startsWith('video/mp4')?false:original(type);});
  await page.selectOption('#promo-video-format','mp4');await page.click('#promo-export');
  assert.match(await page.locator('#promo-notice').textContent(),/MP4 nije podržan/);
  assert.equal(await page.locator('body.promo-recording').count(),0);
  assert.match(await page.locator('#promo-video-format-info').textContent(),/nije podržan/);
  console.log('PASS format preference saved; unsupported MP4 never silently exports WebM');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
