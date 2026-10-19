const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const html = readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

test('only explicitly hidden elements receive the global hiding rule', () => {
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    const hiddenRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(([, , body]) => /display\s*:\s*none\s*!important/.test(body));
    assert.ok(hiddenRules.length > 0);
    for (const [, selectors] of hiddenRules) {
        assert.equal(selectors.trim(), '[hidden]');
    }
    assert.match(css, /button,\s*select\s*\{\s*font:\s*inherit/);
});

test('upload button is visible in markup and opens the image file picker', () => {
    const button = html.match(/<button\b[^>]*id="btn-import"[^>]*>/)[0];
    assert.doesNotMatch(button, /\bhidden\b|display\s*:\s*none/);
    assert.match(html, /<input type="file" id="file-shot" accept="image\/\*" hidden/);
    assert.match(html, /document\.getElementById\("btn-import"\)\.onclick\s*=\s*\(\)\s*=>\s*fileShot\.click\(\)/);
});
