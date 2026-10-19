const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = import('../promo-core.mjs');
test('templates contain unique editable scenes and known themes', async () => {
    const { makeTemplate, SHOTS, THEMES } = await core;
    for (const kind of ['launch', 'minimal', 'showcase']) {
        const scenes = makeTemplate(kind);
        assert.equal(new Set(scenes.map(s => s.id)).size, scenes.length);
        for (const s of scenes) { assert.ok(SHOTS[s.shot]); assert.ok(THEMES[s.theme]); }
    }
});
test('timeline boundaries and exact end choose correct scenes', async () => {
    const { makeTemplate, sceneAt, totalDuration } = await core;
    const scenes = makeTemplate();
    assert.equal(sceneAt(scenes, -1).index, 0);
    assert.equal(sceneAt(scenes, scenes[0].duration).index, 1);
    assert.equal(sceneAt(scenes, 999).index, scenes.length - 1);
    assert.equal(sceneAt(scenes, totalDuration(scenes)).progress, 1);
    assert.equal(sceneAt([], 0), null);
});
test('all phone shots have deterministic changing poses, text scenes hide the phone', async () => {
    const { poseForScene, makeScene, SHOTS } = await core;
    const poseFor = (shot,t) => poseForScene(makeScene(shot),t);
    for (const shot of Object.keys(SHOTS)) {
        assert.deepEqual(poseFor(shot, .3), poseFor(shot, .3));
        if (shot === 'title' || shot === 'cta') assert.equal(poseFor(shot, .3).visible, false);
        else if (shot === 'staticScroll') { assert.equal(poseFor(shot, .3).visible, true); assert.deepEqual(poseFor(shot, 0), poseFor(shot, 1)); }
        else { assert.equal(poseFor(shot, .3).visible, true); assert.notDeepEqual(poseFor(shot, 0), poseFor(shot, .6)); }
    }
});
test('soft fade and cut have predictable opacity', async () => {
    const { makeScene, sceneOpacity } = await core;
    const s = makeScene('hero');
    assert.equal(sceneOpacity(s, 0), 0);
    assert.equal(sceneOpacity(s, 1), 1);
    assert.equal(sceneOpacity(s, s.duration), 0);
    assert.equal(sceneOpacity({ ...s, transition: 'cut' }, 0), 1);
});
test('project roundtrip keeps content, regenerates ids, rejects unsafe or broken input', async () => {
    const { makeTemplate, validateProject } = await core;
    const scenes = makeTemplate();
    const project = validateProject({ version: 1, scenes, image: null });
    assert.equal(project.scenes[1].title, scenes[1].title);
    assert.notEqual(project.scenes[0].id, scenes[0].id);
    for (const data of [null, {version:1,scenes:[]}, {version:1,scenes:[{...scenes[0], duration:-1}]}, {version:1,scenes, image:'https://example.com/image.jpg'}, {version:1,scenes:[{...scenes[0], theme:'bad'}]}, {version:1,scenes:[{...scenes[0], shot:'constructor'}]}, {version:1,scenes:[{...scenes[0], theme:'__proto__'}]}]) {
        assert.throws(() => validateProject(data));
    }
});
