// Optional Playwright checks for video textures, per-scene assets, overlays and native 4K.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: process.env.CHROMIUM_SERVERLESS ? require('@sparticuz/chromium').default.args : [] });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true, serviceWorkers: 'block' });
        const base = process.env.STUDIO_URL || 'http://localhost:8780';
        if (process.env.THREE_TEST_ROOT) await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => route.fulfill({ path: path.join(process.env.THREE_TEST_ROOT, route.request().url().split('three@0.160.0/')[1]), contentType: 'application/javascript' }));
        await context.route(base + '/', async route => {
            let html = await fs.readFile(path.join(__dirname, '../index.html'), 'utf8');
            if (process.env.STUDIO_TEST_PIXEL_RATIO) html = html.replaceAll('Math.min(window.devicePixelRatio, 2)', process.env.STUDIO_TEST_PIXEL_RATIO);
            html = html.replace('promoLastSource = source; promoLastKey = key;', 'promoLastSource = source; promoLastKey = key; window.__screenProbe = { device, source, canvas: promoPhoneCanvas };');
            await route.fulfill({ body: html, contentType: 'text/html' });
        });
        // Generate tiny deterministic fixtures rather than keeping binary media in Git.
        const fixture = await context.newPage(); await fixture.goto(base + '/manifest.webmanifest');
        const images = await fixture.evaluate(() => {
            const c = document.createElement('canvas'); c.width = 300; c.height = 600; const g = c.getContext('2d');
            g.fillStyle = '#f04030'; g.fillRect(0,0,300,600); const red = c.toDataURL('image/png');
            g.fillStyle = '#30d070'; g.fillRect(0,0,300,600); const green = c.toDataURL('image/png');
            c.width = c.height = 120; g.clearRect(0,0,120,120); g.fillStyle = '#3891ff'; g.beginPath(); g.arc(60,60,53,0,Math.PI*2); g.fill();
            g.fillStyle = '#fff'; g.font = 'bold 52px sans-serif'; g.fillText('P',42,78); return { red, green, logo: c.toDataURL('image/png') };
        });
        const videoBytes = await fixture.evaluate(async () => {
            const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
            const stream = c.captureStream(15), recorder = new MediaRecorder(stream, { mimeType:'video/webm;codecs=vp8' }), chunks = [];
            recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
            const done = new Promise(resolve => recorder.onstop = async () => resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]));
            recorder.start(200); let i=0; const timer=setInterval(() => { g.fillStyle = i % 8 < 4 ? '#e04432' : '#306bdd'; g.fillRect(0,0,480,270); g.fillStyle='#fff'; g.fillRect(i++ * 14 % 400,80,60,100); },66);
            await new Promise(resolve => setTimeout(resolve,2200)); clearInterval(timer); recorder.stop(); stream.getTracks().forEach(t=>t.stop()); return done;
        }); await fixture.close();
        const page = await context.newPage(), errors=[]; page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
        await page.goto(base+'/'); await page.waitForSelector('body.promo-mode');
        await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Model loaded'),null,{timeout:90000});
        async function upload(button, payload) { const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.click(button)]); await chooser.setFiles(payload); }
        async function assetCount(n) { await page.waitForFunction(n=>document.querySelectorAll('.media-card').length===n,n,{timeout:45000}).catch(async e=>{console.log('MEDIA NOTICE',await page.locator('#promo-notice').textContent());throw e;}); }
        const imageFile=(name,data)=>({name,mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')});
        await upload('#promo-upload',imageFile('red.png',images.red)); await assetCount(1);
        const redId=await page.locator('#promo-media').inputValue();
        await upload('#promo-upload',imageFile('green.png',images.green)); await assetCount(2);
        const greenId=await page.locator('#promo-media').inputValue();
        await page.locator('.timeline-scene').nth(2).click(); await page.selectOption('#promo-media',redId);
        await page.locator('.timeline-scene').nth(1).click(); assert.equal(await page.locator('#promo-media').inputValue(),greenId);
        console.log('PASS independent per-scene image assignment');
        await page.evaluate(async data => {
            const blob = await (await fetch(data)).blob(), transfer = new DataTransfer();
            transfer.items.add(new File([blob], 'drop.png', { type: 'image/png' }));
            document.querySelector('#promo-canvas').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        }, images.red);
        await assetCount(3); console.log('PASS image drag and drop does not trigger GLB loading');
        await upload('#promo-upload',{name:'recording.webm',mimeType:'video/webm',buffer:Buffer.from(videoBytes)}); await assetCount(4);
        await page.locator('#promo-media-start').fill('0.4');
        await page.waitForFunction(()=>window.__screenProbe?.source instanceof HTMLVideoElement && !window.__screenProbe.source.seeking);
        await page.click('#promo-play');
        await page.waitForFunction(()=>window.__screenProbe?.source instanceof HTMLVideoElement && !window.__screenProbe.source.paused);
        const before=await page.evaluate(()=>window.__screenProbe.source.currentTime);
        await page.waitForFunction(before=>Math.abs(window.__screenProbe.source.currentTime-before)>.1,before);
        await page.click('#promo-play'); console.log('PASS video texture playback and trim');
        await page.selectOption('#promo-device','android'); await page.waitForFunction(()=>window.__screenProbe?.device==='android');
        await page.selectOption('#promo-device','screen'); await page.waitForFunction(()=>window.__screenProbe?.device==='screen');
        await page.selectOption('#promo-device','laptop'); await page.waitForFunction(()=>window.__screenProbe?.device==='laptop');
        console.log('PASS Android, laptop and frameless 3D devices');
        await page.locator('#promo-brand > summary').click();
        async function value(id, value) { await page.locator(id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value); }
        await value('#brand-top','#dfedff'); await value('#brand-bottom','#8eb4e1');
        await value('#brand-light','#cfe4ff'); await value('#brand-frame','#848c99');
        await page.locator('#promo-layers > summary').click(); await page.click('#layer-add-text');
        await page.locator('#layer-text').fill('Moj brend'); await page.locator('#layer-x').fill('30'); await page.locator('#layer-y').fill('75'); await page.locator('#layer-rotation').fill('-8');
        await page.waitForTimeout(350);
        const bounds = await page.locator('#promo-canvas').boundingBox();
        await page.mouse.move(bounds.x + bounds.width * .3, bounds.y + bounds.height * .75);
        await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .7, { steps: 4 }); await page.mouse.up();
        assert.ok(Math.abs(Number(await page.locator('#layer-x').inputValue()) - 40) <= 2);
        assert.ok(Math.abs(Number(await page.locator('#layer-y').inputValue()) - 70) <= 2);
        console.log('PASS direct manipulation of an overlay on the canvas');
        await upload('#layer-add-image',imageFile('brand.png',images.logo)); await assetCount(5);
        assert.equal(await page.locator('#layer-select option').count(),2);
        await page.locator('#layer-y').fill('88'); await value('#layer-size','12');
        if(process.env.STUDIO_SCREENSHOT) await page.screenshot({path:process.env.STUDIO_SCREENSHOT});
        console.log('PASS custom background, light, frame, text and transparent logo layers');
        const saved=page.waitForEvent('download'); await page.click('#promo-save'); const project=JSON.parse(await fs.readFile(await (await saved).path(),'utf8'));
        assert.equal(project.version,2); assert.equal(project.assets.length,5); assert.equal(project.scenes[1].device,'laptop'); assert.equal(project.scenes[1].overlays.length,2);
        assert.equal(project.scenes[1].colors.light,'#cfe4ff'); assert.equal(project.scenes[2].mediaId,redId);
        async function open(data){ await upload('#promo-open',{name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))}); }
        const short={...project,scenes:[project.scenes[1],project.scenes[2]].map(s=>({...s,duration:1.5})),quality:'720'};
        await open(short); await page.waitForFunction(()=>document.querySelectorAll('.timeline-scene').length===2);
        assert.equal(await page.locator('#layer-select option').count(),2); assert.equal(await page.locator('#promo-device').inputValue(),'laptop');
        console.log('PASS project roundtrip embeds videos, media refs, layers and device settings');
        const videoDownload=page.waitForEvent('download',{timeout:60000}); await page.click('#promo-export'); const result=await videoDownload;
        assert.ok((await fs.stat(await result.path())).size>1000); console.log('PASS composed export with video, logo and text');
        const title={...project.scenes[0],duration:1,overlays:[]};
        await open({...project,scenes:[title],format:'wide',quality:'2160'});
        await page.waitForFunction(()=>document.querySelectorAll('.timeline-scene').length===1).catch(async e=>{ console.log('OPEN NOTICE',await page.locator('#promo-notice').textContent()); throw e; });
        assert.match(await page.locator('#promo-export-size').textContent(),/3840 × 2160/);
        const fourK=page.waitForEvent('download',{timeout:60000}); await page.click('#promo-export');
        await page.waitForFunction(()=>document.querySelector('#promo-canvas').width===3840&&document.querySelector('#promo-canvas').height===2160);
        const file=await fourK; assert.ok((await fs.stat(await file.path())).size>1000);
        if(process.env.STUDIO_4K_VIDEO) await file.saveAs(process.env.STUDIO_4K_VIDEO);
        assert.equal(await page.locator('#promo-canvas').evaluate(c=>c.width),1280);
        console.log('PASS native 3840 × 2160 video and lightweight preview restoration');
        await open({...project,scenes:[{...title,shot:'constructor'}]});
        await page.waitForFunction(()=>document.querySelector('#promo-notice').textContent.includes('Neispravna'));
        assert.equal(await page.locator('.timeline-scene').count(),1);
        console.log('PASS invalid project is rejected without replacing current work');
        assert.deepEqual(errors,[]);
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
