const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const code = readFileSync(new URL('../sw.js', `file://${__filename}`), 'utf8');
const currentCache = code.match(/const CACHE = "([^"]+)"/)[1];
function setup({ offline = false } = {}) {
    const handlers = {}, saved = [], fetched = [], deleted = [];
    const old = new Response('old UI');
    const sandbox = {
        URL,
        self: { location: { origin: 'https://studio.test' }, addEventListener(type, handler) { handlers[type] = handler; }, clients: { claim: async () => {} } },
        caches: {
            open: async () => ({ match: async () => old.clone(), put: async (req, res) => saved.push(await res.text()) }),
            keys: async () => ['phone-mockup-studio-v72', currentCache, 'other-app-cache'],
            delete: async (key) => { deleted.push(key); },
        },
        fetch: async (req, options) => {
            fetched.push(options);
            if (offline) throw new Error('offline');
            return new Response('new UI');
        },
    };
    vm.runInNewContext(code, sandbox);
    return { handlers, saved, fetched, deleted, async request(path, mode = 'navigate') {
        let response;
        handlers.fetch({ request: { method: 'GET', url: 'https://studio.test' + path, mode }, respondWith(p) { response = p; } });
        return (await response).text();
    } };
}
test('page reload fetches fresh HTML rather than stale cached buttons', async () => {
    const worker = setup();
    assert.equal(await worker.request('/'), 'new UI');
    assert.equal(worker.fetched[0].cache, 'no-store');
    assert.deepEqual(worker.saved, ['new UI']);
});
test('explicit index.html also uses network-first', async () => {
    assert.equal(await setup().request('/index.html', 'cors'), 'new UI');
});
test('promo modules and styles also bypass stale cached versions', async () => {
    for (const file of ['promo.js', 'promo.css', 'promo-core.js']) {
        assert.equal(await setup().request('/' + file, 'cors'), 'new UI');
    }
});
test('offline navigation still uses the saved app', async () => {
    assert.equal(await setup({ offline: true }).request('/'), 'old UI');
});
test('large models remain cache-first', async () => {
    const worker = setup();
    assert.equal(await worker.request('/source/iphone.glb', 'cors'), 'old UI');
    assert.equal(worker.fetched.length, 0);
});
test('activation evicts only this app’s outdated caches', async () => {
    const worker = setup();
    let done;
    worker.handlers.activate({ waitUntil(p) { done = p; } });
    await done;
    assert.deepEqual(worker.deleted, ['phone-mockup-studio-v72']);
});
