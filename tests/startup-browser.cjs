// Full local boot: no CDN stubs, no internet, fresh browser profile.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:process.env.CHROMIUM_SERVERLESS?require('@sparticuz/chromium').default.args:[]});
 try{
  const base=process.env.STUDIO_URL||'http://localhost:8781';
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:960}});
  const external=[],errors=[],loaded=[];
  await context.route('**/*',route=>{
   const url=route.request().url();
   if(/^https?:/.test(url)&&new URL(url).origin!==new URL(base).origin){external.push(url);return route.abort();}
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/vendor/')||r.url().endsWith('promo-core.js'))loaded.push([r.url(),r.status(),r.headers()['content-type']]);});
  await page.goto(base+'/');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Model loaded'),null,{timeout:90000});
  assert.equal(await page.locator('body.promo-mode').count(),1);
  assert.equal(await page.locator('#startup-error').isVisible(),false);
  assert.ok(await page.locator('#model-select option').count()>0);
  assert.ok(await page.locator('#lang-select option').count()>0);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  assert.ok(loaded.length>=6);for(const [url,status,type]of loaded){assert.equal(status,200,url);assert.match(type,/javascript/,url);}
  console.log('PASS fresh startup: complete 3D model, all local JavaScript modules and no external/CDN requests');
  await page.route('**/promo-core.js',route=>route.fulfill({body:'export const broken = true;',contentType:'text/plain'}));
  await page.reload();await page.locator('#startup-error').waitFor({state:'visible'});
  assert.match(await page.locator('#startup-error').textContent(),/START-STUDIO.bat/);
  console.log('PASS a deliberately wrong JavaScript MIME type shows actionable startup instructions instead of an endless loader');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
