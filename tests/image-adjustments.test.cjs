// Run with: node --test tests/*.test.cjs (no dependencies needed).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const html = readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const source = html.slice(html.indexOf('            function composeScreenCanvas(img,'), html.indexOf('            // Re-render the screen texture'));
function compose(adjust = {}, inset = null) {
    const calls = [];
    const context = new Proxy({}, { get: (_, method) => (...args) => calls.push([method, ...args]), set: () => true });
    const sandbox = {
        document: { createElement: () => ({ getContext: () => context }) },
        currentModel: { screenInset: inset },
        imageAdjust: { zoom: 100, x: 0, y: 0, angle: 0, fit: 'cover', ...adjust },
        THREE: { MathUtils: { degToRad: (n) => n * Math.PI / 180 } },
        filterString: () => 'none',
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    const canvas = sandbox.composeScreenCanvas({ width: 1000, height: 1000 });
    return { calls, canvas, draw: calls.find(c => c[0] === 'drawImage'), translate: calls.find(c => c[0] === 'translate') };
}
test('cover fills the display and retains portrait texture dimensions', () => {
    const { canvas, draw } = compose();
    assert.equal(canvas.width, 1179);
    assert.equal(canvas.height, 2556);
    assert.equal(draw[4], 2556);
    assert.equal(draw[5], 2556);
});
test('contain preserves the entire image', () => {
    const { draw } = compose({ fit: 'contain' });
    assert.equal(draw[4], 1179);
    assert.equal(draw[5], 1179);
});
test('zoom and position are independent and measured relative to the screen', () => {
    const { draw, translate } = compose({ zoom: 200, x: 50, y: -50 });
    assert.equal(draw[4], 5112);
    assert.equal(translate[1], 1179);
    assert.equal(translate[2], 0);
});
test('rotation is applied after translating, and screen clipping is restored', () => {
    const { calls } = compose({ angle: 90 });
    const rotate = calls.find(c => c[0] === 'rotate');
    assert.equal(rotate[1], Math.PI / 2);
    assert.ok(calls.findIndex(c => c[0] === 'translate') < calls.indexOf(rotate));
    assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
    assert.ok(calls.some(c => c[0] === 'clip'));
});
test('model bezel remains clipped independently from image adjustments', () => {
    const { calls, draw } = compose({ fit: 'contain' }, { border: 20, radius: 30 });
    assert.equal(draw[4], 1139);
    assert.equal(calls.filter(c => c[0] === 'clip').length, 2);
    assert.equal(calls.filter(c => c[0] === 'save').length, calls.filter(c => c[0] === 'restore').length);
});
test('video frames use natural video dimensions and reuse the screen canvas', () => {
    const draws=[];
    const context=new Proxy({}, {get:(_,method)=>(...args)=>{if(method==='drawImage')draws.push(args);},set:()=>true});
    const destination={width:1179,height:2556,getContext:()=>context};
    const sandbox={document:{createElement(){throw new Error('Must reuse destination');}},currentModel:{screenInset:null},imageAdjust:{zoom:100,x:0,y:0,angle:0,fit:'cover'},THREE:{MathUtils:{degToRad:n=>n*Math.PI/180}},filterString:()=> 'none'};
    vm.createContext(sandbox);vm.runInContext(source,sandbox);
    const result=sandbox.composeScreenCanvas({width:0,height:0,videoWidth:1920,videoHeight:1080},destination);
    assert.equal(result,destination);assert.equal(draws[0][3],4544);assert.equal(draws[0][4],2556);
});
test('automatic scroll aligns long images from their top edge to their bottom edge', async () => {
    const positions=[];const g=new Proxy({}, {get:(_,method)=>(...args)=>{if(method==='translate')positions.push(args[1]);},set:()=>true});
    const sandbox={document:{createElement:()=>({getContext:()=>g})},currentModel:{screenInset:null},imageAdjust:{zoom:100,x:0,y:100,angle:0,fit:'cover'},THREE:{MathUtils:{degToRad:n=>n*Math.PI/180}},filterString:()=> 'none'};
    vm.createContext(sandbox);vm.runInContext(source,sandbox);
    sandbox.scrollPlacement = (await import('../promo-core.mjs')).scrollPlacement;
    for(const scroll of [0,.5,1])sandbox.composeScreenCanvas({width:300,height:1800},null,{image:{...sandbox.imageAdjust,scroll}});
    // Rendered image height is 7074; screen height 2556. Start/end expose the exact edges.
    assert.equal(positions[0]-7074/2,0);assert.equal(positions[1],1278);assert.equal(positions[2]+7074/2,2556);
});
