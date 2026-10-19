const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const html = readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.slice(html.indexOf('            const VIDEO_PRESETS ='), html.indexOf('            const videoButton ='));
function setup() {
    const elements = new Map();
    const spins = [];
    const arc = {};
    let copied;
    const sandbox = {
        document: { getElementById(id) {
            if (!elements.has(id)) elements.set(id, { value: '', textContent: '', addEventListener() {} });
            return elements.get(id);
        } },
        setAutoSpin: (value) => spins.push(value),
        cancelAnimationFrame() {}, anim: 123,
        qArc: arc, qArcTarget: { copy(value) { copied = value; } },
        statusEl: {}, autoSpin: false, motionBase: { copy() {} }, motionTime: 0,
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return { sandbox, elements, spins, arc, copied: () => copied };
}
for (const [id, type, axis, seconds] of [
    ['turntable', 'spin', 'y', 10], ['slow-turn', 'spin', 'y', 20],
    ['hero', 'sway', 'y', 8], ['tilt', 'sway', 'x', 6], ['roll', 'sway', 'z', 8],
]) {
    test(`${id} configures a complete video and starts preview`, () => {
        const { sandbox, elements, spins, arc, copied } = setup();
        sandbox.applyVideoPreset(id);
        assert.equal(elements.get('motion-type').value, type);
        assert.equal(elements.get('motion-axis').value, axis);
        assert.equal(elements.get('video-duration').value, seconds);
        assert.equal(elements.get('video-size').value, '1080');
        assert.equal(elements.get('video-fps').value, '30');
        assert.equal(elements.get('video-preset').value, id);
        assert.ok(Math.abs(elements.get('motion-speed').value * seconds / 9.26 - 1) < 0.0001);
        assert.deepEqual(spins, [false, true]);
        assert.equal(copied(), arc);
        assert.equal(sandbox.anim, null);
    });
}
test('custom or unknown preset leaves user settings unchanged', () => {
    const { sandbox, spins } = setup();
    sandbox.applyVideoPreset('custom');
    sandbox.applyVideoPreset('unknown');
    assert.deepEqual(spins, []);
});
test('manual adjustments switch preset indicator to custom', () => {
    const { sandbox, elements } = setup();
    sandbox.applyVideoPreset('hero');
    elements.get('motion-speed').oninput({ target: { value: '2' } });
    assert.equal(elements.get('video-preset').value, 'custom');
    assert.equal(elements.get('v-motion-speed').textContent, '2×');
    sandbox.applyVideoPreset('tilt');
    elements.get('motion-axis').onchange();
    assert.equal(elements.get('video-preset').value, 'custom');
});
