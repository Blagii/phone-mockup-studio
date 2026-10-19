// Capture actual application UI; no mockups or generated imagery.
// Requires Playwright in the calling environment and a running local server.
const {chromium}=require('playwright');
const path=require('node:path');
const fs=require('node:fs/promises');
(async()=>{
 const args=process.env.CHROMIUM_SERVERLESS?require('@sparticuz/chromium').default.args:[];
 const browser=await chromium.launch({headless:true,args,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1660,height:1050},deviceScaleFactor:1,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.STUDIO_URL||'http://localhost:8780');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Model loaded'),null,{timeout:90000});
  await fs.mkdir(path.join(__dirname,'../screenshots'),{recursive:true});
  async function frame(){await page.evaluate(async()=>{document.activeElement?.blur();await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
  async function capture(name){await frame();await page.screenshot({path:path.join(__dirname,'../screenshots',name),animations:'disabled'});console.log('Captured '+name);}
  await page.locator('#promo-title').fill('Tvoja aplikacija.\nU prvom planu.');
  await page.locator('#promo-subtitle').fill('OD IDEJE DO PROMO VIDEA.');
  await page.locator('#promo-seek').evaluate(el=>{el.value='4.5';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await capture('app-desktop.png');
  await page.selectOption('#promo-shot','staticScroll');
  await page.locator('#promo-title').fill('');await page.locator('#promo-subtitle').fill('');
  await page.locator('#scene-camera-options').evaluate(el=>el.open=true);
  await page.selectOption('#scene-zoom-mode','custom');
  await page.locator('#scene-zoom-from').fill('120');await page.locator('#scene-zoom-to').fill('120');
  await page.locator('#scene-device-y').evaluate(el=>{el.value='8';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#panel').evaluate(el=>el.scrollTop=95);
  await capture('scene-controls.png');
  await page.locator('#scene-camera-options').evaluate(el=>el.open=false);
  await page.locator('#phone-case-options').evaluate(el=>el.open=true);
  await page.selectOption('#phone-case-finish','matte');await page.selectOption('#phone-case-palette','#4266a9');
  await page.locator('#phone-case-options').scrollIntoViewIfNeeded();
  await capture('phone-case.png');
  await page.selectOption('#promo-quality','1080');
  await page.selectOption('#promo-video-format','mp4');
  await page.locator('#panel').evaluate(el=>el.scrollTop=el.scrollHeight);
  await capture('video-export.png');
  await page.click('#mode-quick');
  await page.waitForFunction(()=>!document.body.classList.contains('promo-mode'));
  await page.locator('#panel').evaluate(el=>el.scrollTop=0);
  await capture('quick-editor.png');
  if(errors.length)throw new Error(errors.join('\n'));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
