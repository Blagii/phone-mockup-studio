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

  await page.locator('.timeline-scene').first().click();
  assert.equal(await page.locator('#promo-shot').inputValue(),'title');
  assert.equal(await page.locator('#title-media-upload').isVisible(),true);
  assert.equal(await page.locator('#title-media-remove').isDisabled(),true);
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=800;const g=c.getContext('2d');g.fillStyle='#20dd20';g.fillRect(0,0,400,800);g.fillStyle='#ee2020';g.fillRect(0,0,400,150);return c.toDataURL().split(',')[1];});
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.click('#title-media-upload')]);
  await chooser.setFiles({name:'title-image.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>!document.querySelector('#title-media-remove').disabled);
  async function waitPixel(color){await page.waitForFunction(color=>{const c=document.querySelector('#promo-canvas'),p=c.getContext('2d').getImageData(10,10,1,1).data;return color==='red'?p[0]>200&&p[1]<60:p[0]<100&&p[1]<100;},color);}
  await waitPixel('red');
  const green=await page.evaluate(()=>{const c=document.querySelector('#promo-canvas');return [...c.getContext('2d').getImageData(10,Math.floor(c.height*.8),1,1).data];});
  assert.ok(green[1]>180&&green[0]<60,'title image must fill composition without a device frame');
  await page.locator('#promo-title').fill('Slika i naslov zajedno');
  await page.locator('#image-y').evaluate(el=>{el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await waitPixel('background');
  await page.locator('#image-y').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await waitPixel('red');
  console.log('PASS title scene upload, actual composition pixels, editable text and image positioning');
  await page.locator('#promo-subtitle').fill('Podnaslov');
  await page.locator('#scene-text-options').evaluate(el=>el.open=true);
  await page.check('#scene-text-subtitleAsTitle');
  await page.locator('#scene-text-subtitleScale').evaluate(el=>{el.value='150';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>{const c=document.querySelector('#promo-canvas'),expected=Math.min(c.width,c.height)*.089*1.5;const f=window.__subtitleFont||'';return f.startsWith('750 ')&&Math.abs(parseFloat(f.split(' ')[1])-expected)<.01;});
  assert.equal(await page.locator('#scene-text-scale').inputValue(),'100');
  console.log('PASS independent subtitle size and heading style are applied to the actual canvas font');
  const assetId=await page.locator('#promo-media').inputValue();
  await page.locator('.timeline-scene').nth(1).click();
  assert.equal(await page.locator('#title-media-upload').isVisible(),false);
  assert.equal(await page.locator('#promo-media').inputValue(),'');
  await page.locator('.timeline-scene').first().click();
  await page.click('#promo-duplicate');
  await page.locator('#scene-text-subtitleScale').evaluate(el=>{el.value='250';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.click('#title-media-remove');
  assert.equal(await page.locator('#promo-media').inputValue(),'');
  await page.locator('.timeline-scene').first().click();
  assert.equal(await page.locator('#promo-media').inputValue(),assetId);
  await waitPixel('red');
  const saved=page.waitForEvent('download');await page.click('#promo-save');
  const project=JSON.parse(await fs.readFile(await(await saved).path(),'utf8'));
  assert.equal(project.scenes[0].mediaId,assetId);assert.equal(project.scenes[1].mediaId,null);
  assert.equal(project.scenes[0].title,'Slika i naslov zajedno');
  assert.equal(project.scenes[0].textStyle.subtitleScale,150);assert.equal(project.scenes[0].textStyle.subtitleAsTitle,true);assert.equal(project.scenes[1].textStyle.subtitleScale,250);
  project.scenes=[{...project.scenes[0],duration:1}];
  const [open]=await Promise.all([page.waitForEvent('filechooser'),page.click('#promo-open')]);
  await open.setFiles({name:'title-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>document.querySelectorAll('.timeline-scene').length===1);
  await waitPixel('red');
  console.log('PASS independent title scene duplication/removal and portable project roundtrip');
  const video=page.waitForEvent('download',{timeout:60000});await page.click('#promo-export');const result=await video;
  assert.ok((await fs.stat(await result.path())).size>1000);
  console.log('PASS title image and text video export');assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
