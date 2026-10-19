// Optional end-to-end check. Requires Playwright and a local HTTP server.
// STUDIO_URL=http://localhost:8778 node tests/browser-smoke.cjs
// CHROMIUM_PATH: optional existing browser executable.
// THREE_TEST_ROOT: optional installed three@0.160.0 directory for offline CDN routing.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
    const browser = await chromium.launch({
        headless: true,
        ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
        args: process.env.CHROMIUM_SERVERLESS ? require('@sparticuz/chromium').default.args : [],
    });
    try {
        const context = await browser.newContext({ viewport: { width: 1000, height: 640 }, acceptDownloads: true, serviceWorkers: 'block' });
        const base = process.env.STUDIO_URL || 'http://localhost:8778';
        if (process.env.THREE_TEST_ROOT) {
            await context.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => route.fulfill({
                path: path.join(process.env.THREE_TEST_ROOT, route.request().url().split('three@0.160.0/')[1]),
                contentType: 'application/javascript',
            }));
        }
        await context.route(base + '/', async route => {
            // Read-only observation hook, added only to the test response (never production).
            let html = await fs.readFile(path.join(__dirname, '../index.html'), 'utf8');
            html = html.replace('            tick();', '            tick(); window.__studioTestState = () => qArc.toArray();');
            if (process.env.STUDIO_TEST_PIXEL_RATIO) {
                html = html.replaceAll('Math.min(window.devicePixelRatio, 2)', String(Number(process.env.STUDIO_TEST_PIXEL_RATIO)));
            }
            await route.fulfill({ body: html, contentType: 'text/html' });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Model loaded'), null, { timeout: 90000 });
        await page.click('#mode-quick');
        assert.equal(await page.locator('#btn-import').isVisible(), true);
        const [picker] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btn-import')]);
        await picker.setFiles(path.join(__dirname, '../default-screenshot.jpg'));
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('default-screenshot.jpg'));
        console.log('PASS: visible upload button opens picker and imports an image');
        for (const preset of ['turntable', 'slow-turn', 'hero', 'tilt', 'roll']) {
            await page.selectOption('#video-preset', preset);
            const before = await page.evaluate(() => window.__studioTestState());
            await page.waitForFunction(before => JSON.stringify(window.__studioTestState()) !== JSON.stringify(before), before, { timeout: 15000 });
            const after = await page.evaluate(() => window.__studioTestState());
            assert.notDeepEqual(before, after, preset + ' must move the phone');
            console.log('PASS: animation preset ' + preset);
        }
        await page.locator('#video-duration').fill('3');
        await page.selectOption('#video-size', '720');
        const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
        await page.click('#btn-video');
        const download = await downloadPromise;
        assert.equal(await download.failure(), null);
        const videoPath = await download.path();
        assert.ok((await fs.stat(videoPath)).size > 1000, 'recording must have video data');
        assert.equal(await page.locator('#btn-import').isEnabled(), true);
        assert.equal(await page.locator('#btn-video-cancel').isVisible(), false);
        console.log('PASS: video downloaded and editor restored: ' + download.suggestedFilename());
        await page.click('#btn-video');
        await page.click('#btn-video-cancel');
        await page.waitForFunction(() => !document.querySelector('#btn-import').disabled);
        assert.match(await page.locator('#status').textContent(), /cancelled/);
        console.log('PASS: cancellation restores the editor');
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
